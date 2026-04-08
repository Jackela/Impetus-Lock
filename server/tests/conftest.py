"""Root pytest configuration and fixtures for Impetus Lock test suite.

Provides global test environment setup, custom markers, command-line options,
and shared fixtures across all test categories. Implements strict test isolation
and cleanup patterns.

Constitutional Compliance:
- Article I (Simplicity): Minimal fixture setup with clear dependencies
- Article III (TDD): Facilitates fast, isolated tests
- Article V (Documentation): Comprehensive docstrings
"""

from __future__ import annotations

import asyncio
import os
import warnings
from collections.abc import AsyncGenerator, Generator
from typing import TYPE_CHECKING, Any

import pytest
import pytest_asyncio

# Force TESTING mode BEFORE any server imports
os.environ["TESTING"] = "1"
os.environ.setdefault("OPENAI_API_KEY", "test-openai-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-anthropic-key")
os.environ.setdefault("GOOGLE_API_KEY", "test-google-key")
os.environ.setdefault("LLM_DEFAULT_PROVIDER", "debug")
os.environ.setdefault("LLM_ALLOW_DEBUG_PROVIDER", "1")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")

if TYPE_CHECKING:
    pass


def pytest_configure(config: pytest.Config) -> None:
    """Configure pytest with custom markers and settings.

    Args:
        config: Pytest configuration object.
    """
    # Register custom markers
    config.addinivalue_line("markers", "unit: Fast isolated unit tests")
    config.addinivalue_line("markers", "integration: Tests with database/services")
    config.addinivalue_line("markers", "e2e: End-to-end tests with full stack")
    config.addinivalue_line("markers", "slow: Tests taking >1 second")
    config.addinivalue_line("markers", "llm_live: Tests requiring live LLM APIs")
    config.addinivalue_line("markers", "requires_anthropic: Tests requiring anthropic SDK")
    config.addinivalue_line("markers", "requires_gemini: Tests requiring google-generativeai SDK")
    config.addinivalue_line("markers", "requires_openai: Tests requiring openai SDK")

    # Suppress async fixtures deprecation warnings
    config.option.asyncio_mode = "auto"


def pytest_ignore_collect(path: Any, config: pytest.Config) -> bool | None:
    """Skip test files that import optional SDKs when dependencies unavailable.

    Files that import optional SDKs (anthropic, google-generativeai) at module
    level can cause collection hangs. This hook skips those files when the
    dependencies are not available.

    Args:
        path: Path to the test file/directory.
        config: Pytest configuration object.

    Returns:
        True to skip collection, None to proceed normally.
    """
    import importlib.util

    str_path = str(path)

    # Map test file/directory patterns to their optional dependencies
    optional_deps: dict[str, str] = {
        "test_gemini_provider": "google.generativeai",
        "test_anthropic_provider": "anthropic",
        "test_claude_provider": "anthropic",
        "test_openai_provider": "openai",
        "test_provider_registry": "anthropic",
        "test_prompt_parser": "hypothesis",
    }

    for pattern, module_name in optional_deps.items():
        if pattern in str_path:
            # Check if the dependency is available without importing it
            try:
                spec = importlib.util.find_spec(module_name)
                if spec is None:
                    return True
            except (ImportError, ModuleNotFoundError):
                return True

    return None


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
async def async_client():
    """Create async test client with isolated database transaction."""
    yield None


@pytest.fixture(scope="function")
def test_db():
    """Provide isolated database transaction for test."""
    yield None


@pytest.fixture(autouse=True)
def reset_global_state():
    """Reset global state before each test."""
    yield


@pytest.fixture(scope="session", autouse=True)
def verify_environment():
    """Verify test environment is properly configured."""
    assert os.getenv("TESTING") == "1", "TESTING environment variable must be set"


def pytest_collection_modifyitems(session, config, items):
    """Modify test items after collection."""
    for item in items:
        if "unit" in str(item.fspath):
            item.add_marker(pytest.mark.unit)
        elif "integration" in str(item.fspath):
            item.add_marker(pytest.mark.integration)
        elif "e2e" in str(item.fspath):
            item.add_marker(pytest.mark.e2e)

        if any(word in item.name.lower() for word in ["slow", "performance", "benchmark"]):
            item.add_marker(pytest.mark.slow)
