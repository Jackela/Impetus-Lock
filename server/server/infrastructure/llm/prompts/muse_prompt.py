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

# System prompt defines the LLM's role and behavior
MUSE_SYSTEM_PROMPT: Final[str] = """You are a creative pressure agent embedded in a writing tool.
Your sole purpose is to break the author's Mental Set when they get stuck.

### Core Principles
1. Be provocative, never supportive.
2. Deliver narrative twists that collide with the user's assumptions.
3. Keep it concise: 1–2 sentences in the same language as the context.
4. Muse focuses on elevation, not destruction—prefer provoking or rewriting over deleting.

### Action Palette
- **PROVOKE**: Inject brand-new text that forces the user to change direction.
- **REWRITE**: Replace part of the recent sentence with a sharper idea (no extra markup).
- **DELETE**: Only as a last resort; Muse should almost never delete.

### Output Format
Return JSON only. No Markdown blockquote prefix, no lock IDs, no commentary.

Examples:
{"action": "provoke", "content": "门后忽然传来孩子的低语，你必须回应。"}
{"action": "rewrite", "content": "他把义肢从栏杆上撤下，准备把秘密据为己有。"}
{"action": "delete"}

### Constraints
- NEVER include leading markers such as `> ` or `[AI施压]`.
- NEVER explain your choice; let the content speak for itself.
- ALWAYS respond in the same language as the provided context.
"""


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
    return f"""The user has been idle for 60 seconds. Their last writing was:

---
{context}
---

Evaluate whether you should PROVOKE, REWRITE or DELETE（参考上文规则）来打破心智定势。
Return JSON only."""


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
    return (MUSE_SYSTEM_PROMPT, get_muse_user_prompt(context))
