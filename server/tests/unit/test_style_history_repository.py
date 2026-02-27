from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from server.infrastructure.persistence.models import Base
from server.infrastructure.persistence.style_history_repository import StyleHistoryRepository
from server.models.style_history import StyleHistoryModel

# Test database setup
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture
async def engine():
    """Create test database engine."""
    from server.models.style_history import StyleHistoryModel

    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        # Only create style_history table for this test
        await conn.run_sync(StyleHistoryModel.__table__.create, checkfirst=True)
    yield engine
    await engine.dispose()


@pytest.fixture
async def session(engine):
    """Create test database session."""
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        yield session


@pytest.fixture
def repository(session: AsyncSession):
    """Create repository with test session."""
    return StyleHistoryRepository(session=session)


@pytest.mark.asyncio
async def test_create_history(repository: StyleHistoryRepository):
    """Test creating a style history record."""
    user_id = "test-user-123"
    text = "This is a sample text for style analysis. " * 10  # Min 100 chars
    style_vector = {"tone": 0.8, "formality": 0.6, "vocabulary_richness": 0.7}

    history = await repository.create(
        user_id=user_id, text=text, style_vector=style_vector
    )

    assert history.id is not None
    assert history.user_id == user_id
    assert history.text == text
    assert history.style_vector == style_vector
    assert history.created_at is not None


@pytest.mark.asyncio
async def test_get_by_user(repository: StyleHistoryRepository):
    """Test retrieving history by user with pagination."""
    user_id = "test-user-456"

    # Create multiple records
    for i in range(15):
        await repository.create(
            user_id=user_id,
            text=f"Sample text {i} for style analysis. " * 5,
            style_vector={"index": i},
        )

    # Test pagination
    page1 = await repository.get_by_user(user_id=user_id, limit=10, offset=0)
    assert len(page1) == 10
    assert page1[0].style_vector["index"] == 14  # Newest first

    page2 = await repository.get_by_user(user_id=user_id, limit=10, offset=10)
    assert len(page2) == 5
    assert page2[0].style_vector["index"] == 4


@pytest.mark.asyncio
async def test_get_by_id(repository: StyleHistoryRepository):
    """Test retrieving a specific history record by ID."""
    created = await repository.create(
        user_id="test-user-789",
        text="Sample text for ID retrieval test. " * 10,
        style_vector={"test": "data"},
    )

    retrieved = await repository.get_by_id(history_id=created.id)

    assert retrieved is not None
    assert retrieved.id == created.id
    assert retrieved.user_id == created.user_id


@pytest.mark.asyncio
async def test_get_by_id_not_found(repository: StyleHistoryRepository):
    """Test retrieving non-existent history record."""
    fake_id = uuid4()
    retrieved = await repository.get_by_id(history_id=fake_id)
    assert retrieved is None


@pytest.mark.asyncio
async def test_delete_history(repository: StyleHistoryRepository):
    """Test deleting a history record."""
    created = await repository.create(
        user_id="test-user-delete",
        text="Sample text to be deleted. " * 10,
        style_vector={"delete": "test"},
    )

    # Verify exists
    retrieved = await repository.get_by_id(history_id=created.id)
    assert retrieved is not None

    # Delete
    deleted = await repository.delete(history_id=created.id)
    assert deleted is True

    # Verify deleted
    retrieved = await repository.get_by_id(history_id=created.id)
    assert retrieved is None


@pytest.mark.asyncio
async def test_delete_history_not_found(repository: StyleHistoryRepository):
    """Test deleting non-existent history record."""
    fake_id = uuid4()
    deleted = await repository.delete(history_id=fake_id)
    assert deleted is False


@pytest.mark.asyncio
async def test_count_by_user(repository: StyleHistoryRepository):
    """Test counting history records for a user."""
    user_id = "test-user-count"

    # Create multiple records
    for i in range(5):
        await repository.create(
            user_id=user_id,
            text=f"Sample text {i} for counting. " * 10,
            style_vector={"index": i},
        )

    # Create records for different user
    await repository.create(
        user_id="other-user",
        text="Other user text. " * 10,
        style_vector={"other": "user"},
    )

    count = await repository.count_by_user(user_id=user_id)
    assert count == 5
