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
import importlib.util
import os
import sys
import types
import warnings
from collections.abc import AsyncGenerator, Generator
from typing import TYPE_CHECKING, Any
from unittest.mock import Mock

import pytest
import pytest_asyncio

# Setup mock for google.generativeai BEFORE any imports
# This ensures the mock is in place when the provider imports google.generativeai


def _create_mock_module(name: str) -> types.ModuleType:
    """Create a mock module with proper __spec__ for Python 3.11+ compatibility."""
    module = types.ModuleType(name)
    # Create a proper ModuleSpec
    spec = importlib.util.spec_from_loader(name, loader=None)
    module.__spec__ = spec
    return module


# Create google module
_google_module = _create_mock_module("google")
sys.modules["google"] = _google_module

# Create google.generativeai mock module
_mock_genai = _create_mock_module("google.generativeai")
_mock_genai.configure = Mock()
_mock_genai.GenerativeModel = Mock()

_mock_types = _create_mock_module("google.generativeai.types")
_mock_types.HarmCategory = Mock()
_mock_types.HarmCategory.HARM_CATEGORY_HARASSMENT = "HARM_CATEGORY_HARASSMENT"
_mock_types.HarmCategory.HARM_CATEGORY_HATE_SPEECH = "HARM_CATEGORY_HATE_SPEECH"
_mock_types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT = "HARM_CATEGORY_SEXUALLY_EXPLICIT"
_mock_types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT = "HARM_CATEGORY_DANGEROUS_CONTENT"
_mock_types.HarmBlockThreshold = Mock()
_mock_types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE = "BLOCK_MEDIUM_AND_ABOVE"
_mock_types.HarmBlockThreshold.BLOCK_ONLY_HIGH = "BLOCK_ONLY_HIGH"


class _BlockedPromptException(Exception):
    pass


class _StopCandidateException(Exception):
    pass


class _InvalidArgument(Exception):
    pass


_mock_types.BlockedPromptException = _BlockedPromptException
_mock_types.StopCandidateException = _StopCandidateException
_mock_types.InvalidArgument = _InvalidArgument
_mock_genai.types = _mock_types

_mock_api_key = _create_mock_module("google.generativeai.api_key")
_mock_api_errors = _create_mock_module("google.generativeai.api_key.api_errors")


class _InvalidAPIKeyError(Exception):
    pass


class _PermissionDeniedError(Exception):
    pass


class _ResourceExhaustedError(Exception):
    pass


class _InternalServerError(Exception):
    pass


class _UnavailableError(Exception):
    pass


_mock_api_errors.InvalidAPIKeyError = _InvalidAPIKeyError
_mock_api_errors.PermissionDeniedError = _PermissionDeniedError
_mock_api_errors.ResourceExhaustedError = _ResourceExhaustedError
_mock_api_errors.InternalServerError = _InternalServerError
_mock_api_errors.UnavailableError = _UnavailableError
_mock_api_key.api_errors = _mock_api_errors
_mock_genai.api_key = _mock_api_key

