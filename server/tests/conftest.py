"""Pytest configuration and fixtures for test suite.

Sets up test environment with mocked OpenAI API key.
"""

import os
from collections.abc import Generator

import pytest
from sqlalchemy import text

from server.api.main import app as fastapi_app
from server.infrastructure.cache.idempotency_cache import AsyncIdempotencyCache
from server.infrastructure.llm.provider_registry import ProviderRegistry

# Ensure defaults exist before modules under test import ProviderRegistry
os.environ.setdefault("OPENAI_API_KEY", "test-key-for-unit-tests")
os.environ.setdefault("LLM_DEFAULT_PROVIDER", "openai")
os.environ.setdefault("LLM_ALLOW_DEBUG_PROVIDER", "0")
os.environ.setdefault("TESTING", "0")


@pytest.fixture(scope="session", autouse=True)
def setup_test_environment() -> None:
    """Set up test environment variables.

    Auto-used for all tests to ensure OPENAI_API_KEY is available.
    Uses a dummy key since actual LLM calls are mocked in tests.
    """
    os.environ["OPENAI_API_KEY"] = "test-key-for-unit-tests"


@pytest.fixture(autouse=True)
def ensure_app_state() -> None:
    """Ensure shared app.state resources exist for tests."""

    fastapi_app.state.provider_registry = ProviderRegistry()
    fastapi_app.state.idempotency_cache = AsyncIdempotencyCache(ttl=15)


@pytest.fixture
def anyio_backend() -> str:
    """Force anyio tests to use asyncio backend (trio not installed in dev env)."""

    return "asyncio"


@pytest.fixture(autouse=True)
def clean_database(db_session: object | None) -> Generator[None, None, None]:
    """Clean all tables after each test to prevent state leakage.

    This is crucial for tests that run sequentially in CI, as it prevents
    data from one test from affecting another. Local tests often pass
    because they run in isolation, but CI runs tests sequentially.

    Note: This fixture only runs if db_session is available (integration tests).
    Unit tests without db_session are unaffected.

    Args:
        db_session: Database session fixture (None for unit tests)

    Yields:
        None
    """
    yield

    # Check if db_session fixture was provided (integration test)
    # We need to use hasattr check since db_session might be a fixture marker
    # or we can catch the exception
    if db_session is not None and hasattr(db_session, "execute"):
        try:
            # Truncate all tables that tests might modify
            # Using TRUNCATE with CASCADE for clean state
            db_session.execute(text("TRUNCATE TABLE tasks CASCADE"))
            db_session.execute(text("TRUNCATE TABLE interventions CASCADE"))
            db_session.commit()  # type: ignore[attr-defined]
        except Exception:
            # If tables don't exist (e.g., unit tests), ignore
            pass
