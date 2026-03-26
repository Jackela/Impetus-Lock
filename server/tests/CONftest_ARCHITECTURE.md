# Hierarchical conftest.py Architecture

## Overview

Comprehensive pytest configuration for the Impetus Lock test suite with hierarchical fixture organization.

## File Structure

```
server/tests/
├── conftest.py              # Root configuration
├── unit/
│   ├── __init__.py
│   └── conftest.py          # Unit test fixtures
├── integration/
│   ├── __init__.py
│   └── conftest.py          # Integration test fixtures
└── e2e/
    ├── __init__.py
    └── conftest.py          # E2E test fixtures (placeholder)
```

## Root conftest.py Features

### Environment Setup

- **TESTING=1**: Forces testing mode before any imports
- **API Keys**: Sets fake API keys for all LLM providers
- **Default Provider**: Uses 'debug' provider for safe testing

### Custom Markers

```python
@pytest.mark.unit        # Fast isolated tests (<100ms)
@pytest.mark.integration # Tests with database/services
@pytest.mark.e2e         # End-to-end tests
@pytest.mark.slow        # Tests taking >1 second
@pytest.mark.llm_live    # Tests requiring live LLM APIs
```

### Command Line Options

```bash
pytest --integration     # Run integration tests
pytest --e2e            # Run E2E tests
pytest --llm-live       # Run live LLM tests
pytest --slow           # Run slow tests
```

### Key Fixtures

| Fixture              | Scope    | Description                        |
| -------------------- | -------- | ---------------------------------- |
| `anyio_backend`      | session  | Force asyncio backend              |
| `reset_global_state` | function | Autouse cleanup after each test    |
| `mock_api_keys`      | function | Mock all external API keys         |
| `test_config`        | session  | Test configuration dictionary      |
| `import_guard`       | function | ImportGuard class for safe imports |

## Unit conftest.py Features

### Domain Model Factories

#### intervention_response_factory

```python
factory = intervention_response_factory
response = factory.provoke(content="Test", anchor_from=100)
response = factory.delete(anchor_from=100, anchor_to=150)
response = factory.rewrite(content="New text", anchor_from=100, anchor_to=150)
```

#### muse_request_factory / loki_request_factory

```python
request = muse_request_factory.create(context="...", doc_version=42)
request = loki_request_factory.create(context="...", doc_version=10)
```

### Mock Factories

#### mock_anthropic_response_factory

```python
factory = mock_anthropic_response_factory
response = factory.provoke(content="...")
response = factory.rewrite(content="...")
response = factory.delete(anchor_from=100, anchor_to=150)
error = factory.error_rate_limit()
error = factory.error_auth()
```

### All Unit Fixtures

| Fixture                           | Description                           |
| --------------------------------- | ------------------------------------- |
| `intervention_response_factory`   | Create InterventionResponse instances |
| `muse_request_factory`            | Create Muse mode requests             |
| `loki_request_factory`            | Create Loki mode requests             |
| `mock_llm_provider`               | Mock LLMProvider                      |
| `mock_claude_provider`            | Mock ClaudeProvider                   |
| `mock_anthropic_response_factory` | Mock Anthropic API responses          |
| `mock_intervention_service`       | Mock InterventionService              |
| `client_meta_factory`             | Create ClientMeta instances           |
| `anchor_factory`                  | Create AnchorPos/AnchorRange          |
| `task_repository_mock`            | Mock TaskRepository                   |
| `in_memory_task_repository`       | Real InMemoryTaskRepository           |

## Integration conftest.py Features

### Database Fixtures

#### db_engine (session scope)

```python
# Creates async SQLite in-memory engine
engine = await db_engine
```

#### db_session (function scope)

```python
# Fresh transaction per test, auto-rollback
session = await db_session
```

#### db_session_with_cleanup (function scope)

```python
# Explicit table cleanup after test
session = await db_session_with_cleanup
```

### API Client Fixtures

#### api_client

```python
# FastAPI test client with database dependency override
async with api_client as client:
    response = await client.get("/health")
```

#### api_client_no_db

```python
# Test client with in-memory repository
async with api_client_no_db as client:
    response = await client.get("/health")
```

### All Integration Fixtures

| Fixture                        | Scope    | Description                     |
| ------------------------------ | -------- | ------------------------------- |
| `db_engine`                    | session  | Async database engine           |
| `db_session`                   | function | Database session with rollback  |
| `db_session_with_cleanup`      | function | Session with explicit cleanup   |
| `api_client`                   | function | HTTP client with DB override    |
| `api_client_no_db`             | function | HTTP client with in-memory repo |
| `mock_redis`                   | function | Mock Redis client               |
| `redis_mock_client`            | function | Async mock Redis                |
| `mock_idempotency_cache`       | function | Mock AsyncIdempotencyCache      |
| `mock_provider_registry`       | function | Mock ProviderRegistry           |
| `intervention_service_with_db` | function | Service with DB repository      |
| `mock_anthropic_client`        | function | Mock Anthropic client           |
| `mock_openai_client`           | function | Mock OpenAI client              |

## E2E conftest.py Features (Placeholder)

E2E fixtures are ready for implementation:

- Production-like environment setup
- Full app lifecycle management
- Browser automation support (Playwright)
- External service mocking

## Usage Examples

### Basic Unit Test

```python
def test_something(intervention_response_factory, mock_api_keys):
    response = intervention_response_factory.provoke()
    assert response.action == "provoke"
```

### Integration Test with Database

```python
@pytest.mark.integration
async def test_api_endpoint(api_client, db_session):
    response = await api_client.get("/health")
    assert response.status_code == 200
```

### Test with Mock LLM

```python
def test_with_mock_llm(
    mock_claude_provider,
    mock_anthropic_response_factory,
    monkeypatch
):
    mock_response = mock_anthropic_response_factory.provoke()
    mock_claude_provider.generate_intervention.return_value = mock_response
    # ... test code
```

## Cleanup and Isolation

### Automatic Cleanup

- `reset_global_state`: Cancels pending tasks, closes connections
- `db_session`: Auto-rollback after each test
- Function-scoped fixtures: Fresh instances per test

### Performance

- **Unit tests**: <100ms each
- **Session-scoped fixtures**: Created once per session
- **Function-scoped fixtures**: Isolation without overhead

## Type Safety

All fixtures include:

- Complete type hints
- Google-style docstrings
- Return type annotations

## Success Criteria Verification

✅ All fixtures work correctly
✅ No fixture leakage between tests
✅ Fast unit tests (<100ms each)
✅ Proper resource cleanup
✅ Type hints throughout
✅ Clear docstrings
