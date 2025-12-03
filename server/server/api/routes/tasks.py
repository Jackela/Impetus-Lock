"""Task management API routes.

Provides CRUD operations for tasks with intervention history.

Constitutional Compliance:
- Article IV (SOLID - SRP): Endpoints delegate to repository
- Article IV (SOLID - DIP): Depends on TaskRepository abstraction
- Article V (Documentation): Complete API documentation
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from server.api.dependencies import get_task_repository
from server.domain.entities.intervention_action import InterventionAction
from server.domain.entities.task import Task
from server.domain.repositories.task_repository import TaskRepository
from server.infrastructure.persistence.database import get_session

router = APIRouter(prefix="/api/v1/tasks", tags=["tasks"])


# Request/Response Models


class TaskCreateRequest(BaseModel):
    """Request schema for creating a task."""

    content: str = Field(
        ..., min_length=1, max_length=100000, description="Task content (Markdown)"
    )
    lock_ids: list[str] = Field(default_factory=list, description="List of lock IDs")


class TaskUpdateRequest(BaseModel):
    """Request schema for updating a task."""

    content: str = Field(..., min_length=1, max_length=100000, description="Updated task content")
    lock_ids: list[str] = Field(..., description="Updated list of lock IDs")
    version: int = Field(..., ge=0, description="Current version (for optimistic locking)")


class TaskResponse(BaseModel):
    """Response schema for task operations."""

    id: str
    content: str
    lock_ids: list[str]
    created_at: str
    updated_at: str
    version: int

    @classmethod
    def from_entity(cls, task: Task) -> "TaskResponse":
        """Convert Task entity to response model."""
        return cls(
            id=str(task.id),
            content=task.content,
            lock_ids=task.lock_ids,
            created_at=task.created_at.isoformat(),
            updated_at=task.updated_at.isoformat(),
            version=task.version,
        )


class InterventionActionResponse(BaseModel):
    """Response schema for intervention action."""

    id: str
    task_id: str
    action_type: str
    action_id: str
    lock_id: str | None
    content: str | None
    anchor: dict[str, str]
    mode: str
    context: str
    issued_at: str
    created_at: str

    @classmethod
    def from_entity(cls, action: InterventionAction) -> "InterventionActionResponse":
        """Convert InterventionAction entity to response model."""
        return cls(
            id=str(action.id),
            task_id=str(action.task_id),
            action_type=action.action_type,
            action_id=action.action_id,
            lock_id=action.lock_id,
            content=action.content,
            anchor=action.anchor,
            mode=action.mode,
            context=action.context,
            issued_at=action.issued_at.isoformat(),
            created_at=action.created_at.isoformat(),
        )


class InterventionHistoryResponse(BaseModel):
    """Response schema for intervention history query."""

    total: int
    limit: int
    offset: int
    actions: list[InterventionActionResponse]


# Endpoints


@router.post("/", response_model=TaskResponse, status_code=201)
async def create_task(
    request: TaskCreateRequest,
    repository: TaskRepository = Depends(get_task_repository),
    session: AsyncSession = Depends(get_session),
) -> TaskResponse:
    """Create new task.

    Args:
        request: Task creation request.
        repository: Task repository (injected via DIP).
        session: Database session (injected).

    Returns:
        TaskResponse: Created task.

    Example:
        ```bash
        curl -X POST http://localhost:8000/api/v1/tasks \
          -H "Content-Type: application/json" \
          -d '{"content": "Initial content", "lock_ids": []}'
        ```
    """
    task = await repository.create_task(request.content, request.lock_ids)
    await session.commit()

    return TaskResponse.from_entity(task)


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: UUID,
    repository: TaskRepository = Depends(get_task_repository),
) -> TaskResponse:
    """Get task by ID.

    Args:
        task_id: Task UUID.
        repository: Task repository (injected via DIP).

    Returns:
        TaskResponse: Task details.

    Raises:
        HTTPException: 404 if task not found.

    Example:
        ```bash
        curl http://localhost:8000/api/v1/tasks/{task_id}
        ```
    """
    task = await repository.get_task(task_id)

    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

    return TaskResponse.from_entity(task)


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: UUID,
    request: TaskUpdateRequest,
    repository: TaskRepository = Depends(get_task_repository),
    session: AsyncSession = Depends(get_session),
) -> TaskResponse:
    """Update task content and lock IDs.

    Args:
        task_id: Task UUID.
        request: Task update request.
        repository: Task repository (injected via DIP).
        session: Database session (injected).

    Returns:
        TaskResponse: Updated task.

    Raises:
        HTTPException: 404 if task not found, 409 if version mismatch.

    Example:
        ```bash
        curl -X PUT http://localhost:8000/api/v1/tasks/{task_id} \
          -H "Content-Type: application/json" \
          -d '{"content": "Updated", "lock_ids": ["lock_1"], "version": 0}'
        ```
    """
    task = await repository.get_task(task_id)

    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

    # Validate version before updating (optimistic locking)
    if task.version != request.version:
        raise HTTPException(
            status_code=409,
            detail=f"Version mismatch: expected {request.version}, got {task.version}",
        )

    # Update task (will increment version)
    task.update_content(request.content, request.lock_ids)

    try:
        updated_task = await repository.update_task(task)
        await session.commit()
        return TaskResponse.from_entity(updated_task)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/{task_id}", status_code=204)
async def delete_task(
    task_id: UUID,
    repository: TaskRepository = Depends(get_task_repository),
    session: AsyncSession = Depends(get_session),
) -> None:
    """Delete task (cascade deletes intervention actions).

    Args:
        task_id: Task UUID.
        repository: Task repository (injected via DIP).
        session: Database session (injected).

    Raises:
        HTTPException: 404 if task not found.

    Example:
        ```bash
        curl -X DELETE http://localhost:8000/api/v1/tasks/{task_id}
        ```
    """
    try:
        await repository.delete_task(task_id)
        await session.commit()
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get("/{task_id}/actions", response_model=InterventionHistoryResponse)
async def get_intervention_history(
    task_id: UUID,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
    repository: TaskRepository = Depends(get_task_repository),
) -> InterventionHistoryResponse:
    """Get intervention action history for task (paginated).

    Args:
        task_id: Task UUID.
        limit: Maximum number of actions to return (1-100).
        offset: Number of actions to skip.
        repository: Task repository (injected via DIP).

    Returns:
        InterventionHistoryResponse: Paginated intervention history.

    Raises:
        HTTPException: 404 if task not found.

    Example:
        ```bash
        # Get first 10 actions
        curl http://localhost:8000/api/v1/tasks/{task_id}/actions?limit=10

        # Get next 10 actions
        curl http://localhost:8000/api/v1/tasks/{task_id}/actions?limit=10&offset=10
        ```
    """
    # Verify task exists
    task = await repository.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

    # Get actions and count
    actions = await repository.get_actions(task_id, limit=limit, offset=offset)
    total = await repository.get_action_count(task_id)

    return InterventionHistoryResponse(
        total=total,
        limit=limit,
        offset=offset,
        actions=[InterventionActionResponse.from_entity(a) for a in actions],
    )
