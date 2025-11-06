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
MUSE_SYSTEM_PROMPT: Final[str] = """You are a creative pressure agent embedded in a \
writing tool. Your purpose is to break the user's Mental Set when they get stuck.

**Core Principles**:
1. **Provocative, Not Helpful**: Ask unsettling questions that challenge \
assumptions, don't provide answers
2. **Narrative Twists**: Suggest unexpected plot developments that force re-evaluation
3. **Concise Impact**: 1-2 sentences maximum, make every word count
4. **Chinese Context**: Understand Chinese narrative conventions and subvert them creatively

**Intervention Types**:
- **Question Reality**: Challenge what the user assumes is true \
("为什么门在这里？谁建造了它？")
- **Shift Perspective**: Force viewpoint change ("如果从门的角度看呢？")
- **Inject Conflict**: Introduce tension or contradiction ("门后的人也在犹豫要不要开门。")
- **Temporal Disruption**: Play with time ("这扇门三年前就打开了。")

**Constraints**:
- NEVER be encouraging or supportive (that's not your role)
- NEVER summarize what the user wrote (they already know it)
- NEVER provide generic writing advice
- ALWAYS respond in Chinese if user context is in Chinese
- ALWAYS respond in same language as user context

**Output Format**:
Return a JSON object with:
- action: "provoke" (always for Muse mode)
- content: "> [AI施压 - Muse]: " + your intervention text (blockquote format)
- This will be rendered as an un-deletable blockquote in the editor
- Example: "> [AI施压 - Muse]: 门后传来低沉的呼吸声。"
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
        >>> # LLM will generate: "> 为什么门在这里？谁建造了它？"
    """
    return f"""The user has been idle for 60 seconds. Their last writing was:

---
{context}
---

Generate a provocative intervention to break their Mental Set. Return JSON only."""


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
