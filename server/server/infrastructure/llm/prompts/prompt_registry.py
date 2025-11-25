"""Prompt registry that loads versioned templates from ``server/prompts`` TOML files."""

from __future__ import annotations

import tomllib
from dataclasses import dataclass
from functools import lru_cache
from importlib import resources
from typing import Literal

PromptName = Literal["muse", "loki"]


@dataclass(frozen=True)
class PromptTemplate:
    """Immutable prompt template with helper rendering utilities."""

    name: PromptName
    version: str
    system_prompt: str
    user_template: str

    def render_user_prompt(self, context: str) -> str:
        """Inject runtime context into the template placeholder."""

        return self.user_template.replace("{{context}}", context)


def get_prompt_template(name: PromptName) -> PromptTemplate:
    """Return the parsed prompt template for the given provider."""

    return _load_templates()[name]


def get_prompt_pair(name: PromptName, context: str) -> tuple[str, str]:
    """Convenience helper that returns the (system, user) pair."""

    template = get_prompt_template(name)
    return template.system_prompt, template.render_user_prompt(context)


@lru_cache(maxsize=1)
def _load_templates() -> dict[PromptName, PromptTemplate]:
    """Load all templates from the ``server/prompts`` package."""

    templates: dict[PromptName, PromptTemplate] = {}
    package = resources.files("server.prompts")
    prompt_names: tuple[PromptName, ...] = ("muse", "loki")

    for name in prompt_names:
        path = package.joinpath(f"{name}.toml")
        raw = path.read_text(encoding="utf-8")
        data = tomllib.loads(raw)
        version = data.get("version")
        system = data.get("system")
        user_template = data.get("user_template")
        if not isinstance(version, str) or not version.strip():
            raise ValueError(f"Prompt template '{name}' missing version metadata")
        if not isinstance(system, str) or not system.strip():
            raise ValueError(f"Prompt template '{name}' missing system prompt")
        if not isinstance(user_template, str) or "{{context}}" not in user_template:
            raise ValueError(
                f"Prompt template '{name}' user_template must include '{{context}}' placeholder"
            )
        templates[name] = PromptTemplate(
            name=name,
            version=version,
            system_prompt=system.strip("\n"),
            user_template=user_template.strip("\n"),
        )

    return templates
