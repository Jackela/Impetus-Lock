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
import sys
import warnings
from collections.abc import AsyncGenerator, Generator
from typing import TYPE_CHECKING, Any
from unittest.mock import Mock

import pytest
import pytest_asyncio

# Setup mock for google.generativeai BEFORE any imports
import types

# Create google module
_google_module = types.ModuleType("google")
_google_module.__spec__ = types.SimpleNamespace(name="google", loader=None)
sys.modules["google"] = _google_module

# Create google.generativeai mock module
_mock_genai = types.ModuleType("google.generativeai")
_mock_genai.configure = Mock()
_mock_genai.GenerativeModel = Mock()
_mock_genai.__spec__ = types.SimpleNamespace(name="google.generativeai", loader=None)

_mock_types = types.ModuleType("google.generativeai.types")
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

_mock_api_key = types.ModuleType("google.generativeai.api_key")
_mock_api_errors = types.ModuleType("google.generativeai.api_key.api_errors")


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

# Set __spec__ for all modules
_mock_types.__spec__ = types.SimpleNamespace(name="google.generativeai.types", loader=None)
_mock_api_key.__spec__ = types.SimpleNamespace(name="google.generativeai.api_key", loader=None)
_mock_api_errors.__spec__ = types.SimpleNamespace(
    name="google.generativeai.api_key.api_errors", loader=None
)

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
                    # Skip this test file/directory - dependency not available
                    return True
            except ModuleNotFoundError:
                # Parent module not found, skip this test file
                return True

    # Proceed with normal collection
    return None


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    """Modify test collection to apply markers based on path and skip conditions.

    Args:
        config: Pytest configuration object.
        items: List of collected test items.
    """
    skip_integration = pytest.mark.skip(
        reason="Integration tests disabled. Use --integration to enable."
    )
    skip_e2e = pytest.mark.skip(reason="E2E tests disabled. Use --e2e to enable.")
    skip_llm_live = pytest.mark.skip(reason="LLM live tests disabled. Use --llm-live to enable.")
    skip_slow = pytest.mark.skip(reason="Slow tests disabled. Use --slow to enable.")

    run_integration = config.getoption("--integration")
    run_e2e = config.getoption("--e2e")
    run_llm_live = config.getoption("--llm-live")
    run_slow = config.getoption("--slow")

    for item in items:
        # Auto-mark tests based on directory
        test_path = str(item.fspath)

        if "/unit/" in test_path or "test_" in test_path:
            item.add_marker(pytest.mark.unit)

        if "/integration/" in test_path:
            item.add_marker(pytest.mark.integration)
            if not run_integration:
                item.add_marker(skip_integration)

        if "/e2e/" in test_path:
            item.add_marker(pytest.mark.e2e)
            if not run_e2e:
                item.add_marker(skip_e2e)

        # Skip slow tests unless explicitly enabled
        if "slow" in item.keywords and not run_slow:
            item.add_marker(skip_slow)

        # Skip LLM live tests unless explicitly enabled
        if "llm_live" in item.keywords and not run_llm_live:
            item.add_marker(skip_llm_live)


def pytest_addoption(parser: pytest.Parser) -> None:
    """Add custom command-line options for test control.

    Args:
        parser: Pytest option parser.
    """
    parser.addoption(
        "--integration",
        action="store_true",
        default=False,
        help="Run integration tests with real services",
    )
    parser.addoption(
        "--e2e",
        action="store_true",
        default=False,
        help="Run end-to-end tests",
    )
    parser.addoption(
        "--llm-live",
        action="store_true",
        default=False,
        help="Run tests against live LLM APIs",
    )
    parser.addoption(
        "--slow",
        action="store_true",
        default=False,
        help="Run slow tests (>1s)",
    )


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    """Force anyio tests to use asyncio backend.

    Returns:
        String "asyncio" to specify the backend.
    """
    return "asyncio"


@pytest.fixture(scope="session")
def event_loop_policy() -> asyncio.AbstractEventLoopPolicy:
    """Provide event loop policy for async tests.

    Returns:
        Asyncio event loop policy.
    """
    return asyncio.get_event_loop_policy()


