"""Integration test fixtures with database and service dependencies.

Provides fixtures for integration tests that require database connections,
API clients, and external service mocks. All fixtures handle proper cleanup.

Constitutional Compliance:
- Article IV (SOLID): DIP - Dependencies injected via fixtures
- Article V (Documentation): Clear setup/teardown documentation
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncGenerator, Generator
from typing import TYPE_CHECKING, Any
from unittest.mock import AsyncMock, Mock, patch

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

if TYPE_CHECKING:
    from httpx import AsyncClient
    from server.api.main import FastAPI


@pytest_asyncio.fixture(scope="session")
async def db_engine() -> AsyncGenerator[Any, None]:
    """Create async database engine for integration tests.

    Uses an in-memory SQLite database for fast, isolated tests.
    Session-scoped to avoid engine creation overhead.

    Yields:
        AsyncEngine instance.
    """
    from sqlalchemy.ext.asyncio import AsyncEngine

    # Use aiosqlite for async SQLite support
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
        future=True,
    )

    try:
        yield engine
    finally:
        await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine: Any) -> AsyncGenerator[AsyncSession, None]:
    """Create database session with automatic rollback.

    Each test gets a fresh transaction that is rolled back after the test,
    ensuring test isolation without database cleanup overhead.

    Args:
        db_engine: Database engine fixture.

    Yields:
        AsyncSession with active transaction.
    """
    from server.infrastructure.persistence.models import Base

    async with db_engine.begin() as conn:
        # Create tables
        await conn.run_sync(Base.metadata.create_all)

    # Create session factory
    async_session_factory = sessionmaker(
        db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )

    async with async_session_factory() as session:
        # Start nested transaction
        async with session.begin():
            yield session
            # Rollback happens automatically on context exit
            await session.rollback()


@pytest_asyncio.fixture
async def db_session_with_cleanup(db_engine: Any) -> AsyncGenerator[AsyncSession, None]:
    """Create database session with explicit cleanup.

    Similar to db_session but with explicit table cleanup for tests
    that need to verify database state.

    Args:
        db_engine: Database engine fixture.

    Yields:
        AsyncSession with cleanup.
    """
    from server.infrastructure.persistence.models import Base

    async with db_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session_factory = sessionmaker(
        db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    session = async_session_factory()
    try:
        yield session
    finally:
        # Clean up data
        async with db_engine.begin() as conn:
            for table in reversed(Base.metadata.sorted_tables):
                await conn.execute(text(f"DELETE FROM {table.name}"))
        await session.close()


@pytest_asyncio.fixture
async def api_client(db_session: AsyncSession) -> AsyncGenerator["AsyncClient", None]:
    """Create async HTTP client with overridden dependencies.

    Injects the test database session into the FastAPI app.

    Args:
        db_session: Database session fixture.

    Yields:
        AsyncClient configured for testing.
    """
    from httpx import ASGITransport, AsyncClient
    from server.api.dependencies import get_task_repository
    from server.api.main import app
    from server.infrastructure.persistence.postgresql_task_repository import (
        PostgreSQLTaskRepository,
    )

    # Create repository with test session
    test_repository = PostgreSQLTaskRepository(db_session)

    # Override dependency
    async def override_get_task_repository() -> AsyncGenerator[Any, None]:
        yield test_repository

    original_override = app.dependency_overrides.get(get_task_repository)
    app.dependency_overrides[get_task_repository] = override_get_task_repository

    # Create client
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    # Restore original override
    if original_override:
        app.dependency_overrides[get_task_repository] = original_override
    else:
        app.dependency_overrides.pop(get_task_repository, None)


@pytest_asyncio.fixture
async def api_client_no_db() -> AsyncGenerator["AsyncClient", None]:
    """Create async HTTP client without database dependency.

    Uses in-memory repository for tests that don't need database.

    Yields:
        AsyncClient configured for testing.
    """
    from httpx import ASGITransport, AsyncClient
    from server.api.dependencies import get_task_repository
    from server.api.main import app
    from server.infrastructure.persistence.in_memory_task_repository import (
        InMemoryTaskRepository,
    )

    # Use in-memory repository
    test_repository = InMemoryTaskRepository()

    async def override_get_task_repository() -> AsyncGenerator[Any, None]:
        yield test_repository

    original_override = app.dependency_overrides.get(get_task_repository)
    app.dependency_overrides[get_task_repository] = override_get_task_repository

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    # Restore
    if original_override:
        app.dependency_overrides[get_task_repository] = original_override
    else:
        app.dependency_overrides.pop(get_task_repository, None)


@pytest.fixture
def mock_redis() -> Generator[Mock, None, None]:
    """Create mock Redis client.

    Yields:
        Mock Redis client with async methods.
    """
    mock = Mock()
    mock.get = AsyncMock(return_value=None)
    mock.set = AsyncMock(return_value=True)
    mock.setex = AsyncMock(return_value=True)
    mock.delete = AsyncMock(return_value=1)
    mock.exists = AsyncMock(return_value=0)
    mock.expire = AsyncMock(return_value=True)
    mock.close = AsyncMock(return_value=None)

    # Connection pool mock
    mock.connection_pool = Mock()
    mock.connection_pool.disconnect = AsyncMock(return_value=None)

    yield mock


@pytest_asyncio.fixture
async def redis_mock_client(mock_redis: Mock) -> AsyncGenerator[Mock, None]:
    """Create mock Redis with context manager support.

    Args:
        mock_redis: Base mock Redis fixture.

    Yields:
        Mock Redis client with async context manager.
    """
    mock_redis.__aenter__ = AsyncMock(return_value=mock_redis)
    mock_redis.__aexit__ = AsyncMock(return_value=None)

    with patch("redis.asyncio.from_url", return_value=mock_redis):
        yield mock_redis


@pytest.fixture
def mock_idempotency_cache() -> Mock:
    """Create mock idempotency cache.

    Returns:
        Mock AsyncIdempotencyCache.
    """
    from server.infrastructure.cache.idempotency_cache import AsyncIdempotencyCache

    mock = Mock(spec=AsyncIdempotencyCache)
    mock.get = AsyncMock(return_value=None)
    mock.set = AsyncMock(return_value=None)
    mock.clear = AsyncMock(return_value=None)
    return mock


@pytest.fixture
def mock_provider_registry() -> Mock:
    """Create mock provider registry.

    Returns:
        Mock ProviderRegistry.
    """
    from server.infrastructure.llm.provider_registry import ProviderRegistry

    mock = Mock(spec=ProviderRegistry)
    mock.get_provider = Mock(return_value=None)
    mock.register = Mock(return_value=None)
    mock.list_providers = Mock(return_value=[])
    return mock


@pytest.fixture
def redis_mock() -> Generator[Mock, None, None]:
    """Create a mock Redis client with in-memory storage.

    Provides a mock Redis client that simulates Redis operations
    without requiring a running Redis server. Supports common
    operations like get, set, delete, and expiration.

    Yields:
        Mock configured as a Redis client with in-memory storage.
    """
    storage: dict[str, tuple[str, float | None]] = {}

    async def mock_get(key: str) -> str | None:
        """Mock Redis GET operation."""
        if key not in storage:
            return None
        value, expiry = storage[key]
        if expiry is not None and asyncio.get_event_loop().time() > expiry:
            del storage[key]
            return None
        return value

    async def mock_set(
        key: str,
        value: str,
        ex: float | None = None,
    ) -> bool:
        """Mock Redis SET operation with optional expiration."""
        expiry = None
        if ex is not None:
            expiry = asyncio.get_event_loop().time() + ex
        storage[key] = (value, expiry)
        return True

    async def mock_delete(key: str) -> int:
        """Mock Redis DELETE operation."""
        if key in storage:
            del storage[key]
            return 1
        return 0

    async def mock_exists(key: str) -> int:
        """Mock Redis EXISTS operation."""
        if key in storage:
            value, expiry = storage[key]
            if expiry is not None and asyncio.get_event_loop().time() > expiry:
                del storage[key]
                return 0
            return 1
        return 0

    async def mock_expire(key: str, seconds: float) -> bool:
        """Mock Redis EXPIRE operation."""
        if key in storage:
            value, _ = storage[key]
            storage[key] = (value, asyncio.get_event_loop().time() + seconds)
            return True
        return False

    async def mock_flushall() -> bool:
        """Mock Redis FLUSHALL operation."""
        storage.clear()
        return True

    mock = Mock()
    mock.get = mock_get
    mock.set = mock_set
    mock.delete = mock_delete
    mock.exists = mock_exists
    mock.expire = mock_expire
    mock.flushall = mock_flushall
    mock._storage = storage  # Expose for test inspection

    yield mock

    # Cleanup
    storage.clear()


@pytest.fixture
def auth_headers() -> dict[str, str]:
    """Provide standard authentication headers for API tests.

    Returns:
        Dictionary with required API headers.
    """
    import uuid

    return {
        "Idempotency-Key": str(uuid.uuid4()),
        "X-Contract-Version": "2.0.0",
        "Content-Type": "application/json",
    }


@pytest.fixture
def sample_intervention_request() -> dict[str, Any]:
    """Provide a sample intervention request payload.

    Returns:
        Dictionary with a valid intervention request.
    """
    return {
        "context": "他打开门，犹豫着要不要进去。",
        "mode": "muse",
        "client_meta": {
            "doc_version": 42,
            "selection_from": 1234,
            "selection_to": 1234,
        },
    }


@pytest_asyncio.fixture
async def intervention_service_with_db(db_session: AsyncSession) -> AsyncGenerator[Any, None]:
    """Create intervention service with database-backed repository.

    Args:
        db_session: Database session fixture.

    Yields:
        InterventionService with database repository.
    """
    from server.application.services.intervention_service import InterventionService
    from server.infrastructure.llm.debug_provider import DebugLLMProvider
    from server.infrastructure.persistence.postgresql_task_repository import (
        PostgreSQLTaskRepository,
    )

    repository = PostgreSQLTaskRepository(db_session)
    provider = DebugLLMProvider()

    service = InterventionService(
        llm_provider=provider,
        task_repository=repository,
    )

    yield service


@pytest.fixture
def mock_anthropic_client() -> Generator[Mock, None, None]:
    """Mock Anthropic client for integration tests.

    Yields:
        Mock Anthropic client.
    """
    with patch("anthropic.Anthropic") as mock_class:
        mock_instance = Mock()
        mock_class.return_value = mock_instance
        yield mock_instance


@pytest.fixture
def mock_openai_client() -> Generator[Mock, None, None]:
    """Mock OpenAI client for integration tests.

    Yields:
        Mock OpenAI client.
    """
    with patch("openai.AsyncOpenAI") as mock_class:
        mock_instance = Mock()
        mock_class.return_value = mock_instance
        yield mock_instance


@pytest_asyncio.fixture(scope="session")
async def test_database_url() -> str:
    """Provide test database URL.

    Returns:
        Test database URL.
    """
    import os

    return os.getenv("TEST_DATABASE_URL", "sqlite+aiosqlite:///:memory:")


@pytest.fixture
def db_cleanup(db_engine: Any) -> Generator[None, None, None]:
    """Context manager for database cleanup.

    Args:
        db_engine: Database engine fixture.

    Yields:
        None, cleans up database on exit.
    """
    from server.infrastructure.persistence.models import Base

    yield

    # Cleanup after test
    async def cleanup() -> None:
        async with db_engine.begin() as conn:
            for table in reversed(Base.metadata.sorted_tables):
                await conn.execute(text(f"DELETE FROM {table.name}"))

    asyncio.run(cleanup())
