"""FastAPI dependency providers.

Provides dependency injection factories for API routes.

Constitutional Compliance:
- Article IV (SOLID - DIP): Provide abstractions via Depends()
- Article V (Documentation): Complete Google-style docstrings
"""

from collections.abc import AsyncGenerator

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from server.domain.repositories.task_repository import TaskRepository
from server.infrastructure.persistence.database import get_session_optional
from server.infrastructure.persistence.in_memory_task_repository import InMemoryTaskRepository
from server.infrastructure.persistence.postgresql_task_repository import (
    PostgreSQLTaskRepository,
)

# Module-level singleton for in-memory fallback (TESTING mode)
_in_memory_repository: InMemoryTaskRepository | None = None


async def get_task_repository(
    session: AsyncSession | None = Depends(get_session_optional),
) -> AsyncGenerator[TaskRepository, None]:
    """FastAPI dependency for TaskRepository with testing fallback."""

    if session is None:
        yield _get_in_memory_repository()
        return

    yield PostgreSQLTaskRepository(session)


def _get_in_memory_repository() -> InMemoryTaskRepository:
    """Get or create singleton in-memory repository for TESTING mode."""
    global _in_memory_repository
    if _in_memory_repository is None:
        _in_memory_repository = InMemoryTaskRepository()
    return _in_memory_repository
