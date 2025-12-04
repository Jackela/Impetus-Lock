"""Tests for database fallback behavior in TESTING mode."""

import os

from server.infrastructure.persistence import database


def test_init_database_allows_testing_fallback(monkeypatch):
    """init_database should not raise when DATABASE_URL is missing and TESTING=1."""

    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("TESTING", "1")

    # Ensure global state is cleared before invocation
    database._db_manager = None  # type: ignore[attr-defined]

    result = database.init_database()

    assert result is None
    assert database.is_database_initialized() is False
