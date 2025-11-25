"""Muse mode LLM prompts for creative pressure interventions.

This module defines the system and user prompts for Muse mode,
which generates provocative narrative twists to break Mental Set.

Constitutional Compliance:
- Article II (Vibe-First): Core Muse prompt for creative pressure
- Article V (Documentation): Complete Google-style docstrings

Success Criteria:
- SC-005: Intervention relevance score ≥4.0/5.0 (user ratings)
"""

from typing import Final

from server.infrastructure.llm.prompts.prompt_registry import (
    PromptTemplate,
    get_prompt_pair,
    get_prompt_template,
)

# System prompt is now sourced from versioned TOML template files.
_MUSE_TEMPLATE: PromptTemplate = get_prompt_template("muse")
MUSE_SYSTEM_PROMPT: Final[str] = _MUSE_TEMPLATE.system_prompt


def get_muse_user_prompt(context: str) -> str:
    """Generate user prompt for Muse intervention.

    Provides the user's recent writing context to the LLM for analysis.
    The LLM will generate a provocative intervention based on this context.

    Args:
        context: Last 3 sentences from the user's document (extracted by contextExtractor).

    Returns:
        Formatted user prompt with context.

    Example:
        >>> context = "他打开门，犹豫着要不要进去。"
        >>> prompt = get_muse_user_prompt(context)
        >>> # LLM will generate: {"action": "provoke", "content": "门后忽然传来潮湿的呼吸声。"}
    """
    return _MUSE_TEMPLATE.render_user_prompt(context)


def get_muse_prompts(context: str) -> tuple[str, str]:
    """Get complete prompt pair for Muse mode intervention.

    Convenience function that returns both system and user prompts.
    Used by InstructorLLMProvider for OpenAI API calls.

    Args:
        context: Last 3 sentences from user's document.

    Returns:
        Tuple of (system_prompt, user_prompt).

    Example:
        >>> system, user = get_muse_prompts("他打开门，犹豫着要不要进去。")
        >>> # Pass to OpenAI: client.chat.completions.create(
        >>> #   messages=[
        >>> #     {"role": "system", "content": system},
        >>> #     {"role": "user", "content": user}
        >>> #   ]
        >>> # )
    """
    return get_prompt_pair("muse", context)