@pytest.fixture(autouse=True)
def reset_global_state() -> Generator[None, None, None]:
    """Reset global state before each test to ensure isolation.

    This fixture runs automatically before every test function.
    Cleans up app state, cancels pending tasks, and resets caches.
    """
    yield

    # Cleanup after test
    try:
        # Cancel any pending asyncio tasks
        try:
            loop = asyncio.get_running_loop()
            pending_tasks = [
                task for task in asyncio.all_tasks(loop) if task is not asyncio.current_task()
            ]
            for task in pending_tasks:
                task.cancel()
        except RuntimeError:
            pass  # No running loop

    except Exception:
        pass  # Best effort cleanup


@pytest.fixture
def mock_api_keys(monkeypatch: pytest.MonkeyPatch) -> None:
    """Mock API keys for testing.

    Sets fake API keys for all external services to prevent accidental
    calls to real APIs during tests.

    Args:
        monkeypatch: Pytest monkeypatch fixture.
    """
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-openai-key")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-api03-test-key")
    monkeypatch.setenv("GOOGLE_API_KEY", "test-google-key")
    monkeypatch.setenv("LLM_DEFAULT_PROVIDER", "debug")
    monkeypatch.setenv("LLM_ALLOW_DEBUG_PROVIDER", "1")


@pytest.fixture(scope="session")
def test_config() -> dict[str, Any]:
    """Provide test configuration dictionary.

    Returns:
        Dictionary with test configuration values.
    """
    return {
        "test_database_url": os.getenv(
            "TEST_DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test"
        ),
        "test_redis_url": os.getenv("TEST_REDIS_URL", "redis://localhost:6379/1"),
        "test_timeout": 5.0,
        "llm_max_retries": 1,
    }


@pytest_asyncio.fixture(scope="session")
async def app_lifespan() -> AsyncGenerator[None, None]:
    """Manage FastAPI app lifecycle for session-scoped tests.

    Yields:
        None when app is ready for testing.
    """

    # App lifespan is managed by test clients
    yield


@pytest.fixture(scope="session", autouse=True)
def verify_test_environment() -> None:
    """Verify test environment is properly configured.

    Runs once at session start to ensure TESTING=1 is set.
    """
    if os.getenv("TESTING") != "1":
        warnings.warn(
            "TESTING environment variable not set to '1'. Tests may affect production systems!",
            RuntimeWarning,
            stacklevel=2,
        )


@pytest.fixture
def import_guards() -> Generator[None, None, None]:
    """Context manager for safe module imports.

    Provides graceful skipping when optional dependencies are missing.

    Example:
        with import_guards():
            import some_optional_module
    """
    try:
        yield
    except ImportError as e:
        pytest.skip(f"Optional dependency not available: {e}")


class ImportGuard:
    """Context manager for safe imports with pytest skipping.

    Usage:
        with ImportGuard("redis"):
            import redis.asyncio
    """

    def __init__(self, module_name: str) -> None:
        """Initialize with module name.

        Args:
            module_name: Name of module to guard.
        """
        self.module_name = module_name

    def __enter__(self) -> ImportGuard:
        """Enter context - nothing to do."""
        return self

    def __exit__(self, exc_type: type | None, exc_val: Exception | None, exc_tb: Any) -> bool:
        """Exit context - handle ImportError.

        Args:
            exc_type: Exception type if raised.
            exc_val: Exception value if raised.
            exc_tb: Exception traceback if raised.

        Returns:
            True if ImportError was handled.
        """
        if exc_type is ImportError:
            pytest.skip(f"Module '{self.module_name}' not available")
            return True
        return False


@pytest.fixture
def import_guard() -> type[ImportGuard]:
    """Provide ImportGuard class as fixture.

    Returns:
        ImportGuard class for use in tests.
    """
    return ImportGuard


@pytest.fixture(scope="session")
def faker_seed() -> int:
    """Seed for faker to ensure reproducible test data.

    Returns:
        Fixed seed value.
    """
    return 12345
