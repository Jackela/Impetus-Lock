"""Streak API routes.

HTTP adapter for streak read/update. Authentication, request validation,
response schemas and HTTP exception mapping stay here; the observed streak
date calculation and persistence are delegated to the injected user-scoped
StreakService. The grace/recovery rule from the streaks specification is
NOT implemented here or in the service; that discrepancy is separate work.

Constitutional Compliance:
- Article IV (SOLID - SRP): Endpoints are HTTP adapters over StreakService
- Article IV (SOLID - DIP): Depends on the service abstraction
- Article V (Documentation): Complete API documentation
"""

from fastapi import APIRouter, Depends, HTTPException

from server.api.dependencies import get_streak_service
from server.api.schemas.streak import StreakResponse, StreakUpdateRequest
from server.application.services.streak_service import StreakService
from server.auth import get_current_user
from server.domain.entities.streak import Streak
from server.models.user import User

router = APIRouter(prefix="/streaks", tags=["streaks"])


def _to_response(streak: Streak) -> StreakResponse:
    """Serialize a streak domain entity to the API response schema.

    Args:
        streak: Streak domain entity.

    Returns:
        StreakResponse: API response model.
    """
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


@router.get("/", response_model=StreakResponse)
async def get_streak(
    current_user: User = Depends(get_current_user),
    service: StreakService | None = Depends(get_streak_service),
) -> StreakResponse:
    """Get user streak (zero-valued response when no row exists).

    Args:
        current_user: Authenticated user (injected via auth).
        service: User-scoped streak service (None when DB unavailable).

    Returns:
        StreakResponse: The user's streak, or the zero-valued response.

    Raises:
        HTTPException: 500 if no database session is available.
    """
    if service is None:
        raise HTTPException(status_code=500, detail="Database not available")

    streak = await service.get_streak(user_id=current_user.id)

    if streak is None:
        return StreakResponse(
            current_streak_days=0,
            longest_streak_days=0,
            streak_start_date=None,
            last_activity_date=None,
            grace_used=False,
        )

    return _to_response(streak)


@router.post("/update", response_model=StreakResponse)
async def update_streak(
    request: StreakUpdateRequest,
    current_user: User = Depends(get_current_user),
    service: StreakService | None = Depends(get_streak_service),
) -> StreakResponse:
    """Update streak on user activity.

    Args:
        request: Streak update request.
        current_user: Authenticated user (injected via auth).
        service: User-scoped streak service (None when DB unavailable).

    Returns:
        StreakResponse: The resulting streak.

    Raises:
        HTTPException: 500 if no database session is available.
    """
    if service is None:
        raise HTTPException(status_code=500, detail="Database not available")

    streak = await service.record_activity(user_id=current_user.id)

    return _to_response(streak)
