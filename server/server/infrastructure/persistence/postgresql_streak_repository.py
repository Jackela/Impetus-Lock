"""User-scoped streak persistence with SQLAlchemy async."""

from typing import Any, cast
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.engine import CursorResult
from sqlalchemy.exc import InvalidRequestError
from sqlalchemy.ext.asyncio import AsyncSession

from server.domain.entities.streak import Streak as StreakEntity
from server.domain.repositories.streak_repository import StreakRepository
from server.models.streak import Streak as StreakModel
from server.models.user import User


async def lock_writing_account(session: AsyncSession, user_id: UUID) -> None:
    """Serialize writing activity for an account, including its first write."""
    # PostgreSQL FOR NO KEY UPDATE cooperates with the FK key-share locks
    # already taken by task creation and new intervention history.
    await session.execute(select(User.id).where(User.id == user_id).with_for_update(key_share=True))


class PostgreSQLStreakRepository(StreakRepository):
    """SQLAlchemy async implementation of StreakRepository.

    Attributes:
        _session: SQLAlchemy async session (injected via constructor).
    """

    def __init__(self, session: AsyncSession, *, commit_on_upsert: bool = True) -> None:
        """Initialize repository with async session.

        Args:
            session: SQLAlchemy async session (constructor injection for DIP).
            commit_on_upsert: False when the owning task transaction commits.
        """
        self._session = session
        self._commit_on_upsert = commit_on_upsert

    async def lock_user(self, user_id: UUID) -> None:
        """Lock the owning account even when it has no streak row yet."""
        await lock_writing_account(self._session, user_id)

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
        """Insert or update the user's streak row, then read back.

        Writes before reading: an entity carrying a row id issues one Core
        UPDATE targeted at that primary key (``synchronize_session=False``
        for the async driver), with no SELECT preceding the write. A missed
        UPDATE (rowcount 0, e.g. the row vanished concurrently) and an
        entity without id both take the insert branch, matching the
        previous "lookup found nothing" semantics. Exactly one read builds
        the returned entity: ``session.get`` on the update
        branch, ``refresh`` on the insert branch.

        Args:
            streak: Streak entity carrying the values to persist.

        Returns:
            StreakEntity: Persisted streak as refreshed from storage.

        Raises:
            InvalidRequestError: The updated row disappeared before the read.
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
            await self._finish_write()
            model = await self._session.get(StreakModel, streak.id, populate_existing=True)
            if model is None:
                raise InvalidRequestError(f"Streak row {streak.id} disappeared after update")
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
            await self._finish_write()
            await self._session.refresh(model)

        return self._to_entity(model)

    async def _finish_write(self) -> None:
        """Keep task-triggered streaks in the task transaction."""
        if self._commit_on_upsert:
            await self._session.commit()
        else:
            await self._session.flush()

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
