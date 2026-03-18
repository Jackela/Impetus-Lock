"""Style History API endpoints for managing style analysis history."""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.exc import IntegrityError, OperationalError

from server.infrastructure.persistence.style_history_repository import StyleHistoryRepository

router = APIRouter(prefix="/style/history", tags=["style-history"])


class StyleHistoryCreate(BaseModel):
    """Request model for creating style history."""

    user_id: str = Field(..., description="User identifier")
    text: str = Field(..., min_length=100, description="Analyzed text (min 100 chars)")
    style_vector: dict[str, Any] = Field(..., description="Style analysis vector")


class StyleHistoryResponse(BaseModel):
    """Response model for style history."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: str
    text: str
    style_vector: dict[str, Any]
    created_at: str


class StyleHistoryListResponse(BaseModel):
    """Response model for paginated history list."""

    items: list[StyleHistoryResponse]
    total: int
    limit: int
    offset: int


def get_repository() -> StyleHistoryRepository:
    """Dependency injection for repository."""
    return StyleHistoryRepository()


@router.post("", response_model=StyleHistoryResponse, status_code=201)
async def create_history(
    request: StyleHistoryCreate, repo: StyleHistoryRepository = Depends(get_repository)
) -> StyleHistoryResponse:
    """Create a new style history record.

    Args:
        request: Style history data
        repo: Repository instance

    Returns:
        Created history record

    Raises:
        HTTPException: 400 if validation fails, 409 if conflict, 503 if DB unavailable
    """
    try:
        history = await repo.create(
            user_id=request.user_id, text=request.text, style_vector=request.style_vector
        )
        return StyleHistoryResponse(
            id=history.id,
            user_id=history.user_id,
            text=history.text,
            style_vector=history.style_vector,
            created_at=history.created_at.isoformat(),
        )
    except IntegrityError as e:
        raise HTTPException(
            status_code=409,
            detail={"error": "ConflictError", "message": "Duplicate entry or constraint violation"},
        ) from e
    except OperationalError as e:
        raise HTTPException(
            status_code=503,
            detail={"error": "ServiceUnavailable", "message": "Database temporarily unavailable"},
        ) from e
    except ValueError as e:
        raise HTTPException(
            status_code=400, detail={"error": "ValidationError", "message": str(e)}
        ) from e


@router.get("/user/{user_id}", response_model=StyleHistoryListResponse)
async def get_user_history(
    user_id: str,
    limit: int = Query(10, ge=1, le=100, description="Max records to return"),
    offset: int = Query(0, ge=0, description="Number of records to skip"),
    repo: StyleHistoryRepository = Depends(get_repository),
) -> StyleHistoryListResponse:
    """Get style history for a user with pagination.

    Args:
        user_id: User identifier
        limit: Maximum records to return (default 10)
        offset: Records to skip (default 0)
        repo: Repository instance

    Returns:
        Paginated list of history records
    """
    items = await repo.get_by_user(user_id=user_id, limit=limit, offset=offset)
    total = await repo.count_by_user(user_id=user_id)

    return StyleHistoryListResponse(
        items=[
            StyleHistoryResponse(
                id=item.id,
                user_id=item.user_id,
                text=item.text,
                style_vector=item.style_vector,
                created_at=item.created_at.isoformat(),
            )
            for item in items
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{history_id}", response_model=StyleHistoryResponse)
async def get_history_by_id(
    history_id: UUID, repo: StyleHistoryRepository = Depends(get_repository)
) -> StyleHistoryResponse:
    """Get a specific style history record by ID.

    Args:
        history_id: History record UUID
        repo: Repository instance

    Returns:
        History record

    Raises:
        HTTPException: 404 if not found
    """
    history = await repo.get_by_id(history_id=history_id)
    if not history:
        raise HTTPException(status_code=404, detail="Style history not found")

    return StyleHistoryResponse(
        id=history.id,
        user_id=history.user_id,
        text=history.text,
        style_vector=history.style_vector,
        created_at=history.created_at.isoformat(),
    )


@router.delete("/{history_id}", status_code=204)
async def delete_history(
    history_id: UUID, repo: StyleHistoryRepository = Depends(get_repository)
) -> None:
    """Delete a style history record.

    Args:
        history_id: History record UUID to delete
        repo: Repository instance

    Raises:
        HTTPException: 404 if not found
    """
    deleted = await repo.delete(history_id=history_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Style history not found")
