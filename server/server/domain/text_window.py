"""Text window utilities for sentence anchor calculations.

Provides helper functions to convert client-side context windows into
cursor-relative anchor ranges. Keeps anchor math centralized so both the
service layer and future providers share the same heuristics.

Constitutional Compliance:
- Article I (Simplicity): Pure functions, no I/O or framework coupling
- Article V (Documentation): Google-style docstrings for all helpers
"""

from __future__ import annotations

from typing import Final, Tuple

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

    for idx, char in enumerate(trimmed):
        if char in SENTENCE_BOUNDARIES or char == "\n":
            fragment = trimmed[start : idx + 1]
            if fragment and fragment.strip():
                sentences.append(fragment)
            start = idx + 1

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
    """Estimate the character length of the sentence at the cursor tail.

    Args:
        context: The context window sent by the client (ends at cursor).
        min_length: Minimum fallback length when no punctuation is found.
        max_length: Maximum window to rewrite to avoid document-wide deletes.

    Returns:
        Number of characters belonging to the most recent sentence.
    """

    sentences = _slice_sentences(context)
    if not sentences:
        return min_length

    candidate = _strip_leading_whitespace(sentences[-1])
    if not candidate:
        return min_length

    length = len(candidate)
    return max(min_length, min(length, max_length))


def compute_last_sentence_anchor(
    cursor: int,
    context: str,
    *,
    min_length: int = 12,
    max_length: int = 400,
) -> Tuple[int, int]:
    """Compute (from, to) anchor bounds for last sentence rewrite.

    Args:
        cursor: Absolute cursor position reported by the client.
        context: Context window text ending at the cursor.
        min_length: Minimum characters to rewrite when punctuation missing.
        max_length: Maximum rewrite window size.

    Returns:
        Tuple of (from, to) document positions for rewrite anchors.
    """

    safe_cursor = max(0, cursor)
    sentence_length = compute_last_sentence_length(
        context, min_length=min_length, max_length=max_length
    )
    start = max(0, safe_cursor - sentence_length)
    return start, safe_cursor
