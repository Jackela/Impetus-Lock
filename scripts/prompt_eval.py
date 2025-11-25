#!/usr/bin/env python3
"""Offline prompt evaluation helper.

Usage:
    python scripts/prompt_eval.py

The script prints the rendered system/user prompts and sample DebugLLMProvider
responses for a handful of canned contexts. No external LLM calls are made,
so it can be used as a lightweight alternative to promptfoo for smoke testing.
"""

from __future__ import annotations

from pathlib import Path
from textwrap import indent
import tomllib

REPO_ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_DIR = REPO_ROOT / "server" / "server" / "prompts"

SAMPLES = [
    "他打开门，犹豫着要不要进去。门后一片漆黑。",
    "雨水砸在棚顶，他必须在五分钟内决定交易。",
]


def _print_header(title: str) -> None:
    print("=" * 60)
    print(title)
    print("=" * 60)


def _load_template(name: str) -> dict[str, str]:
    data = tomllib.loads((TEMPLATE_DIR / f"{name}.toml").read_text(encoding="utf-8"))
    return {
        "system": data["system"],
        "user_template": data["user_template"],
    }


def _render_user_prompt(template: str, context: str) -> str:
    return template.replace("{{context}}", context)


def _show_prompt(mode: str, context: str) -> None:
    tpl = _load_template(mode)
    system = tpl["system"]
    user = _render_user_prompt(tpl["user_template"], context)
    _print_header(f"{mode.upper()} prompt for context: {context[:40]}...")
    print("System prompt:\n" + indent(system, "    "))
    print("User prompt:\n" + indent(user, "    "))
    print()


def main() -> None:
    for mode in ("muse", "loki"):
        for ctx in SAMPLES:
            _show_prompt(mode, ctx)


if __name__ == "__main__":
    main()
