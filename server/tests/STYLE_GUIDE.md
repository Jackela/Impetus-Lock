# Test Style Guide

**Impetus Lock Server** - Conventions and patterns for writing tests

## Test Naming Conventions

### Test Files

```
test_<module_name>.py              # Test specific module
test_<feature>.py                  # Test feature (may span modules)
test_<layer>_<feature>.py          # With layer prefix (e.g., test_api_tasks.py)
test_<feature>_<aspect>.py         # Feature with aspect (e.g., test_security_auth.py)
```

**Examples**:

- `test_main.py` - Tests for `main.py`
- `test_intervention_service.py` - Service layer tests
- `test_claude_provider.py` - Provider-specific tests
- `test_security.py` - Security feature tests

### Test Functions

**Pattern**: `test_<behavior>_<condition>_<result>`

```python
# ✅ Good: Clear what is being tested
def test_locked_task_cannot_be_deleted_by_unauthorized_user():
    pass

def test_generate_intervention_returns_valid_response_with_muse_mode():
    pass

def test_provider_registry_raises_error_for_unknown_provider():
    pass

# ❌ Bad: Vague or unclear
def test_task():
    pass

def test_intervention():
    pass

def test_1():
    pass
```

### Test Classes

**Pattern**: `Test<ClassName>` or `Test<FeatureName>`

```python
class TestInterventionService:
    """Tests for InterventionService class."""
    pass

class TestTaskLock:
    """Tests for task lock functionality."""
    pass

class TestClaudeProvider:
    """Tests for Anthropic Claude provider."""
    pass
```

## File Organization Rules

### Directory Structure

```
tests/
├── conftest.py              # Shared fixtures (keep minimal)
├── __init__.py
│
├── fixtures/                # Test data factories
│   ├── __init__.py
│   └── factories.py         # Domain model factories
│
├── unit/                    # Unit tests (isolated, fast)
│   ├── __init__.py
│   ├── test_style_comparison.py
│   └── test_style_history_repository.py
│
├── integration/             # Integration tests (component interaction)
│   └── __init__.py
│
├── utils/                   # Test utilities
│   └── __init__.py
│
# Root-level tests by domain:
├── test_main.py             # Health endpoints
├── test_intervention_api.py # API endpoints
├── test_intervention_service.py  # Business logic
├── test_claude_provider.py  # LLM providers
├── test_gemini_provider.py
├── test_provider_registry.py
├── test_security.py         # Security layer
├── test_domain_models.py    # Domain validation
├── test_tasks.py            # Task management
└── test_style.py            # Style analysis
```

### Organization Principles

1. **Co-location**: Keep tests close to what they test
2. **Flat hierarchy**: Avoid deep nesting beyond 2 levels
3. **Domain grouping**: Group by feature/domain, not layer
4. **Test isolation**: Each test file should be runnable independently

### When to Create New Test File

Create a new file when:

- Testing a new module or component
- Feature has >20 tests (split into multiple files)
- Tests require special fixtures or setup
- Different testing approach needed (unit vs integration)

## Fixture Usage Patterns

### Fixture Scope Guidelines

```python
@pytest.fixture(scope="session")
def database_engine():
    """Session scope: Created once per test run.

    Use for: Database engines, expensive resources
    """
    engine = create_engine("sqlite:///:memory:")
    yield engine
    engine.dispose()

@pytest.fixture(scope="module")
def module_config():
    """Module scope: Created once per test module.

    Use for: Module-level configuration
    """
    return {"setting": "value"}

@pytest.fixture(scope="function")  # Default
def test_data():
    """Function scope: Created for each test.

    Use for: Test data, fresh state
    """
    return {"fresh": "data"}

@pytest.fixture(scope="function", autouse=True)
def reset_state():
    """Autouse: Automatically applied to all tests.

    Use for: Cleanup, global setup
    """
    yield
    # Cleanup code runs after each test
```

### Fixture Naming

