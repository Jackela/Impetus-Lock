# Testing Philosophy & Best Practices

**Impetus Lock Server** - Comprehensive testing guide

## Testing Philosophy

### Test-Driven Development (TDD)

Following **Article III** of the project constitution, we practice strict TDD:

1. **Red**: Write a failing test first
2. **Green**: Write minimal code to pass
3. **Refactor**: Improve while keeping tests green

### Test Pyramid

```
       /\
      /  \
     / E2E \      <- Few tests, full system (Playwright)
    /--------\
   /Integration\   <- Some tests, component interactions
  /--------------\
 /    Unit Tests   \ <- Many tests, isolated logic (pytest)
/--------------------\
```

**Distribution Guidelines**:

- **Unit Tests (70%)**: Business logic, domain models, utilities
- **Integration Tests (20%)**: API endpoints, database operations
- **E2E Tests (10%)**: Critical user flows (Playwright in client/)

## Test Categories

### 1. Unit Tests

Test isolated units of code without external dependencies.

**Location**: `tests/unit/`

**Characteristics**:

- Fast execution (< 100ms per test)
- No I/O operations
- Mocked dependencies
- Deterministic results

**Examples**:

```python
# tests/unit/test_style_comparison.py
def test_style_vectors_are_similar() -> None:
    """Test vector similarity calculation."""
    vec1 = {"tone": 0.8, "formality": 0.6}
    vec2 = {"tone": 0.82, "formality": 0.61}

    assert are_similar(vec1, vec2, threshold=0.1) is True
```

### 2. Integration Tests

Test component interactions with real dependencies.

**Location**: `tests/integration/`

**Characteristics**:

- Moderate execution time (< 1s per test)
- Real database connections (in-memory)
- Real API calls (mocked external)
- Test data flow between layers

**Examples**:

```python
# tests/test_intervention_api.py
@pytest.mark.asyncio
async def test_generate_intervention_endpoint(client: AsyncClient) -> None:
    """Test API endpoint with real service layer."""
    response = await client.post(
        "/impetus/generate-intervention",
        json={
            "context": "Test context",
            "mode": "muse",
            "doc_version": 1,
        },
    )

    assert response.status_code == 200
    assert "action" in response.json()
```

### 3. Service Tests

Test business logic layer with mocked infrastructure.

**Location**: `tests/test_*_service.py`

**Characteristics**:

- Test business rules
- Mocked LLM providers
- Mocked repositories
- Test error handling

**Examples**:

```python
# tests/test_intervention_service.py
def test_service_delegates_to_llm_provider(
    service: InterventionService,
    mock_provider: Mock,
) -> None:
    """Test that service properly delegates to provider."""
    request = create_test_request()

    service.generate_intervention(request)

    mock_provider.generate_intervention.assert_called_once()
```

## Writing New Tests

### Test File Structure

```python
"""Module docstring explaining test purpose.

Constitutional Compliance:
- Article III (TDD): Tests written before implementation
- Article V (Documentation): Complete test documentation
"""

import pytest
from unittest.mock import Mock

# Imports from tested module
from server.domain.models.intervention import InterventionRequest

# Test class for grouping related tests
class TestFeatureName:
    """Test suite for FeatureName functionality."""

    @pytest.fixture
    def dependency(self) -> Mock:
        """Create mocked dependency."""
        return Mock()

    @pytest.fixture
    def test_data(self) -> dict:
        """Provide test data."""
        return {"key": "value"}

    def test_specific_behavior(self, dependency: Mock) -> None:
        """Test that specific behavior works correctly.

        Arrange: Set up test conditions
        Act: Execute the behavior
        Assert: Verify expected outcomes
        """
        # Arrange
        input_data = "test"

        # Act
        result = process(input_data)

        # Assert
        assert result == "expected"
```

### Naming Conventions

**Test Files**:

- `test_<module_name>.py` - Test corresponding module
- `test_<feature>_service.py` - Service layer tests
- `test_<feature>_api.py` - API endpoint tests

**Test Functions**:

- `test_<behavior>_<condition>_<result>()`
- Example: `test_locked_task_cannot_be_deleted()`

**Test Classes**:

- `Test<ClassName>` or `Test<FeatureName>`
- Example: `TestInterventionService`

### Docstring Format

```python
def test_behavior(self) -> None:
    """Test description in present tense.

    More details about what is being tested.
    Can include multiple lines for complex scenarios.

    Constitutional Compliance:
    - Article III: TDD requirement met
    """
    pass
```

## Async Testing Best Practices

### Basic Async Test

```python
import pytest

@pytest.mark.asyncio
async def test_async_function() -> None:
    """Test async function properly."""
    result = await async_operation()
    assert result is not None
```

### Async Fixtures

```python
import pytest
from collections.abc import AsyncGenerator

@pytest.fixture
async def async_resource() -> AsyncGenerator[Resource, None]:
    """Create async resource for tests."""
    resource = await Resource.create()
    yield resource
    await resource.cleanup()
```

### Testing Async Context Managers

```python
@pytest.mark.asyncio
async def test_async_context_manager() -> None:
    """Test async context manager."""
    async with DatabaseConnection() as conn:
        result = await conn.query("SELECT 1")
        assert result == 1
```

### Mocking Async Functions

```python
from unittest.mock import AsyncMock

@pytest.mark.asyncio
async def test_with_async_mock() -> None:
    """Test with mocked async dependency."""
    mock_service = AsyncMock()
    mock_service.fetch_data.return_value = {"key": "value"}

    result = await process_with_service(mock_service)

    mock_service.fetch_data.assert_awaited_once()
    assert result["key"] == "value"
```

