"""Task management API routes with authentication.

HTTP adapter for task CRUD and intervention history. Authentication,
request validation, response schemas and HTTP exception mapping stay here;
ownership checks, optimistic version orchestration and persistence are
delegated to the injected user-scoped TaskService.

Constitutional Compliance:
- Article IV (SOLID - SRP): Endpoints are HTTP adapters over TaskService
- Article IV (SOLID - DIP): Depends on the service abstraction
- Article V (Documentation): Complete API documentation
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from server.api.dependencies import get_task_service
from server.api.schemas.task import (
    InterventionActionResponse,
    InterventionHistoryResponse,
    TaskCreateRequest,
    TaskListResponse,
    TaskResponse,
    TaskUpdateRequest,
)
from server.application.services.task_service import (
    TaskNotFoundError,
    TaskService,
    VersionMismatchError,
)
from server.auth import get_current_user
from server.models.user import User

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("/", response_model=TaskListResponse)
async def list_tasks(
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
) -> TaskListResponse:
    """List all tasks for current user (paginated, reverse chronological).

    Args:
        limit: Maximum number of tasks to return (1-100).
        offset: Number of tasks to skip.
        current_user: Authenticated user (injected via auth).
        service: User-scoped task service (injected via DIP).

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
    tasks, total = await service.list_tasks_for_user(
        user_id=current_user.id, limit=limit, offset=offset
    )

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
    service: TaskService = Depends(get_task_service),
) -> TaskResponse:
    """Create new task for current user.

    Args:
        request: Task creation request.
        current_user: Authenticated user (injected via auth).
        service: User-scoped task service (injected via DIP).

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
    task = await service.create_task_for_user(
        current_user.id,
        request.content,
        request.lock_ids,
        title=request.title,
        category=request.category,
        priority=request.priority,
        due_date=request.due_date,
        word_count=request.word_count,
    )

    return TaskResponse.from_entity(task)


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
) -> TaskResponse:
    """Get task by ID (must belong to current user).

    Args:
        task_id: Task UUID.
        current_user: Authenticated user (injected via auth).
        service: User-scoped task service (injected via DIP).

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
    try:
        task = await service.get_task_for_user(current_user.id, task_id)
    except TaskNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    return TaskResponse.from_entity(task)


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: UUID,
    request: TaskUpdateRequest,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
) -> TaskResponse:
    """Update task content and lock IDs (must belong to current user).

    Args:
        task_id: Task UUID.
        request: Task update request.
        current_user: Authenticated user (injected via auth).
        service: User-scoped task service (injected via DIP).

    Returns:
        TaskResponse: Updated task.

    Raises:
        HTTPException: 404 if task not found or not owned by user.
        HTTPException: 409 if version mismatch.
        HTTPException: 500 if the update cannot be persisted.
        HTTPException: 401 if not authenticated.

    Example:
        ```bash
        curl -X PUT http://localhost:8000/tasks/{task_id} \
          -H "Content-Type: application/json" \
          -d '{"content": "Updated", "lock_ids": ["lock_1"], "version": 0}'
        ```
    """
    try:
        updated_task = await service.update_task_for_user(
            current_user.id,
            task_id,
            content=request.content,
            lock_ids=request.lock_ids,
            version=request.version,
            title=request.title,
            category=request.category,
            priority=request.priority,
            due_date=request.due_date,
            word_count=request.word_count,
        )
    except TaskNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except VersionMismatchError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return TaskResponse.from_entity(updated_task)


@router.delete("/{task_id}", status_code=204)
async def delete_task(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
) -> None:
    """Delete task (must belong to current user, cascade deletes intervention actions).

    Args:
        task_id: Task UUID.
        current_user: Authenticated user (injected via auth).
        service: User-scoped task service (injected via DIP).

    Raises:
        HTTPException: 404 if task not found or not owned by user.
        HTTPException: 401 if not authenticated.

    Example:
        ```bash
        curl -X DELETE http://localhost:8000/tasks/{task_id}
        ```
    """
    try:
        await service.delete_task_for_user(current_user.id, task_id)
    except TaskNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get("/{task_id}/actions", response_model=InterventionHistoryResponse)
async def get_intervention_history(
    task_id: UUID,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
) -> InterventionHistoryResponse:
    """Get intervention action history for task (must belong to current user).

    Args:
        task_id: Task UUID.
        limit: Maximum number of actions to return (1-100).
        offset: Number of actions to skip.
        current_user: Authenticated user (injected via auth).
        service: User-scoped task service (injected via DIP).

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
    try:
        actions, total = await service.get_intervention_history_for_user(
            current_user.id, task_id, limit=limit, offset=offset
        )
    except TaskNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    return InterventionHistoryResponse(
        total=total,
        limit=limit,
        offset=offset,
        actions=[InterventionActionResponse.from_entity(a) for a in actions],
    )
