"""Achievement management API routes."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from server.api.schemas.achievement import (
    AchievementDefinition,
    AchievementDefinitionsResponse,
    AchievementListResponse,
    AchievementResponse,
)
from server.auth import get_current_user
from server.infrastructure.persistence.database import get_session_optional
from server.models.achievement import Achievement
from server.models.user import User

router = APIRouter(prefix="/achievements", tags=["achievements"])

ACHIEVEMENT_DEFINITIONS = [
    AchievementDefinition(
        achievement_type="first_task", name="First Step", description="Create your first task"
    ),
    AchievementDefinition(
        achievement_type="ten_tasks", name="Getting Started", description="Create 10 tasks"
    ),
    AchievementDefinition(
        achievement_type="hundred_tasks", name="Century", description="Create 100 tasks"
    ),
    AchievementDefinition(
        achievement_type="first_muse",
        name="Muse Touched",
        description="Receive your first Muse intervention",
    ),
    AchievementDefinition(
        achievement_type="first_loki",
        name="Chaos Embraced",
        description="Receive your first Loki intervention",
    ),
    AchievementDefinition(
        achievement_type="streak_3",
        name="Three Day Streak",
        description="Maintain a 3-day writing streak",
    ),
    AchievementDefinition(
        achievement_type="streak_7",
        name="Week Warrior",
        description="Maintain a 7-day writing streak",
    ),
    AchievementDefinition(
        achievement_type="streak_30",
        name="Monthly Master",
        description="Maintain a 30-day writing streak",
    ),
]


@router.get("/definitions", response_model=AchievementDefinitionsResponse)
async def get_achievement_definitions() -> AchievementDefinitionsResponse:
    """Get all achievement definitions."""
    return AchievementDefinitionsResponse(achievements=ACHIEVEMENT_DEFINITIONS)


@router.get("/", response_model=AchievementListResponse)
async def list_achievements(
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
    current_user: User = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_session_optional),
) -> AchievementListResponse:
    """List all achievements for current user."""
    from sqlalchemy import select, func

    if not session:
        return AchievementListResponse(total=0, limit=limit, offset=offset, achievements=[])

    stmt = select(func.count(Achievement.id)).where(Achievement.user_id == current_user.id)
    total = (await session.execute(stmt)).scalar_one_or_none() or 0

    stmt = (
        select(Achievement)
        .where(Achievement.user_id == current_user.id)
        .order_by(Achievement.earned_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await session.execute(stmt)
    achievements = result.scalars().all()

    return AchievementListResponse(
        total=total,
        limit=limit,
        offset=offset,
        achievements=[
            AchievementResponse(
                id=str(a.id),
                achievement_type=a.achievement_type,
                name=a.name,
                description=a.description,
                earned_at=a.earned_at.isoformat(),
                metadata=None,
            )
            for a in achievements
        ],
    )


@router.get("/{achievement_id}", response_model=AchievementResponse)
async def get_achievement(
    achievement_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_session_optional),
) -> AchievementResponse:
    """Get achievement by ID."""
    from sqlalchemy import select

    if not session:
        from fastapi import HTTPException

        raise HTTPException(status_code=500, detail="Database not available")

    stmt = select(Achievement).where(
        Achievement.id == achievement_id,
        Achievement.user_id == current_user.id,
    )
    result = await session.execute(stmt)
    achievement = result.scalar_one_or_none()

    if not achievement:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Achievement not found")

    return AchievementResponse(
        id=str(achievement.id),
        achievement_type=achievement.achievement_type,
        name=achievement.name,
        description=achievement.description,
        earned_at=achievement.earned_at.isoformat(),
        metadata=None,
    )
