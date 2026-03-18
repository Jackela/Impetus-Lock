"""Tests for database fallback behavior in TESTING mode."""

import pytest

from server.infrastructure.persistence import database


@pytest.mark.asyncio
async def test_init_database_allows_testing_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    """init_database should not raise when DATABASE_URL is missing and TESTING=1."""

    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("TESTING", "1")

    # Ensure global state is cleared before invocation
    database._db_manager = None  # noqa: SLF001

    result = await database.init_database()

    assert result is None
    assert database.is_database_initialized() is False


@pytest.mark.asyncio
async def test_database_manager_graceful_init_failure() -> None:
    """DatabaseManager should handle initialization failures gracefully."""
    import os

    # Store original env var
    original_url = os.getenv("DATABASE_URL")

    try:
        # Set an invalid URL
        os.environ["DATABASE_URL"] = "postgresql+asyncpg://invalid:5432/nonexistent"

        manager = database.DatabaseManager()
        success = await manager.initialize()

        # Should fail gracefully
        assert success is False
        assert manager.is_initialized is False

    finally:
        # Restore original URL
        if original_url:
            os.environ["DATABASE_URL"] = original_url
        elif "DATABASE_URL" in os.environ:
            del os.environ["DATABASE_URL"]


@pytest.mark.asyncio
async def test_health_check_when_uninitialized() -> None:
    """Health check should report error when database not initialized."""
    import os

    # Store original env var
    original_url = os.getenv("DATABASE_URL")

    try:
        # Create manager without valid URL
        os.environ["DATABASE_URL"] = "postgresql+asyncpg://test:test@localhost:5432/test"
        manager = database.DatabaseManager()

        # Don't initialize - health check should report not initialized
        health = await manager.health_check()

        assert health.is_healthy is False
        assert health.error_message == "Database manager not initialized"

    finally:
        # Restore original URL
        if original_url:
            os.environ["DATABASE_URL"] = original_url
        elif "DATABASE_URL" in os.environ:
            del os.environ["DATABASE_URL"]


def test_is_database_initialized_returns_false_when_no_manager() -> None:
    """is_database_initialized should return False when no manager exists."""
    # Store original state
    original_manager = database._db_manager

    try:
        database._db_manager = None
        assert database.is_database_initialized() is False
    finally:
        database._db_manager = original_manager


def test_get_health_status_when_not_initialized() -> None:
    """get_health_status should return error when database not initialized."""
    # Store original state
    original_manager = database._db_manager

    try:
        database._db_manager = None
        health = database.get_health_status()

        assert health.is_healthy is False
        assert health.error_message == "Database manager not initialized"
    finally:
        database._db_manager = original_manager
