"""Pytest configuration and fixtures for test suite.

Sets up test environment with mocked OpenAI API key.
"""

import os

import pytest

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
