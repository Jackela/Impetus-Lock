"""Streak API routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from server.api.schemas.streak import StreakResponse, StreakUpdateRequest
from server.auth import get_current_user
from server.infrastructure.persistence.database import get_session_optional
from server.models.streak import Streak
from server.models.user import User

router = APIRouter(prefix="/streaks", tags=["streaks"])


@router.get("/", response_model=StreakResponse)
async def get_streak(
    current_user: User = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_session_optional),
) -> StreakResponse:
    """Get user streak."""
    from sqlalchemy import select

    if not session:
        raise HTTPException(status_code=500, detail="Database not available")

    stmt = select(Streak).where(Streak.user_id == current_user.id)
    result = await session.execute(stmt)
    streak = result.scalar_one_or_none()

    if not streak:
        return StreakResponse(
            current_streak_days=0,
            longest_streak_days=0,
            streak_start_date=None,
            last_activity_date=None,
            grace_used=False,
        )

    return StreakResponse(
        current_streak_days=streak.current_streak_days,
        longest_streak_days=streak.longest_streak_days,
        streak_start_date=streak.streak_start_date.isoformat()
        if streak.streak_start_date
        else None,
        last_activity_date=streak.last_activity_date.isoformat()
        if streak.last_activity_date
        else None,
        grace_used=streak.grace_used,
    )


@router.post("/update", response_model=StreakResponse)
async def update_streak(
    request: StreakUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_session_optional),
) -> StreakResponse:
    """Update streak on user activity."""
    from datetime import UTC, datetime
    from sqlalchemy import select

    if not session:
        raise HTTPException(status_code=500, detail="Database not available")

    stmt = select(Streak).where(Streak.user_id == current_user.id)
    result = await session.execute(stmt)
    streak = result.scalar_one_or_none()

    now = datetime.now(UTC)
    today = now.date()

    if not streak:
        streak = Streak(
            user_id=current_user.id,
            current_streak_days=1,
            longest_streak_days=1,
            streak_start_date=now,
            last_activity_date=now,
            grace_used=False,
        )
        session.add(streak)
    else:
        last_date = streak.last_activity_date.date() if streak.last_activity_date else None
        if last_date != today:
            streak.current_streak_days += 1
            streak.last_activity_date = now
            if streak.current_streak_days > streak.longest_streak_days:
                streak.longest_streak_days = streak.current_streak_days

    await session.commit()
    await session.refresh(streak)

    return StreakResponse(
        current_streak_days=streak.current_streak_days,
        longest_streak_days=streak.longest_streak_days,
        streak_start_date=streak.streak_start_date.isoformat()
        if streak.streak_start_date
        else None,
        last_activity_date=streak.last_activity_date.isoformat()
        if streak.last_activity_date
        else None,
        grace_used=streak.grace_used,
    )
