"""Record user-scoped writing days and the one-day recovery allowance."""

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

        Count a UTC day once. Allow one missed day per streak and expose
        its use through the existing grace flag.

        Args:
            user_id: Authenticated user's UUID.

        Returns:
            Streak: Persisted streak as refreshed from storage.
        """
        await self._repository.lock_user(user_id)
        streak = await self._repository.get_by_user(user_id)
        now = datetime.now(UTC)

        if streak is None:
            streak = Streak(user_id=user_id)
        self._advance_streak(streak, now)

        return await self._repository.upsert(streak)

    @staticmethod
    def _advance_streak(streak: Streak, now: datetime) -> None:
        """Count the latest day while preserving the previous longest streak."""
        last_activity = streak.last_activity_date
        gap = 1
        if last_activity is not None:
            if last_activity.tzinfo is None:
                last_activity = last_activity.replace(tzinfo=UTC)
            gap = (now.date() - last_activity.astimezone(UTC).date()).days
            if gap <= 0:
                return

        can_recover = gap == 2 and not streak.grace_used
        if streak.current_streak_days == 0 or (gap > 1 and not can_recover):
            streak.current_streak_days = 1
            streak.streak_start_date = now
            streak.grace_used = False
        else:
            streak.current_streak_days += 1
            streak.grace_used = streak.grace_used or can_recover

        streak.last_activity_date = now
        streak.longest_streak_days = max(streak.longest_streak_days, streak.current_streak_days)
