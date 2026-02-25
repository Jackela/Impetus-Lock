"""
Test database configuration override for SQLite.

Uses SQLite for testing without requiring Docker/PostgreSQL.
"""

import asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool

# Import User model only for auth tests
from server.domain.models.user import User  # Import User model
from sqlalchemy import MetaData

# Test database URL (SQLite in-memory)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# Create async engine with StaticPool for SQLite
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    poolclass=StaticPool,
    connect_args={"check_same_thread": False}
)

# Session factory
TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False
)


async def init_test_db():
    """Initialize test database tables (User only for auth tests)."""
    async with test_engine.begin() as conn:
        # Only create User table, not all tables (SQLite doesn't support ARRAY)
        await conn.run_sync(User.__table__.create, checkfirst=True)


async def get_test_session() -> AsyncSession:
    """Get test database session."""
    async with TestSessionLocal() as session:
        yield session


# Cleanup function
async def cleanup_test_db():
    """Drop all tables after tests."""
    async with test_engine.begin() as conn:
        await conn.run_sync(User.__table__.drop, checkfirst=True)
