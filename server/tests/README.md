# Test Suite Documentation

**Impetus Lock Server** - Comprehensive test suite documentation

## Overview

This test suite follows **Test-Driven Development (TDD)** principles as mandated by Article III of the project constitution. All tests are written using **pytest** with async support via **pytest-asyncio**.

### Key Principles

- **TDD First**: Write failing tests before implementation
- **P1 Coverage ≥80%**: Core features must have high test coverage
- **Fast Feedback**: Tests should run quickly for rapid iteration
- **Async-First**: Full support for async/await patterns throughout
- **Clean Isolation**: Each test is independent with proper cleanup

## Directory Structure

```
server/tests/
├── __init__.py                          # Package initialization
├── conftest.py                          # Shared pytest fixtures and configuration
│
├── fixtures/                            # Test data factories and fixtures
│   ├── __init__.py
│   └── factories/                       # Domain model factories
│       └── __init__.py
│
├── integration/                         # Integration tests (WIP)
│   └── __init__.py
│
├── unit/                                # Unit tests for infrastructure
│   ├── __init__.py
│   ├── test_style_comparison.py         # Style vector comparison logic
│   └── test_style_history_repository.py # Repository pattern tests
│
├── utils/                               # Test utilities and helpers
│   └── __init__.py
│
# Root-level test files (by functional domain):
├── test_main.py                         # Health endpoint tests
├── test_intervention_api.py            # API endpoint tests
├── test_intervention_service.py        # Business logic tests
├── test_claude_provider.py             # Anthropic Claude provider tests
├── test_gemini_provider.py             # Google Gemini provider tests
├── test_provider_registry.py           # LLM registry tests
├── test_security.py                    # Security layer tests
├── test_domain_models.py               # Domain model validation tests
├── test_tasks.py                       # Task management tests
├── test_style.py                       # Style analysis tests
├── test_loki_logic.py                  # Loki intervention logic tests
├── test_idempotency_cache.py           # Cache layer tests
├── test_database_fallback.py           # Fallback mechanism tests
├── test_prompt_parser.py               # Prompt parsing tests
├── test_prompt_templates.py            # Template rendering tests
├── test_logging_middleware.py          # Logging tests
├── test_metrics_endpoint.py            # Metrics API tests
├── test_tracing_helper.py              # Observability tests
├── test_observability_redaction.py     # PII redaction tests
```

## Running Tests

### Basic Commands

```bash
cd /mnt/d/Code/Impetus-Lock/server

# Run all tests
poetry run pytest tests/ -v --tb=short

# Run specific test file
poetry run pytest tests/test_main.py -v

# Run specific test function
poetry run pytest tests/test_main.py::test_health_endpoint_returns_200 -v

# Run tests matching pattern
poetry run pytest -k "health" -v

# Run with verbose output and full traceback
poetry run pytest -vv --tb=long
```

### Test Categories

#### 1. Unit Tests

```bash
# Run all unit tests
poetry run pytest tests/unit/ -v

# Run specific unit test
poetry run pytest tests/unit/test_style_history_repository.py -v
```

#### 2. Integration Tests

```bash
# Run all integration tests
poetry run pytest tests/integration/ -v
```

#### 3. Service/Domain Tests

```bash
# Run service layer tests
poetry run pytest tests/test_intervention_service.py -v

# Run domain model tests
poetry run pytest tests/test_domain_models.py -v
```

#### 4. Provider Tests

```bash
# Run LLM provider tests
poetry run pytest tests/test_claude_provider.py tests/test_gemini_provider.py -v

# Run provider registry tests
poetry run pytest tests/test_provider_registry.py -v
```

#### 5. Infrastructure Tests

```bash
# Run infrastructure tests
poetry run pytest tests/test_idempotency_cache.py tests/test_security.py -v
```

### Parallel Execution

The test suite supports parallel execution via **pytest-xdist**:

```bash
# Run tests in parallel (auto-detect CPU cores)
poetry run pytest tests/ -n auto

# Run with specific number of workers
poetry run pytest tests/ -n 4

# Run unit tests in parallel
poetry run pytest tests/unit -n auto

# Run with load balancing (distributes tests by execution time)
poetry run pytest tests/ -n auto --dist=loadfile
```

**Note**: Some tests use shared resources (in-memory caches) and may require sequential execution. Use `-n0` or `--forked` for such tests.

### Coverage Reporting