```python
# ✅ Good: Descriptive names
@pytest.fixture
def mock_llm_provider():
    pass

@pytest.fixture
def intervention_request_factory():
    pass

@pytest.fixture
def async_db_session():
    pass

# ❌ Bad: Ambiguous names
@pytest.fixture
def mock():
    pass

@pytest.fixture
def data():
    pass

@pytest.fixture
def session():
    pass
```

### Fixture Composition

```python
@pytest.fixture
def base_request():
    """Base fixture."""
    return InterventionRequest(context="test")

@pytest.fixture
def muse_request(base_request):
    """Composed fixture extending base."""
    base_request.mode = "muse"
    return base_request

@pytest.fixture
def loki_request(base_request):
    """Another composed fixture."""
    base_request.mode = "loki"
    return base_request
```

### Factory Fixtures

```python
@pytest.fixture
def intervention_factory():
    """Factory fixture for creating test data."""
    class Factory:
        def create(self, **overrides):
            defaults = {
                "context": "test context",
                "mode": "muse",
            }
            defaults.update(overrides)
            return InterventionRequest(**defaults)

    return Factory()

# Usage
def test_with_factory(intervention_factory):
    request = intervention_factory.create(mode="loki")
```

## Mock Usage Guidelines

### When to Mock

**Mock these**:

- External APIs (LLM providers, third-party services)
- Database (for unit tests)
- File system operations
- Network calls
- Expensive operations

**Don't mock these**:

- Domain models (test the real thing)
- Simple value objects
- Internal utilities (unless expensive)
- Test fixtures themselves

### Mock Patterns

```python
from unittest.mock import Mock, patch, MagicMock

# 1. Basic Mock
mock_provider = Mock(spec=LLMProvider)
mock_provider.generate.return_value = response

# 2. Mock with spec (ensures attribute access is valid)
mock = Mock(spec=SomeClass)
mock.valid_attribute  # OK
mock.invalid_attribute  # Raises AttributeError

# 3. Mock with return value
mock_method = Mock(return_value=42)
result = mock_method()  # Returns 42

# 4. Mock with side effect
def side_effect(arg):
    if arg == "good":
        return "success"
    raise ValueError("bad")

mock_method = Mock(side_effect=side_effect)

# 5. Mock for async functions
from unittest.mock import AsyncMock
async_mock = AsyncMock(return_value={"result": "ok"})
result = await async_mock()  # Returns {"result": "ok"}
```

### Patch Patterns

```python
# 1. Patch function
with patch("module.function") as mock:
    mock.return_value = "mocked"
    result = function()  # Uses mock

# 2. Patch class
with patch("module.ClassName") as mock_class:
    mock_instance = Mock()
    mock_class.return_value = mock_instance
    obj = ClassName()  # Returns mock_instance

# 3. Patch object attribute
with patch.object(obj, "method") as mock_method:
    mock_method.return_value = 42
    result = obj.method()

# 4. Patch as decorator
@patch("module.function")
def test_with_patch(mock_function):
    mock_function.return_value = "mocked"
    # Test code

# 5. Multiple patches
@patch("module.func1")
@patch("module.func2")
def test_multiple_patches(mock2, mock1):
    # mock1 is for func1, mock2 is for func2
    pass

# 6. Patch with context manager
@pytest.fixture
def patched_service():
    with patch("module.Service") as mock:
        yield mock
```

### Mock Verification

```python
# 1. Assert called
mock_method.assert_called()

# 2. Assert called once
mock_method.assert_called_once()

# 3. Assert called with specific args
mock_method.assert_called_with(arg1="value1", arg2="value2")
mock_method.assert_called_once_with(arg1="value1")

# 4. Assert call count
assert mock_method.call_count == 3

# 5. Assert call args list
assert mock_method.call_args_list == [
    call("arg1"),
    call("arg2"),
]

# 6. Assert not called
mock_method.assert_not_called()

# 7. Async mock assertions
await async_mock()
async_mock.assert_awaited_once()
async_mock.assert_awaited_with("arg")
```

### Mock Best Practices

