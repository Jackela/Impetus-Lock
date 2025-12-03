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
from server.infrastructure.persistence.database import get_session
from server.infrastructure.persistence.postgresql_task_repository import (
    PostgreSQLTaskRepository,
)


async def get_task_repository(
    session: AsyncSession = Depends(get_session),
) -> AsyncGenerator[TaskRepository, None]:
    """FastAPI dependency for TaskRepository.

    Provides abstract TaskRepository interface (DIP compliant).
    Concrete implementation is PostgreSQLTaskRepository.

    Args:
        session: Database session (injected via Depends).

    Yields:
        TaskRepository: Repository instance for task operations.

    Example:
        ```python
        # In FastAPI route
        @router.post("/tasks")
        async def create_task(
            request: TaskCreateRequest,
            repository: TaskRepository = Depends(get_task_repository),
        ) -> TaskResponse:
            task = await repository.create_task(...)
            return TaskResponse.from_entity(task)
        ```
    """
    yield PostgreSQLTaskRepository(session)
