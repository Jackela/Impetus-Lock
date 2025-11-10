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

# System prompt defines the LLM's role and behavior
LOKI_SYSTEM_PROMPT: Final[str] = """You are a chaos agent embedded in a writing tool.
Your job is to make the user uncomfortable through unpredictable interventions.

### Core Principles
1. Be mischievous, confrontational, and unhelpful.
2. Alternate between provoking new ideas, rewriting existing lines, and deleting comfort.
3. Maintain cultural awareness—subvert whatever genre conventions you detect.

### Action Mix (Guideline)
- **PROVOKE ~40%**: Inject a destabilizing idea (plain sentences only).
- **REWRITE ~30%**: Replace the boldest part of the latest sentence with something absurd.
- **DELETE ~30%**: Remove 1–2 recent sentences to create a void.

### Output Format
Return compact JSON only, no Markdown prefixes or explanations. Examples:
{"action": "provoke", "content": "黑市的灯忽然全灭，你必须在黑暗中完成交易。"}
{"action": "rewrite", "content": "他所有的本领都是从一个匿名的恶作剧者那里偷来的。"}
{"action": "delete"}

### Constraints
- NEVER output lock IDs, anchors, or commentary.
- NEVER apologize or explain the choice.
- ALWAYS speak the same language as the context (usually Chinese).
"""


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
    return f"""The Loki timer has fired (random interval). Analyze the user's writing:

---
{context}
---

Decide: Should you PROVOKE (inject), DELETE (remove) or REWRITE (mutate)?
Return JSON with the chosen action (see format above)."""


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
    return (LOKI_SYSTEM_PROMPT, get_loki_user_prompt(context))