```python
# ✅ Good: Use spec to catch attribute errors
mock = Mock(spec=RealClass)

# ✅ Good: Clear mock between assertions
mock.reset_mock()

# ✅ Good: Use autospec for stricter checking
with patch("module.function", autospec=True) as mock:
    pass

# ❌ Bad: Over-mocking (mock everything)
# Tests become meaningless if everything is mocked

# ❌ Bad: Not verifying mock calls
mock_method()
# No assertion - we don't know if this was expected
```

## Parameterized Test Examples

### Basic Parameterization

```python
import pytest

@pytest.mark.parametrize(
    "input_val,expected",
    [
        ("hello", 5),
        ("world", 5),
        ("", 0),
    ],
)
def test_string_length(input_val: str, expected: int) -> None:
    """Test string length with multiple inputs."""
    assert len(input_val) == expected
```

### Parameterized with Fixtures

```python
@pytest.mark.parametrize(
    "mode",
    ["muse", "loki"],
)
def test_intervention_modes(mode: str, client: TestClient) -> None:
    """Test intervention with different modes."""
    response = client.post("/intervention", json={"mode": mode})
    assert response.status_code == 200
```

### Multiple Parameters

```python
@pytest.mark.parametrize(
    "context,mode,expected_action",
    [
        ("stuck writing", "muse", "provoke"),
        ("random text", "loki", "delete"),
        ("random text", "loki", "provoke"),
    ],
)
def test_intervention_response(
    context: str,
    mode: str,
    expected_action: str,
    service: InterventionService,
) -> None:
    """Test intervention with multiple parameter combinations."""
    result = service.generate_intervention(context=context, mode=mode)
    assert result.action in ["provoke", "delete"]
```

### Parameterized with IDs

```python
@pytest.mark.parametrize(
    "input_data,expected",
    [
        pytest.param("valid", True, id="valid_input"),
        pytest.param("invalid", False, id="invalid_input"),
        pytest.param("", False, id="empty_input"),
        pytest.param(None, False, id="none_input"),
    ],
)
def test_validation(input_data, expected):
    """Test with descriptive IDs for better output."""
    assert validate(input_data) is expected
```

### Conditional Parameterization

```python
import pytest

# Skip certain combinations
@pytest.mark.parametrize(
    "mode,provider",
    [
        ("muse", "openai"),
        ("muse", "anthropic"),
        pytest.param(
            "loki", "gemini",
            marks=pytest.mark.skip(reason="Gemini not supported for Loki")
        ),
    ],
)
def test_with_provider(mode: str, provider: str) -> None:
    pass
```

## Test Structure Patterns

### AAA Pattern (Arrange-Act-Assert)

```python
def test_example() -> None:
    """Follows Arrange-Act-Assert pattern."""
    # Arrange: Set up test conditions
    input_data = "test input"
    expected = "test output"
    service = MyService()

    # Act: Execute the behavior
    result = service.process(input_data)

    # Assert: Verify expected outcomes
    assert result == expected
```

### Given-When-Then (BDD Style)

```python
def test_user_can_lock_task() -> None:
    """User can lock a task to prevent deletion.

    Given: A user with an unlocked task
    When: The user locks the task
    Then: The task should be locked
    And: The task cannot be deleted
    """
    # Given
    task = create_task(locked=False)

    # When
    task.lock()

    # Then
    assert task.is_locked is True

    # And
    with pytest.raises(TaskLockedError):
        task.delete()
```

### Setup-Teardown Pattern

```python
class TestWithSetup:
    """Test class with setup and teardown."""

    @pytest.fixture(autouse=True)
    def setup_and_teardown(self):
        """Setup runs before each test, teardown after."""
        # Setup
        self.service = MyService()
        yield
        # Teardown
        self.service.cleanup()

    def test_something(self):
        """Test with automatic setup."""
        result = self.service.do_something()
        assert result is not None
```

## Assertion Patterns

### Basic Assertions

