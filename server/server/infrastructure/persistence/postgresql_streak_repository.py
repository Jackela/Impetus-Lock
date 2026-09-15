"""SQLAlchemy implementation of StreakRepository.

Implements user-scoped streak persistence with SQLAlchemy async,
preserving the exact select and commit/refresh sequences previously
embedded in the streak routes.

Constitutional Compliance:
- Article I (Simplicity): Uses framework-native SQLAlchemy async patterns
- Article IV (SOLID - DIP): Implements StreakRepository abstraction
- Article IV (SOLID - SRP): Single responsibility (streak persistence only)
- Article V (Documentation): Complete Google-style docstrings
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.domain.entities.streak import Streak as StreakEntity
from server.domain.repositories.streak_repository import StreakRepository
from server.models.streak import Streak as StreakModel


class PostgreSQLStreakRepository(StreakRepository):
    """SQLAlchemy async implementation of StreakRepository.

    Attributes:
        _session: SQLAlchemy async session (injected via constructor).
    """

    def __init__(self, session: AsyncSession) -> None:
        """Initialize repository with async session.

        Args:
            session: SQLAlchemy async session (constructor injection for DIP).
        """
        self._session = session

    async def get_by_user(self, user_id: UUID) -> StreakEntity | None:
        """Get the user's streak row if present.

        Args:
            user_id: User UUID to look up.

        Returns:
            StreakEntity | None: The user's streak, or None when absent.
        """
        stmt = select(StreakModel).where(StreakModel.user_id == user_id)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()

        return self._to_entity(model) if model else None

    async def upsert(self, streak: StreakEntity) -> StreakEntity:
        """Insert or update the user's streak row and commit/refresh.

        Args:
            streak: Streak entity carrying the values to persist.

        Returns:
            StreakEntity: Persisted streak as refreshed from storage.
        """
        result = await self._session.execute(
            select(StreakModel).where(StreakModel.user_id == streak.user_id)
        )
        model = result.scalar_one_or_none()

        if model is None:
            model = StreakModel(
                user_id=streak.user_id,
                current_streak_days=streak.current_streak_days,
                longest_streak_days=streak.longest_streak_days,
                streak_start_date=streak.streak_start_date,
                last_activity_date=streak.last_activity_date,
                grace_used=streak.grace_used,
            )
            self._session.add(model)
        else:
            model.current_streak_days = streak.current_streak_days
            model.longest_streak_days = streak.longest_streak_days
            model.streak_start_date = streak.streak_start_date
            model.last_activity_date = streak.last_activity_date
            model.grace_used = streak.grace_used

        await self._session.commit()
        await self._session.refresh(model)

        return self._to_entity(model)

    @staticmethod
    def _to_entity(model: StreakModel) -> StreakEntity:
        """Convert StreakModel (ORM) to Streak (domain entity).

        Args:
            model: SQLAlchemy ORM model.

        Returns:
            StreakEntity: Domain entity.
        """
        return StreakEntity(
            id=model.id,
            user_id=model.user_id,
            current_streak_days=model.current_streak_days,
            longest_streak_days=model.longest_streak_days,
            streak_start_date=model.streak_start_date,
            last_activity_date=model.last_activity_date,
            grace_used=model.grace_used,
        )
