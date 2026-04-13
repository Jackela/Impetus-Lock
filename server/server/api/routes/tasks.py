"""Task management API routes with authentication.

Provides CRUD operations for tasks with user scoping and intervention history.

Constitutional Compliance:
- Article IV (SOLID - SRP): Endpoints delegate to repository
- Article IV (SOLID - DIP): Depends on TaskRepository abstraction
- Article V (Documentation): Complete API documentation
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from server.api.dependencies import get_task_repository
from server.api.schemas.task import (
    InterventionActionResponse,
    InterventionHistoryResponse,
    TaskCreateRequest,
    TaskListResponse,
    TaskResponse,
    TaskUpdateRequest,
)
from server.auth import get_current_user
from server.domain.repositories.task_repository import TaskRepository
from server.infrastructure.persistence.database import get_session_optional
from server.models.user import User

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("/", response_model=TaskListResponse)
async def list_tasks(
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
    current_user: User = Depends(get_current_user),
    repository: TaskRepository = Depends(get_task_repository),
) -> TaskListResponse:
    """List all tasks for current user (paginated).

    Args:
        limit: Maximum number of tasks to return (1-100).
        offset: Number of tasks to skip.
        current_user: Authenticated user (injected via auth).
        repository: Task repository (injected via DIP).

    Returns:
        TaskListResponse: Paginated task list in reverse chronological order.

    Raises:
        HTTPException: 401 if not authenticated.

    Example:
        ```bash
        # Get first 10 tasks
        curl http://localhost:8000/tasks/?limit=10

        # Get next 10 tasks
        curl http://localhost:8000/tasks/?limit=10&offset=10
        ```
    """
    # Get tasks scoped to current user
    tasks = await repository.list_tasks_by_user(
        user_id=current_user.id, limit=limit, offset=offset
    )

    # Get total count for user
    total = await repository.count_tasks_by_user(user_id=current_user.id)

    return TaskListResponse(
        total=total,
        limit=limit,
        offset=offset,
        tasks=[TaskResponse.from_entity(t) for t in tasks],
    )


@router.post("/", response_model=TaskResponse, status_code=201)
async def create_task(
    request: TaskCreateRequest,
    current_user: User = Depends(get_current_user),
    repository: TaskRepository = Depends(get_task_repository),
    session: AsyncSession | None = Depends(get_session_optional),
) -> TaskResponse:
    """Create new task for current user.

    Args:
        request: Task creation request.
        current_user: Authenticated user (injected via auth).
        repository: Task repository (injected via DIP).
        session: Database session (injected).

    Returns:
        TaskResponse: Created task.

    Raises:
        HTTPException: 401 if not authenticated.

    Example:
        ```bash
        curl -X POST http://localhost:8000/tasks \
          -H "Content-Type: application/json" \
          -d '{"content": "Initial content", "lock_ids": []}'
        ```
    """
    task = await repository.create_task(
        content=request.content,
        lock_ids=request.lock_ids,
        user_id=current_user.id,
    )
    if session:
        await session.commit()

    return TaskResponse.from_entity(task)


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    repository: TaskRepository = Depends(get_task_repository),
) -> TaskResponse:
    """Get task by ID (must belong to current user).

    Args:
        task_id: Task UUID.
        current_user: Authenticated user (injected via auth).
        repository: Task repository (injected via DIP).

    Returns:
        TaskResponse: Task details.

    Raises:
        HTTPException: 404 if task not found or not owned by user.
        HTTPException: 401 if not authenticated.

    Example:
        ```bash
        curl http://localhost:8000/tasks/{task_id}
        ```
    """
    task = await repository.get_task_by_user(task_id, user_id=current_user.id)

    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

    return TaskResponse.from_entity(task)


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: UUID,
    request: TaskUpdateRequest,
    current_user: User = Depends(get_current_user),
    repository: TaskRepository = Depends(get_task_repository),
    session: AsyncSession | None = Depends(get_session_optional),
) -> TaskResponse:
    """Update task content and lock IDs (must belong to current user).

    Args:
        task_id: Task UUID.
        request: Task update request.
        current_user: Authenticated user (injected via auth).
        repository: Task repository (injected via DIP).
        session: Database session (injected).

    Returns:
        TaskResponse: Updated task.

    Raises:
        HTTPException: 404 if task not found or not owned by user.
        HTTPException: 409 if version mismatch.
        HTTPException: 401 if not authenticated.

    Example:
        ```bash
        curl -X PUT http://localhost:8000/tasks/{task_id} \
          -H "Content-Type: application/json" \
          -d '{"content": "Updated", "lock_ids": ["lock_1"], "version": 0}'
        ```
    """
    task = await repository.get_task_by_user(task_id, user_id=current_user.id)

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
        if session:
            await session.commit()
        return TaskResponse.from_entity(updated_task)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/{task_id}", status_code=204)
async def delete_task(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    repository: TaskRepository = Depends(get_task_repository),
    session: AsyncSession | None = Depends(get_session_optional),
) -> None:
    """Delete task (must belong to current user, cascade deletes intervention actions).

    Args:
        task_id: Task UUID.
        current_user: Authenticated user (injected via auth).
        repository: Task repository (injected via DIP).
        session: Database session (injected).

    Raises:
        HTTPException: 404 if task not found or not owned by user.
        HTTPException: 401 if not authenticated.

    Example:
        ```bash
        curl -X DELETE http://localhost:8000/tasks/{task_id}
        ```
    """
    # Verify task exists and belongs to user before deleting
    task = await repository.get_task_by_user(task_id, user_id=current_user.id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

    try:
        await repository.delete_task(task_id)
        if session:
            await session.commit()
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get("/{task_id}/actions", response_model=InterventionHistoryResponse)
async def get_intervention_history(
    task_id: UUID,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
    current_user: User = Depends(get_current_user),
    repository: TaskRepository = Depends(get_task_repository),
) -> InterventionHistoryResponse:
    """Get intervention action history for task (must belong to current user).

    Args:
        task_id: Task UUID.
        limit: Maximum number of actions to return (1-100).
        offset: Number of actions to skip.
        current_user: Authenticated user (injected via auth).
        repository: Task repository (injected via DIP).

    Returns:
        InterventionHistoryResponse: Paginated intervention history.

    Raises:
        HTTPException: 404 if task not found or not owned by user.
        HTTPException: 401 if not authenticated.

    Example:
        ```bash
        # Get first 10 actions
        curl http://localhost:8000/tasks/{task_id}/actions?limit=10

        # Get next 10 actions
        curl http://localhost:8000/tasks/{task_id}/actions?limit=10&offset=10
        ```
    """
    # Verify task exists and belongs to user
    task = await repository.get_task_by_user(task_id, user_id=current_user.id)
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
