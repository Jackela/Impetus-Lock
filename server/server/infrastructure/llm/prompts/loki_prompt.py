"""Loki mode LLM prompts for random chaos interventions.

This module defines the system and user prompts for Loki mode,
which generates unpredictable actions (Provoke or Delete) to create
gamified discipline through chaos.

Constitutional Compliance:
- Article II (Vibe-First): Core Loki prompt for random pressure
- Article V (Documentation): Complete Google-style docstrings

Success Criteria:
- SC-007: Action distribution 60% Provoke / 40% Delete (±5%)
- SC-006: Safety guard prevents deletion on short documents
"""

from typing import Final

from server.infrastructure.llm.prompts.prompt_registry import (
    PromptTemplate,
    get_prompt_pair,
    get_prompt_template,
)

_LOKI_TEMPLATE: PromptTemplate = get_prompt_template("loki")
LOKI_SYSTEM_PROMPT: Final[str] = _LOKI_TEMPLATE.system_prompt


def get_loki_user_prompt(context: str) -> str:
    """Generate user prompt for Loki intervention.

    Provides the user's recent writing context to the LLM for analysis.
    The LLM will decide whether to Provoke (inject) or Delete (remove).

    Args:
        context: Last 3 sentences from the user's document (extracted by contextExtractor).

    Returns:
        Formatted user prompt with context.

    Example:
        >>> context = "他打开门，犹豫着要不要进去。门后一片漆黑。"
        >>> prompt = get_loki_user_prompt(context)
        >>> # LLM might return: {"action": "rewrite", "content": "门后其实是台手术桌。"}
        >>> # Or {"action": "delete"} to remove a sentence
    """
    return _LOKI_TEMPLATE.render_user_prompt(context)


def get_loki_prompts(context: str) -> tuple[str, str]:
    """Get complete prompt pair for Loki mode intervention.

    Convenience function that returns both system and user prompts.
    Used by InstructorLLMProvider for OpenAI API calls.

    Args:
        context: Last 3 sentences from user's document.

    Returns:
        Tuple of (system_prompt, user_prompt).

    Example:
        >>> system, user = get_loki_prompts("他打开门，犹豫着要不要进去。")
        >>> # Pass to OpenAI: client.chat.completions.create(
        >>> #   messages=[
        >>> #     {"role": "system", "content": system},
        >>> #     {"role": "user", "content": user}
        >>> #   ]
        >>> # )
    """
    return get_prompt_pair("loki", context)
