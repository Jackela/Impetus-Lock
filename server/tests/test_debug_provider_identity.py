"""Tests for unique lock identifiers from the debug intervention provider."""

from datetime import UTC, datetime
from unittest.mock import patch

from server.infrastructure.llm.debug_provider import DebugLLMProvider


def test_generate_intervention_issues_distinct_lock_ids_at_same_timestamp() -> None:
    """Each provoke intervention gets a distinct lock ID at one frozen instant."""
    frozen_issued_at = datetime(2026, 9, 14, 12, 0, 0, tzinfo=UTC)
    provider = DebugLLMProvider()

    with patch("server.infrastructure.llm.debug_provider.datetime") as datetime_clock:
        datetime_clock.now.return_value = frozen_issued_at
        first = provider.generate_intervention(
            context="他打开门，犹豫着要不要进去。",
            mode="muse",
            selection_from=12,
            selection_to=12,
        )
        second = provider.generate_intervention(
            context="他打开门，犹豫着要不要进去。",
            mode="muse",
            selection_from=12,
            selection_to=12,
        )

    assert first.action == second.action == "provoke"
    assert first.source == second.source == "muse"
    assert first.content == second.content
    assert first.anchor == second.anchor
    assert first.issued_at == second.issued_at == frozen_issued_at
    assert first.lock_id != second.lock_id
    assert first.lock_id.startswith("lock_debug_muse_")
    assert second.lock_id.startswith("lock_debug_muse_")
