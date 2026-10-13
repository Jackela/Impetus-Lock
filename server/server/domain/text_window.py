"""Text window utilities for sentence anchor calculations.

Provides helper functions to convert client-side context windows into
cursor-relative anchor ranges. Keeps anchor math centralized so both the
service layer and future providers share the same heuristics.

Constitutional Compliance:
- Article I (Simplicity): Pure functions, no I/O or framework coupling
- Article V (Documentation): Google-style docstrings for all helpers
"""

from __future__ import annotations

from typing import Final

SENTENCE_BOUNDARIES: Final[tuple[str, ...]] = ("。", "！", "？", "!", "?", ".")


def _strip_trailing_whitespace(value: str) -> str:
    """Trim trailing whitespace but preserve intentional mid-sentence spacing."""
    return value.rstrip()


def _strip_leading_whitespace(value: str) -> str:
    """Remove leading whitespace characters from a fragment."""
    offset = 0
    length = len(value)
    while offset < length and value[offset].isspace():
        offset += 1
    return value[offset:]


def _slice_sentences(context: str) -> list[str]:
    """Split context into rough sentences using punctuation and newlines."""
    trimmed = _strip_trailing_whitespace(context)
    if not trimmed:
        return []

    sentences: list[str] = []
    start = 0

    idx = 0
    while idx < len(trimmed):
        char = trimmed[idx]
        if char in SENTENCE_BOUNDARIES or char == "\n":
            # Keep a punctuation run and its closing quotes on the same sentence.
            # Otherwise dialogue ends up targeting only the quote or final "!".
            if char != "\n":
                while idx + 1 < len(trimmed) and (
                    trimmed[idx + 1] in SENTENCE_BOUNDARIES or trimmed[idx + 1] in "\"'”’」』"
                ):
                    idx += 1
            fragment = trimmed[start : idx + 1]
            if fragment and fragment.strip():
                sentences.append(fragment)
            start = idx + 1
        idx += 1

    if start < len(trimmed):
        fragment = trimmed[start:]
        if fragment.strip():
            sentences.append(fragment)

    return sentences


def compute_last_sentence_length(
    context: str,
    *,
    min_length: int = 12,
    max_length: int = 400,
) -> int:
    """Measure the cursor-tail sentence in ProseMirror UTF-16 positions.

    Args:
        context: The context window sent by the client (ends at cursor).
        min_length: Fallback length when no sentence text is available.
        max_length: Maximum UTF-16 window to avoid document-wide rewrites.

    Returns:
        UTF-16 units belonging to the most recent sentence, including tail whitespace.
    """
    sentences = _slice_sentences(context)
    if not sentences:
        return min_length

    candidate = _strip_leading_whitespace(sentences[-1])
    if not candidate:
        return min_length

    # Context ends at the cursor. Include trailing whitespace in the distance
    # back to the sentence start; trimming it would move the anchor into text.
    candidate += context[len(context.rstrip()) :]
    length = 0
    for char in reversed(candidate):
        units = 2 if ord(char) > 0xFFFF else 1
        if length + units > max_length:
            break
        length += units
    # A known short sentence must not borrow characters from the previous one.
    return length


def compute_last_sentence_anchor(
    cursor: int,
    context: str,
    *,
    min_length: int = 12,
    max_length: int = 400,
) -> tuple[int, int]:
    """Compute (from, to) anchor bounds for last sentence rewrite.

    Args:
        cursor: Absolute cursor position reported by the client.
        context: Context window text ending at the cursor.
        min_length: Fallback positions when sentence text is absent.
        max_length: Maximum rewrite window in UTF-16 positions.

    Returns:
        Tuple of (from, to) document positions for rewrite anchors.
    """
    safe_cursor = max(0, cursor)
    sentence_length = compute_last_sentence_length(
        context, min_length=min_length, max_length=max_length
    )
    start = max(0, safe_cursor - sentence_length)
    return start, safe_cursor
