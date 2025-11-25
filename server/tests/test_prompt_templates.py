"""Golden-style regression tests for Muse/Loki prompt templates."""

from __future__ import annotations

from server.infrastructure.llm.prompts import loki_prompt, muse_prompt
from server.infrastructure.llm.prompts.prompt_registry import get_prompt_template


def test_muse_prompt_contains_required_constraints() -> None:
    system, user = muse_prompt.get_muse_prompts("他打开门，犹豫着要不要进去。")

    assert "Return JSON only" in system
    assert "NEVER include leading markers" in system
    assert "他打开门" in user
    assert "{{context}}" not in user
    assert "NEVER include leading markers such as `> `" in system


def test_loki_prompt_mentions_action_mix() -> None:
    system, user = loki_prompt.get_loki_prompts("门后一片漆黑。")

    assert "Action Mix" in system
    assert "PROVOKE" in system and "DELETE" in system
    assert "门后一片漆黑" in user
    assert "Return JSON" in user


def test_templates_expose_versions() -> None:
    muse = get_prompt_template("muse")
    loki = get_prompt_template("loki")

    assert muse.version
    assert loki.version
    assert muse.render_user_prompt("ctx") != loki.render_user_prompt("ctx")
