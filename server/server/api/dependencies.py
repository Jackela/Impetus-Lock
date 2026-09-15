"""FastAPI dependency providers.

Provides dependency injection factories for API routes.

Constitutional Compliance:
- Article IV (SOLID - DIP): Provide abstractions via Depends()
- Article V (Documentation): Complete Google-style docstrings
"""

from collections.abc import AsyncGenerator

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from server.application.services.streak_service import StreakService
from server.application.services.task_service import TaskService
from server.application.services.template_service import TemplateService
from server.domain.repositories.task_repository import TaskRepository
from server.domain.transactions import NullTransaction
from server.infrastructure.persistence.database import get_session_optional
from server.infrastructure.persistence.in_memory_task_repository import InMemoryTaskRepository
from server.infrastructure.persistence.postgresql_streak_repository import (
    PostgreSQLStreakRepository,
)
from server.infrastructure.persistence.postgresql_task_repository import (
    PostgreSQLTaskRepository,
)
from server.infrastructure.persistence.postgresql_template_repository import (
    PostgreSQLTemplateRepository,
)
from server.infrastructure.persistence.transactions import SqlAlchemyTransaction

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


def get_task_service(
    repository: TaskRepository = Depends(get_task_repository),
    session: AsyncSession | None = Depends(get_session_optional),
) -> TaskService:
    """FastAPI dependency for the user-scoped TaskService.

    Write operations commit through the transaction support bound to the
    request's session; without a session (in-memory fallback) commits are
    no-ops, preserving the historical per-route commit behavior.
    """
    if session is None:
        return TaskService(repository, transaction=NullTransaction())
    return TaskService(repository, transaction=SqlAlchemyTransaction(session))


def get_template_service(
    session: AsyncSession | None = Depends(get_session_optional),
) -> TemplateService | None:
    """FastAPI dependency for the user-scoped TemplateService.

    Returns None when no database session is available; routes map that to
    their historical degraded outcomes (empty list, or 500 elsewhere).
    """
    if session is None:
        return None
    return TemplateService(PostgreSQLTemplateRepository(session))


def get_streak_service(
    session: AsyncSession | None = Depends(get_session_optional),
) -> StreakService | None:
    """FastAPI dependency for the user-scoped StreakService.

    Returns None when no database session is available; routes map that to
    the historical 500 database-unavailable response.
    """
    if session is None:
        return None
    return StreakService(PostgreSQLStreakRepository(session))
