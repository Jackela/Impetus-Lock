"""Transactional writing statistics and achievement persistence."""

from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from server.application.services.streak_service import StreakService
from server.domain.writing_progress import WRITING_MILESTONES
from server.infrastructure.persistence.models import InterventionActionModel, TaskModel
from server.infrastructure.persistence.postgresql_streak_repository import (
    PostgreSQLStreakRepository,
    lock_writing_account,
)
from server.models.achievement import Achievement
from server.models.user_stats import UserStats


class PostgreSQLWritingProgress:
    """Read writing statistics and record progress in the originating write transaction."""

    def __init__(self, session: AsyncSession) -> None:
        """Use the request's task or intervention session for analytics writes."""
        self._session = session
        self._streaks = StreakService(PostgreSQLStreakRepository(session, commit_on_upsert=False))

    async def get_statistics(self, user_id: UUID) -> UserStats:
        """Read tracked totals or derive them from the remaining pre-tracking history."""
        stats = await self._get_tracked_statistics(user_id)
        if stats is not None:
            return stats
        return await self._get_historical_statistics(user_id)

    async def record_task(
        self, user_id: UUID, activity_at: datetime, *, created: bool, added_locks: int
    ) -> None:
        """Update writing-day and task milestones for a successfully saved draft."""
        # Recording the streak locks the account for the rest of this transaction.
        streak = await self._streaks.record_activity(user_id)
        stats = await self._get_tracked_statistics(user_id)
        if stats is None:
            stats = await self._bootstrap_statistics(user_id)
        else:
            stats.total_tasks += int(created)
            stats.total_locks_created += added_locks
        self._touch(stats, activity_at)
        await self._award_milestones(stats, activity_at, streak=streak.longest_streak_days)

    async def record_intervention(
        self, user_id: UUID, mode: Literal["muse", "loki"], activity_at: datetime
    ) -> None:
        """Update intervention totals and milestones once history has been written."""
        await lock_writing_account(self._session, user_id)
        stats = await self._get_tracked_statistics(user_id)
        if stats is None:
            stats = await self._bootstrap_statistics(user_id)
        elif mode == "muse":
            stats.total_muse_interventions += 1
        else:
            stats.total_loki_interventions += 1
        self._touch(stats, activity_at)
        await self._award_milestones(stats, activity_at)

    async def _get_tracked_statistics(self, user_id: UUID) -> UserStats | None:
        """Read the account's cumulative statistics row when it exists."""
        return await self._session.scalar(select(UserStats).where(UserStats.user_id == user_id))

    async def _bootstrap_statistics(self, user_id: UUID) -> UserStats:
        """Seed statistics from observable rows, including the pending write."""
        stats = await self._get_historical_statistics(user_id)
        self._session.add(stats)
        return stats

    async def _get_historical_statistics(self, user_id: UUID) -> UserStats:
        """Recover retained task and intervention facts without inferring duration."""
        tasks = (
            await self._session.execute(
                select(TaskModel.lock_ids, TaskModel.updated_at).where(TaskModel.user_id == user_id)
            )
        ).all()
        action = InterventionActionModel
        interventions = (
            await self._session.execute(
                select(action.mode, func.count(action.id), func.max(action.issued_at))
                .join(TaskModel, TaskModel.id == action.task_id)
                .where(TaskModel.user_id == user_id)
                .group_by(action.mode)
            )
        ).all()
        counts = {mode: count for mode, count, _ in interventions}
        times = [updated_at for _, updated_at in tasks] + [
            issued_at for _, _, issued_at in interventions if issued_at is not None
        ]
        return UserStats(
            user_id=user_id,
            total_tasks=len(tasks),
            total_muse_interventions=counts.get("muse", 0),
            total_loki_interventions=counts.get("loki", 0),
            total_locks_created=sum(len(set(lock_ids)) for lock_ids, _ in tasks),
            writing_minutes=0,
            last_activity_at=max(times, default=None),
        )

    @staticmethod
    def _touch(stats: UserStats, activity_at: datetime) -> None:
        """Keep the latest activity time if writes finish out of timestamp order."""
        current = stats.last_activity_at
        if current is None or activity_at > current.replace(tzinfo=current.tzinfo or UTC):
            stats.last_activity_at = activity_at

    async def _award_milestones(
        self, stats: UserStats, earned_at: datetime, *, streak: int = 0
    ) -> None:
        """Persist eligible milestones once while holding the account write lock."""
        counts = {
            "tasks": stats.total_tasks,
            "muse": stats.total_muse_interventions,
            "loki": stats.total_loki_interventions,
            "streak": streak,
        }
        eligible = {
            milestone.achievement_type: milestone
            for milestone in WRITING_MILESTONES
            if counts[milestone.counter] >= milestone.threshold
        }
        if not eligible:
            return
        earned = await self._session.scalars(
            select(Achievement.achievement_type).where(
                Achievement.user_id == stats.user_id,
                Achievement.achievement_type.in_(eligible),
            )
        )
        for key in eligible.keys() - set(earned):
            milestone = eligible[key]
            self._session.add(
                Achievement(
                    user_id=stats.user_id,
                    achievement_type=key,
                    name=milestone.name,
                    description=milestone.description,
                    earned_at=earned_at,
                )
            )