```bash
# Run with coverage
poetry run pytest tests/ --cov=server --cov-report=term-missing

# Generate HTML coverage report
poetry run pytest tests/ --cov=server --cov-report=html

# Generate XML coverage report (for CI)
poetry run pytest tests/ --cov=server --cov-report=xml

# View coverage report
open htmlcov/index.html  # macOS
xdg-open htmlcov/index.html  # Linux
```

### Watch Mode (Development)

```bash
# Install pytest-watch
poetry add -D pytest-watch

# Run in watch mode (re-run on file changes)
poetry run pytest-watch

# Or use built-in loop-on-fail
poetry run pytest --looponfail
```

## Fixture Usage Guide

### Available Fixtures

All fixtures are defined in `conftest.py`:

#### `setup_test_environment` (Session-scoped, autouse)

Automatically sets up test environment variables for all tests.

```python
# Automatically applied, no need to request
def test_something() -> None:
    # OPENAI_API_KEY is already set to "test-key-for-unit-tests"
    pass
```

#### `ensure_app_state` (Function-scoped, autouse)

Ensures shared `app.state` resources exist before each test.

```python
# Automatically applied
def test_with_app_state() -> None:
    # app.state.provider_registry and app.state.idempotency_cache are initialized
    pass
```

#### `anyio_backend`

Forces anyio to use asyncio backend (trio not installed).

```python
@pytest.mark.anyio
async def test_async_function() -> None:
    # Uses asyncio backend automatically
    pass
```

### Writing Custom Fixtures

```python
# tests/conftest.py or test file
import pytest
from unittest.mock import Mock

@pytest.fixture
def mock_llm_provider() -> Mock:
    """Create a mock LLM provider for testing."""
    mock = Mock(spec=LLMProvider)
    mock.generate_intervention.return_value = InterventionResponse(
        action="provoke",
        content="Test content",
        lock_id="test_lock_001",
        action_id="test_action_001",
        issued_at=datetime.now(UTC),
        source="muse",
    )
    return mock

@pytest.fixture
def intervention_service(mock_llm_provider: Mock) -> InterventionService:
    """Create InterventionService with mocked dependencies."""
    return InterventionService(llm_provider=mock_llm_provider)
```

### Using Fixtures in Tests

```python
def test_intervention_service(
    intervention_service: InterventionService,
    mock_llm_provider: Mock,
) -> None:
    """Test intervention service with mocked provider."""
    # Arrange
    request = InterventionRequest(context="Test", mode="muse")

    # Act
    response = intervention_service.generate_intervention(request)

    # Assert
    mock_llm_provider.generate_intervention.assert_called_once()
    assert response.action == "provoke"
```

## Mock Factory Examples

### Mocking LLM Providers

```python
from unittest.mock import Mock, patch
from server.infrastructure.llm.provider_registry import ProviderRegistry

@pytest.fixture
def mock_provider_registry() -> Mock:
    """Create mock provider registry."""
    registry = Mock(spec=ProviderRegistry)
    registry.get_provider.return_value = Mock(spec=LLMProvider)
    return registry

# Using patch
def test_with_patched_provider() -> None:
    with patch("server.application.services.intervention_service.ProviderRegistry") as mock:
        mock_instance = Mock()
        mock.return_value = mock_instance
        mock_instance.get_provider.return_value = Mock()

        # Test code here
        ...
```

### Mocking Database

```python
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

@pytest.fixture
async def async_session() -> AsyncGenerator[AsyncSession, None]:
    """Create async database session for tests."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async_session_maker = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session_maker() as session:
        yield session

    await engine.dispose()
```

### Mocking External APIs

```python
from unittest.mock import patch, AsyncMock

@pytest.mark.asyncio
async def test_api_call() -> None:
    """Test with mocked external API."""
    with patch("httpx.AsyncClient.post") as mock_post:
        mock_post.return_value = AsyncMock(
            status_code=200,
            json=AsyncMock(return_value={"result": "success"})
        )

        # Test code here
        response = await call_external_api()
        assert response["result"] == "success"
```

### Factory Pattern for Test Data

```python
# tests/fixtures/factories.py
from dataclasses import dataclass
from datetime import UTC, datetime

@dataclass
class InterventionRequestFactory:
    """Factory for creating test InterventionRequest objects."""

    @staticmethod
    def create(
        context: str = "Default test context",
        mode: str = "muse",
        doc_version: int = 1,
    ) -> InterventionRequest:
        return InterventionRequest(
            context=context,
            mode=mode,
            client_meta=ClientMeta(
                doc_version=doc_version,
                selection_from=0,
                selection_to=len(context),
            ),
        )

# Usage in tests
def test_with_factory() -> None:
    request = InterventionRequestFactory.create(
        context="Custom test context",
        mode="loki",
    )
    # Use request in test
```