### Avoiding Event Loop Issues

```python
# ❌ BAD: Creating new event loop
def test_bad() -> None:
    import asyncio
    loop = asyncio.new_event_loop()
    result = loop.run_until_complete(async_func())

# ✅ GOOD: Using pytest-asyncio
@pytest.mark.asyncio
async def test_good() -> None:
    result = await async_func()
```

### Testing Concurrent Operations

```python
import asyncio
import pytest

@pytest.mark.asyncio
async def test_concurrent_access() -> None:
    """Test concurrent operations are safe."""
    cache = AsyncIdempotencyCache()

    async def write_value(key: str, value: str) -> None:
        await cache.set(key, value)

    # Run multiple operations concurrently
    await asyncio.gather(
        write_value("key1", "value1"),
        write_value("key2", "value2"),
        write_value("key3", "value3"),
    )

    assert await cache.get("key1") == "value1"
    assert await cache.get("key2") == "value2"
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install Poetry
        uses: snok/install-poetry@v1

      - name: Install dependencies
        run: |
          cd server
          poetry install

      - name: Run tests
        run: |
          cd server
          poetry run pytest tests/ -v --tb=short

      - name: Run tests with coverage
        run: |
          cd server
          poetry run pytest tests/ --cov=server --cov-report=xml

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./server/coverage.xml
```

### Local CI Testing (Act)

```bash
# Install act
brew install act  # macOS
curl -s https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash  # Linux

# Run all jobs
act

# Run specific job
act -j backend-tests

# Run with verbose output
act -v
```

### Pre-commit Hooks

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: pytest
        name: pytest
        entry: cd server && poetry run pytest tests/ -x -q
        language: system
        pass_filenames: false
        always_run: true
```

## Coverage Requirements

### P1 Features (≥80% Coverage)

Core features that must have high coverage:

- Task lock/unlock functionality
- AI intervention generation
- LLM provider implementations
- Security authentication/authorization
- Domain model validation

### Coverage Reports

```bash
# Generate coverage report
cd server
poetry run pytest tests/ --cov=server --cov-report=term-missing

# Example output:
# Name                                     Stmts   Miss  Cover   Missing
# ----------------------------------------------------------------------
# server/domain/models/intervention.py        45      3    93%   102-104
# server/application/services/intervention_service.py  89      5    94%   156-160
# ----------------------------------------------------------------------
# TOTAL                                      650     45    93%
```

### Excluding Code from Coverage

```python
# Code that's not testable or not worth testing
def debug_helper():  # pragma: no cover
    """Debug function - not tested."""
    print("Debug info")

# Or in pyproject.toml:
[tool.coverage.run]
omit = [
    "*/tests/*",
    "server/infrastructure/observability/metrics.py",
]
```

## Test Data Management

### Factories Pattern

```python
# tests/fixtures/factories.py
class TaskFactory:
    """Factory for creating test tasks."""

    _counter = 0

    @classmethod
    def create(
        cls,
        title: str | None = None,
        locked: bool = False,
    ) -> Task:
        cls._counter += 1
        return Task(
            id=f"task_{cls._counter}",
            title=title or f"Test Task {cls._counter}",
            locked=locked,
        )

# Usage
@pytest.fixture
def sample_task() -> Task:
    return TaskFactory.create(title="Sample", locked=True)
```

### Parameterized Tests

```python
import pytest

@pytest.mark.parametrize(
    "mode,expected_action",
    [
        ("muse", "provoke"),
        ("loki", "delete"),
        ("loki", "provoke"),
    ],
)
def test_intervention_modes(mode: str, expected_action: str) -> None:
    """Test different intervention modes."""
    result = generate_intervention(mode=mode)
    assert result.action in ["provoke", "delete"]
```

## Debugging Tests

### Verbose Output

```bash
# Show print statements
poetry run pytest -s

# Show full diffs on assertion failure
poetry run pytest -vv

# Show locals on failure
poetry run pytest --showlocals

# Enter debugger on failure
poetry run pytest --pdb

# Stop on first failure
poetry run pytest -x
```

### IDE Integration

**VS Code** (`launch.json`):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Python: pytest",
      "type": "debugpy",
      "request": "launch",
      "module": "pytest",
      "args": ["tests/", "-v", "-k", "test_name"],
      "console": "integratedTerminal",
      "cwd": "${workspaceFolder}/server"
    }
  ]
}
```

**PyCharm**:

- Right-click test → Run 'pytest in test\_...'
- Set breakpoint in test code
- Debug → Run

## Related Documentation

- [Tests README](./tests/README.md) - Test suite overview
- [Style Guide](./tests/STYLE_GUIDE.md) - Naming and organization
- [CLAUDE.md](./CLAUDE.md) - AI development guide
- [TESTING.md](./TESTING.md) - TDD workflow guide

## Quick Command Reference

```bash
cd /mnt/d/Code/Impetus-Lock/server

# Run tests
poetry run pytest tests/ -v

# Run with coverage
poetry run pytest tests/ --cov=server --cov-report=html

# Run in parallel
poetry run pytest tests/ -n auto

# Run specific category
poetry run pytest tests/unit/ -v
poetry run pytest tests/integration/ -v

# Debug
poetry run pytest --pdb -x

# Watch mode
poetry run pytest-watch
```
