"""Stats API routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from server.api.schemas.stats import InterventionBreakdownResponse, StatsResponse
from server.auth import get_current_user
from server.infrastructure.persistence.database import get_session_optional
from server.infrastructure.persistence.postgresql_writing_progress import PostgreSQLWritingProgress
from server.models.user import User

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/", response_model=StatsResponse)
async def get_stats(
    current_user: User = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_session_optional),
) -> StatsResponse:
    """Get user statistics."""
    if not session:
        raise HTTPException(status_code=500, detail="Database not available")

    stats = await PostgreSQLWritingProgress(session).get_statistics(current_user.id)

    return StatsResponse(
        total_tasks=stats.total_tasks,
        total_muse_interventions=stats.total_muse_interventions,
        total_loki_interventions=stats.total_loki_interventions,
        total_locks_created=stats.total_locks_created,
        writing_minutes=stats.writing_minutes,
        last_activity_at=stats.last_activity_at.isoformat() if stats.last_activity_at else None,
    )


@router.get("/breakdown", response_model=InterventionBreakdownResponse)
async def get_intervention_breakdown(
    current_user: User = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_session_optional),
) -> InterventionBreakdownResponse:
    """Get intervention type breakdown."""
    if not session:
        raise HTTPException(status_code=500, detail="Database not available")

    stats = await PostgreSQLWritingProgress(session).get_statistics(current_user.id)

    return InterventionBreakdownResponse(
        muse_count=stats.total_muse_interventions,
        loki_count=stats.total_loki_interventions,
    )