## Troubleshooting

### Import Hangs During Test Collection

**Problem**: Tests hang during collection phase

**Solution**: Check for module-level imports that may trigger initialization:

```python
# ❌ BAD: Module-level import may hang
from server.api.main import app  # Can hang during collection

# ✅ GOOD: Import inside fixture or test
def test_something() -> None:
    from server.api.main import app  # Import at runtime
    ...
```

### Async Test Failures

**Problem**: `RuntimeError: Task attached to a different loop`

**Solution**: Ensure consistent event loop scope:

```python
# In conftest.py
@pytest.fixture(scope="function")
def anyio_backend() -> str:
    return "asyncio"

# In test
@pytest.mark.asyncio
async def test_async_function() -> None:
    # Use async/await normally
    pass
```

### Database Lock Issues

**Problem**: SQLite database locked errors in parallel tests

**Solution**: Use file-based SQLite or in-memory with proper isolation:

```python
# Use file-based SQLite for parallel tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"

# Or ensure proper cleanup
@pytest.fixture(autouse=True)
async def cleanup_db():
    yield
    # Cleanup after each test
    await clear_test_data()
```

### Test Isolation Issues

**Problem**: Tests pass individually but fail together

**Solution**: Check for shared state and use function-scoped fixtures:

```python
@pytest.fixture(autouse=True)
def reset_singletons():
    """Reset singleton instances between tests."""
    ProviderRegistry._instance = None
    yield
    ProviderRegistry._instance = None
```

### Coverage Not Capturing

**Problem**: Coverage report shows 0% for some files

**Solution**: Ensure all source files are imported:

```python
# In conftest.py or test file, force imports
import server.domain.models.intervention
import server.application.services.intervention_service
# etc.
```

### pytest-xdist Issues

**Problem**: Tests fail only when running in parallel

**Solution**:

1. Check for test order dependencies
2. Use file-level scope for shared resources
3. Add `--dist=loadfile` for better distribution:

```bash
poetry run pytest tests/ -n auto --dist=loadfile
```

## Test Configuration

### pytest.ini Options (from pyproject.toml)

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-v"
asyncio_mode = "auto"
asyncio_default_fixture_loop_scope = "function"
```

### Environment Variables

Tests automatically set these environment variables:

```python
OPENAI_API_KEY = "test-key-for-unit-tests"
LLM_DEFAULT_PROVIDER = "openai"
LLM_ALLOW_DEBUG_PROVIDER = "0"
TESTING = "1"
```

## Best Practices

### Test Naming

```python
# ✅ Good: Descriptive and specific
def test_locked_task_cannot_be_deleted_by_user() -> None:
    ...

# ❌ Bad: Too vague
def test_task() -> None:
    ...
```

### Test Structure (AAA Pattern)

```python
def test_example() -> None:
    """Test follows Arrange-Act-Assert pattern."""
    # Arrange
    input_data = "test input"
    expected = "test output"

    # Act
    result = process_data(input_data)

    # Assert
    assert result == expected
```

### Async Testing

```python
@pytest.mark.asyncio
async def test_async_operation() -> None:
    """Async tests require pytest-asyncio marker."""
    result = await async_function()
    assert result is not None
```

### Mock Verification

```python
def test_mock_calls(mock_provider: Mock) -> None:
    """Verify mock was called with expected arguments."""
    service = MyService(provider=mock_provider)
    service.do_something()

    # Verify call
    mock_provider.some_method.assert_called_once_with(
        arg1="expected",
        arg2="values",
    )
```

## Related Documentation

- [Style Guide](./STYLE_GUIDE.md) - Naming conventions and patterns
- [Server README](../README.md) - Project overview and API docs
- [TESTING.md](../../TESTING.md) - TDD workflow and best practices
- [CLAUDE.md](../../CLAUDE.md) - AI agent development guide

## Quick Reference Card

```bash
# Essential commands
cd server
poetry run pytest tests/ -v                    # Run all tests
poetry run pytest tests/ -n auto               # Run in parallel
poetry run pytest --cov=server                 # With coverage
poetry run pytest -k "health"                  # Filter by keyword
poetry run pytest --collect-only               # List all tests
poetry run pytest --tb=short                   # Short traceback
poetry run pytest -x                           # Stop on first failure
poetry run pytest --pdb                        # Debug on failure
```
