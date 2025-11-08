"""Database session management for PostgreSQL.

Provides async session factory and connection management using SQLAlchemy 2.0.

Constitutional Compliance:
- Article I (Simplicity): Uses framework-native SQLAlchemy patterns
- Article IV (SOLID - SRP): Single responsibility (database connection management)
- Article V (Documentation): Complete Google-style docstrings
"""

import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from server.infrastructure.persistence.models import Base


class DatabaseManager:
    """Database connection and session management.

    Provides async engine and session factory for PostgreSQL operations.

    Attributes:
        _engine: SQLAlchemy async engine.
        _session_factory: Async session factory.

    Example:
        ```python
        db_manager = DatabaseManager(database_url="postgresql+asyncpg://...")
        await db_manager.create_tables()

        async with db_manager.session() as session:
            repository = PostgreSQLTaskRepository(session)
            task = await repository.create_task("Content", [])
            await session.commit()
        ```
    """

    def __init__(self, database_url: str | None = None):
        """Initialize database manager with connection URL.

        Args:
            database_url: PostgreSQL connection URL (asyncpg driver).
                         Defaults to DATABASE_URL environment variable.

        Example:
            ```python
            # From environment variable
            db = DatabaseManager()

            # Explicit URL
            db = DatabaseManager("postgresql+asyncpg://user:pass@localhost/db")
            ```
        """
        self._database_url = database_url or os.getenv("DATABASE_URL")

        if not self._database_url:
            raise ValueError("DATABASE_URL environment variable not set")

        # Create async engine
        self._engine: AsyncEngine = create_async_engine(
            self._database_url,
            echo=False,  # Set to True for SQL query logging
            pool_pre_ping=True,  # Verify connections before using
            pool_size=5,  # Connection pool size
            max_overflow=10,  # Max connections beyond pool_size
        )

        # Create async session factory
        self._session_factory = async_sessionmaker(
            self._engine,
            class_=AsyncSession,
            expire_on_commit=False,  # Keep objects accessible after commit
        )

    @asynccontextmanager
    async def session(self) -> AsyncGenerator[AsyncSession, None]:
        """Create async database session (context manager).

        Yields:
            AsyncSession: SQLAlchemy async session.

        Example:
            ```python
            async with db_manager.session() as session:
                # Use session for queries
                task = await repository.create_task("Content", [])
                await session.commit()
            # Session auto-closes when context exits
            ```
        """
        async with self._session_factory() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    async def create_tables(self) -> None:
        """Create all database tables (development/testing only).

        In production, use Alembic migrations instead.

        Example:
            ```python
            await db_manager.create_tables()
            ```
        """
        async with self._engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def drop_tables(self) -> None:
        """Drop all database tables (testing only).

        WARNING: This deletes all data. Use with caution.

        Example:
            ```python
            # In test teardown
            await db_manager.drop_tables()
            ```
        """
        async with self._engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)

    async def close(self) -> None:
        """Close database engine and all connections.

        Call this on application shutdown.

        Example:
            ```python
            # In FastAPI lifespan
            @asynccontextmanager
            async def lifespan(app: FastAPI):
                # Startup
                yield
                # Shutdown
                await db_manager.close()
            ```
        """
        await self._engine.dispose()


# Global database manager instance (initialized in main.py)
_db_manager: DatabaseManager | None = None


def get_db_manager() -> DatabaseManager:
    """Get global database manager instance.

    Returns:
        DatabaseManager: Global instance.

    Raises:
        RuntimeError: If database manager not initialized.

    Example:
        ```python
        # In main.py
        init_database()

        # In other modules
        db = get_db_manager()
        async with db.session() as session:
            ...
        ```
    """
    if _db_manager is None:
        raise RuntimeError("Database manager not initialized. Call init_database() first.")
    return _db_manager


def init_database(database_url: str | None = None) -> DatabaseManager:
    """Initialize global database manager.

    Args:
        database_url: Optional database URL (defaults to environment variable).

    Returns:
        DatabaseManager: Initialized global instance.

    Example:
        ```python
        # In main.py
        db_manager = init_database()
        await db_manager.create_tables()  # Development only
        ```
    """
    global _db_manager
    _db_manager = DatabaseManager(database_url)
    return _db_manager


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for database sessions.

    Yields:
        AsyncSession: SQLAlchemy async session.

    Example:
        ```python
        # In FastAPI route
        @app.post("/tasks")
        async def create_task(
            session: AsyncSession = Depends(get_session)
        ):
            repository = PostgreSQLTaskRepository(session)
            task = await repository.create_task("Content", [])
            await session.commit()
            return task
        ```
    """
    db_manager = get_db_manager()
    async with db_manager.session() as session:
        yield session