```python
# Equality
assert result == expected

# Inequality
assert result != unexpected

# Truthiness
assert result is True
assert result is not None

# Membership
assert item in collection
assert key in dictionary

# Exceptions
with pytest.raises(ValueError):
    function_that_raises()

with pytest.raises(ValueError, match="specific error message"):
    function_that_raises()

# Approximate equality (floats)
assert result == pytest.approx(3.14159, abs=0.001)
```

### Collection Assertions

```python
# Length
assert len(items) == 3

# Contains
assert any(item.name == "target" for item in items)

# All match condition
assert all(item.active for item in items)

# Specific items
assert items[0].id == "first"
assert "key" in dict_obj
```

### Complex Object Assertions

```python
# Using dataclass comparisons
from dataclasses import asdict

assert asdict(result) == asdict(expected)

# Partial matching
assert result.id == expected.id
assert result.name == expected.name
# Ignore timestamp fields

# Using helper functions
def assert_intervention_equals(actual, expected):
    assert actual.action == expected.action
    assert actual.content == expected.content
    # Ignore timestamps
```

## Code Style

### Imports

```python
# Standard library
from datetime import UTC, datetime
from unittest.mock import Mock, patch

# Third-party
import pytest
from fastapi.testclient import TestClient

# Local modules
from server.domain.models.intervention import InterventionRequest
from server.application.services.intervention_service import InterventionService
```

### Type Hints

```python
from typing import Any
from collections.abc import AsyncGenerator

def test_function(input_data: str) -> None:
    """Function with type hints."""
    pass

@pytest.fixture
def mock_provider() -> Mock:
    """Fixture with return type hint."""
    return Mock()

async def test_async() -> AsyncGenerator[None, None]:
    """Async test with generator hint."""
    yield
```

### Docstrings

```python
def test_behavior(self) -> None:
    """Test description in imperative mood.

    Additional details about the test scenario.
    Can span multiple lines for complex cases.

    Constitutional Compliance:
    - Article III: TDD requirement
    - Article V: Documentation requirement
    """
    pass

class TestFeature:
    """Test suite for Feature functionality.

    Groups related tests for the Feature class or module.
    """
    pass
```

## Common Anti-Patterns

```python
# ❌ Multiple unrelated assertions
def test_everything():
    assert user.name == "Test"
    assert task.title == "Task"
    assert service.is_ready  # Unrelated!

# ✅ Split into focused tests
def test_user_has_name():
    assert user.name == "Test"

def test_task_has_title():
    assert task.title == "Task"

# ❌ Test depends on other tests
def test_step1():
    global state
    state = "step1"

def test_step2():
    assert state == "step1"  # Depends on test_step1!

# ✅ Independent tests with proper setup
def test_feature_with_setup():
    state = setup_state()
    assert process(state) == "expected"

# ❌ Testing implementation details
def test_private_method():
    obj = MyClass()
    assert obj._internal_state == "value"  # Implementation detail!

# ✅ Test public behavior
def test_public_api():
    obj = MyClass()
    result = obj.public_method()
    assert result == "expected"

# ❌ Noisy tests (print statements)
def test_noisy():
    print("Starting test")  # Remove in committed code
    result = do_something()
    print(f"Result: {result}")  # Use -s flag if debugging
    assert result

# ✅ Clean tests
def test_clean():
    result = do_something()
    assert result
```

## Checklist for New Tests

Before submitting new tests, verify:

- [ ] Test name is descriptive (`test_<behavior>_<condition>_<result>`)
- [ ] Docstring explains what is being tested
- [ ] Follows AAA pattern (Arrange-Act-Assert)
- [ ] Uses appropriate fixtures
- [ ] Mocks external dependencies
- [ ] Asserts meaningful outcomes (not just `assert True`)
- [ ] Handles both success and failure cases
- [ ] Is independent of other tests
- [ ] Runs quickly (< 100ms for unit tests)
- [ ] Type hints are included
- [ ] Passes linting (`ruff check tests/`)

## Related Documentation

- [Tests README](./README.md) - Test suite overview
- [Testing Philosophy](./TESTING_PHILOSOPHY.md) - Testing approach
- [Constitutional Compliance](../CLAUDE.md) - Project principles
