"""SQLAlchemy implementation of StreakRepository.

Implements user-scoped streak persistence with SQLAlchemy async. The update
path writes first: upsert() targets the existing row with one primary-key
Core UPDATE (no pre-write re-read), commits, then performs exactly one
post-commit read to build the "refreshed from storage" return value. The
whole record_activity path keeps the pre-refactor route's shape of one
pre-read (get_by_user), one write, and one post-commit read.

Constitutional Compliance:
- Article I (Simplicity): Uses framework-native SQLAlchemy async patterns
- Article IV (SOLID - DIP): Implements StreakRepository abstraction
- Article IV (SOLID - SRP): Single responsibility (streak persistence only)
- Article V (Documentation): Complete Google-style docstrings
"""

from typing import Any, cast
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.engine import CursorResult
from sqlalchemy.exc import InvalidRequestError
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
        """Insert or update the user's streak row and commit, then read back.

        Writes before reading: an entity carrying a row id issues one Core
        UPDATE targeted at that primary key (``synchronize_session=False``
        for the async driver), with no SELECT preceding the write. A missed
        UPDATE (rowcount 0, e.g. the row vanished concurrently) and an
        entity without id both take the insert branch, matching the
        previous "lookup found nothing" semantics. After commit exactly one
        read builds the returned entity: ``session.get`` on the update
        branch, ``refresh`` on the insert branch.

        Args:
            streak: Streak entity carrying the values to persist.

        Returns:
            StreakEntity: Persisted streak as refreshed from storage.

        Raises:
            InvalidRequestError: The updated row disappeared before the
                post-commit read (previously raised by refresh alike).
        """
        updated = False
        if streak.id is not None:
            result = await self._session.execute(
                update(StreakModel)
                .where(StreakModel.id == streak.id)
                .values(
                    current_streak_days=streak.current_streak_days,
                    longest_streak_days=streak.longest_streak_days,
                    streak_start_date=streak.streak_start_date,
                    last_activity_date=streak.last_activity_date,
                    grace_used=streak.grace_used,
                )
                .execution_options(synchronize_session=False)
            )
            updated = cast(CursorResult[Any], result).rowcount == 1

        if updated and streak.id is not None:
            await self._session.commit()
            model = await self._session.get(StreakModel, streak.id)
            if model is None:
                raise InvalidRequestError(f"Streak row {streak.id} disappeared after update commit")
        else:
            model = StreakModel(
                user_id=streak.user_id,
                current_streak_days=streak.current_streak_days,
                longest_streak_days=streak.longest_streak_days,
                streak_start_date=streak.streak_start_date,
                last_activity_date=streak.last_activity_date,
                grace_used=streak.grace_used,
            )
            self._session.add(model)
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
