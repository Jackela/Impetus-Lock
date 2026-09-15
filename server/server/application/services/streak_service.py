"""Streak Service (Business Logic Layer).

Orchestrates user-scoped streak operations while keeping the HTTP boundary
free of persistence concerns and date arithmetic. Extracted from the streak
routes by openspec/changes/refactor-route-service-boundaries.

IMPORTANT: this service reproduces the OBSERVED calculation exactly — the
last-activity date differing from today (in UTC) increments the streak, the
same UTC day does not. The grace/recovery rule in the streaks specification
is NOT implemented and is tracked as separate behavior work; this refactor
must not change the calculation.

Constitutional Compliance:
- Article IV (SOLID - SRP): Business logic separated from API and persistence
- Article IV (SOLID - DIP): Depends on StreakRepository abstraction
- Article V (Documentation): Complete Google-style docstrings
"""

from datetime import UTC, datetime
from uuid import UUID

from server.domain.entities.streak import Streak
from server.domain.repositories.streak_repository import StreakRepository


class StreakService:
    """Service layer for user-scoped streak operations.

    Every operation takes the authenticated user's id; only that user's
    streak row is read or changed.

    Attributes:
        _repository: Streak repository for persistence operations.

    Example:
        ```python
        service = StreakService(PostgreSQLStreakRepository(session))
        streak = await service.record_activity(user.id)
        ```
    """

    def __init__(self, repository: StreakRepository) -> None:
        """Initialize service with repository.

        Args:
            repository: Streak repository implementation (constructor injection).
        """
        self._repository = repository

    async def get_streak(self, user_id: UUID) -> Streak | None:
        """Get the user's streak.

        Args:
            user_id: Authenticated user's UUID.

        Returns:
            Streak | None: The user's streak, or None when absent (the route
            renders the zero-valued response).
        """
        return await self._repository.get_by_user(user_id)

    async def record_activity(self, user_id: UUID) -> Streak:
        """Record user activity and return the resulting streak.

        Applies the observed calculation: first activity initializes the
        streak at one day; a last-activity date different from today (UTC)
        increments it (and raises the longest when exceeded); the same UTC
        day leaves the counters unchanged. Persistence (commit/refresh)
        always finalizes the operation, exactly as before extraction.

        Args:
            user_id: Authenticated user's UUID.

        Returns:
            Streak: Persisted streak as refreshed from storage.
        """
        streak = await self._repository.get_by_user(user_id)

        now = datetime.now(UTC)
        today = now.date()

        if streak is None:
            streak = Streak(
                user_id=user_id,
                current_streak_days=1,
                longest_streak_days=1,
                streak_start_date=now,
                last_activity_date=now,
                grace_used=False,
            )
        else:
            last_date = streak.last_activity_date.date() if streak.last_activity_date else None
            if last_date != today:
                streak.current_streak_days += 1
                streak.last_activity_date = now
                if streak.current_streak_days > streak.longest_streak_days:
                    streak.longest_streak_days = streak.current_streak_days

        return await self._repository.upsert(streak)
