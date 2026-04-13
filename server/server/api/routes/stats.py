"""Stats API routes."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from server.api.schemas.stats import (
    InterventionBreakdownResponse,
    StatsPeriodResponse,
    StatsResponse,
)
from server.auth import get_current_user
from server.infrastructure.persistence.database import get_session_optional
from server.models.user_stats import UserStats
from server.models.user import User

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/", response_model=StatsResponse)
async def get_stats(
    current_user: User = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_session_optional),
) -> StatsResponse:
    """Get user statistics."""
    from sqlalchemy import select

    if not session:
        raise HTTPException(status_code=500, detail="Database not available")

    stmt = select(UserStats).where(UserStats.user_id == current_user.id)
    result = await session.execute(stmt)
    stats = result.scalar_one_or_none()

    if not stats:
        return StatsResponse(
            total_tasks=0,
            total_muse_interventions=0,
            total_loki_interventions=0,
            total_locks_created=0,
            writing_minutes=0,
            last_activity_at=None,
        )

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
    from sqlalchemy import select

    if not session:
        raise HTTPException(status_code=500, detail="Database not available")

    stmt = select(UserStats).where(UserStats.user_id == current_user.id)
    result = await session.execute(stmt)
    stats = result.scalar_one_or_none()

    if not stats:
        return InterventionBreakdownResponse(muse_count=0, loki_count=0)

    return InterventionBreakdownResponse(
        muse_count=stats.total_muse_interventions,
        loki_count=stats.total_loki_interventions,
    )


@router.get("/period/{period}", response_model=StatsPeriodResponse)
async def get_stats_by_period(
    period: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_session_optional),
) -> StatsPeriodResponse:
    """Get stats by period (day, week, month)."""
    if period not in ("day", "week", "month"):
        raise HTTPException(status_code=400, detail="Period must be day, week, or month")

    return StatsPeriodResponse(
        period=period,
        tasks_created=0,
        interventions=0,
        locks_created=0,
        writing_minutes=0,
    )