# Register modules
sys.modules["google.generativeai"] = _mock_genai
sys.modules["google.generativeai.types"] = _mock_types
sys.modules["google.generativeai.api_key"] = _mock_api_key
sys.modules["google.generativeai.api_key.api_errors"] = _mock_api_errors

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

    # Also skip the unit/infrastructure/llm directory entirely during collection
    # if google.generativeai is not available
    if "unit/infrastructure/llm" in str_path or "tests/unit/infrastructure/llm" in str_path:
        try:
            spec = importlib.util.find_spec("google.generativeai")
            if spec is None:
                return True
        except (ImportError, ModuleNotFoundError):
            return True

    return None


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create an instance of the default event loop for the test session.

    Yields:
        asyncio.AbstractEventLoop: The event loop instance.
    """
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
async def async_client() -> AsyncGenerator[Any, None]:
    """Create async test client with isolated database transaction.

    Yields:
        AsyncClient: Configured async test client.
    """
    # This fixture would typically set up an async HTTP client
    # Implementation depends on your testing framework (httpx, aiohttp, etc.)
    yield None


@pytest.fixture(scope="function")
def test_db() -> Generator[Any, None, None]:
    """Provide isolated database transaction for test.

    Yields:
        Database session: Configured database session.
    """
    # This fixture would typically set up a test database
    # Implementation depends on your database setup
    yield None


@pytest.fixture(autouse=True)
def reset_global_state() -> Generator[None, None, None]:
    """Reset global state before each test.

    This ensures test isolation by clearing any global caches or state
    that might persist between tests.
    """
    yield
    # Reset any global state here if needed


@pytest.fixture(scope="session", autouse=True)
def verify_environment() -> None:
    """Verify test environment is properly configured."""
    # Verify TESTING mode is set
    assert os.getenv("TESTING") == "1", "TESTING environment variable must be set"


# Pytest hooks for test execution


def pytest_runtest_setup(item: pytest.Item) -> None:
    """Setup hook called before each test.

    Args:
        item: The test item being executed.
    """
    # Add any pre-test setup here
    pass


def pytest_runtest_teardown(item: pytest.Item, nextitem: pytest.Item | None) -> None:
    """Teardown hook called after each test.

    Args:
        item: The test item that was executed.
        nextitem: The next test item to be executed (if any).
    """
    # Add any post-test cleanup here
    pass


# Custom test outcome markers


def pytest_report_teststatus(
    report: pytest.TestReport,
    config: pytest.Config,
) -> tuple[str, str, str] | None:
    """Customize test status reporting.

    Args:
        report: The test report.
        config: Pytest configuration.

    Returns:
        Tuple of (category, shortletter, word) or None for default behavior.
    """
    # Customize test status output if needed
    return None


# Performance and timing hooks


def pytest_benchmark_stats(config: pytest.Config, benchmark_name: str) -> None:
    """Hook for benchmark statistics.

    Args:
        config: Pytest configuration.
        benchmark_name: Name of the benchmark.
    """
    # Collect benchmark statistics if needed
    pass


# Coverage hooks (if using pytest-cov)


def pytest_cov_modify_data(cov_data: Any, config: pytest.Config) -> None:
    """Modify coverage data before reporting.

    Args:
        cov_data: Coverage data object.
        config: Pytest configuration.
    """
    # Modify coverage data if needed (e.g., exclude certain paths)
    pass


# Test collection hooks


def pytest_collection_modifyitems(
    session: pytest.Session, config: pytest.Config, items: list[pytest.Item]
) -> None:
    """Modify test items after collection.

    Args:
        session: Pytest session.
        config: Pytest configuration.
        items: List of collected test items.
    """
    # Add markers based on test location
    for item in items:
        # Mark tests in specific directories
        if "unit" in str(item.fspath):
            item.add_marker(pytest.mark.unit)
        elif "integration" in str(item.fspath):
            item.add_marker(pytest.mark.integration)
        elif "e2e" in str(item.fspath):
            item.add_marker(pytest.mark.e2e)

        # Mark slow tests based on name
        if any(word in item.name.lower() for word in ["slow", "performance", "benchmark"]):
            item.add_marker(pytest.mark.slow)


# Session-level fixtures


@pytest.fixture(scope="session")
def test_cache_dir(tmp_path_factory: pytest.TempPathFactory) -> Any:
    """Provide a temporary directory for test cache.

    Args:
        tmp_path_factory: Pytest temporary path factory.

    Returns:
        Path: Temporary directory path.
    """
    return tmp_path_factory.mktemp("test_cache")


@pytest.fixture(scope="session")
def test_data_dir() -> Any:
    """Provide path to test data directory.

    Returns:
        Path: Test data directory path.
    """
    import pathlib

    return pathlib.Path(__file__).parent / "data"


# Warning filters


warnings.filterwarnings(
    "ignore",
    category=DeprecationWarning,
    message=".*deprecated.*",
)

# Async fixtures


@pytest_asyncio.fixture(scope="function")
async def async_db_session() -> AsyncGenerator[Any, None]:
    """Provide async database session for tests.

    Yields:
        AsyncSession: Database session.
    """
    # This would typically create an async database session
    # Implementation depends on your ORM (SQLAlchemy, Tortoise, etc.)
    yield None


@pytest.fixture(scope="function")
def mock_llm_response() -> Mock:
    """Provide mock LLM response for testing.

    Returns:
        Mock: Configured mock response.
    """
    mock = Mock()
    mock.text = '{"action": "provoke", "content": "Test intervention"}'
    mock.candidates = [mock]
    return mock


@pytest.fixture(scope="function")
def mock_task_context() -> dict[str, Any]:
    """Provide mock task context for testing.

    Returns:
        dict: Mock task context.
    """
    return {
        "task_id": "test-task-123",
        "content": "Test task content",
        "user_id": "test-user-456",
    }


# Export commonly used fixtures
__all__ = [
    "event_loop",
    "async_client",
    "test_db",
    "test_cache_dir",
    "test_data_dir",
    "mock_llm_response",
    "mock_task_context",
]
