"""Unit tests for the user-scoped StreakService.

Written BEFORE extraction (openspec/changes/refactor-route-service-boundaries
task 1.3) and kept as the service regression suite afterwards. They pin the
OBSERVED calculation: same UTC day never increments, any other last-activity
date increments, missing rows initialize at one, and persistence is always
finalized (upsert) — even when the value did not change. The grace/recovery
rule from the streaks specification is intentionally NOT asserted here; that
discrepancy stays explicit and untouched.
"""

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest

from server.application.services.streak_service import StreakService
from server.domain.entities.streak import Streak
from server.domain.repositories.streak_repository import StreakRepository

pytestmark = pytest.mark.asyncio


class FakeStreakRepository(StreakRepository):
    """In-memory fake used to observe what the service asks persistence to do."""

    def __init__(self) -> None:
        self.rows: dict[UUID, Streak] = {}
        self.upserted: list[Streak] = []
        self.next_id = uuid4()

    async def get_by_user(self, user_id: UUID) -> Streak | None:
        return self.rows.get(user_id)

    async def upsert(self, streak: Streak) -> Streak:
        persisted = Streak(
            user_id=streak.user_id,
            current_streak_days=streak.current_streak_days,
            longest_streak_days=streak.longest_streak_days,
            streak_start_date=streak.streak_start_date,
            last_activity_date=streak.last_activity_date,
            grace_used=streak.grace_used,
            id=self.next_id,
        )
        self.rows[streak.user_id] = persisted
        self.upserted.append(persisted)
        return persisted


@pytest.fixture
def repository() -> FakeStreakRepository:
    """Fresh fake repository."""
    return FakeStreakRepository()


@pytest.fixture
def service(repository: FakeStreakRepository) -> StreakService:
    """StreakService wired to the fake repository."""
    return StreakService(repository)


@pytest.fixture
def user_id() -> UUID:
    """Synthetic user id."""
    return uuid4()


def _existing(
    user_id: UUID,
    current: int,
    longest: int,
    last_activity: datetime | None,
) -> Streak:
    """Build an existing streak row."""
    return Streak(
        user_id=user_id,
        current_streak_days=current,
        longest_streak_days=longest,
        streak_start_date=datetime.now(UTC) - timedelta(days=current),
        last_activity_date=last_activity,
        grace_used=False,
    )


class TestGetStreak:
    """get_streak reads only the requesting user's row."""

    async def test_missing_row_returns_none(self, service: StreakService, user_id: UUID) -> None:
        """No row yields None (route renders the zero response)."""
        assert await service.get_streak(user_id) is None

    async def test_returns_the_user_row_only(
        self, service: StreakService, repository: FakeStreakRepository, user_id: UUID
    ) -> None:
        """Only the given user's row is returned."""
        other = _existing(uuid4(), 1, 1, datetime.now(UTC))
        mine = _existing(user_id, 7, 9, datetime.now(UTC))
        repository.rows[other.user_id] = other
        repository.rows[user_id] = mine

        assert await service.get_streak(user_id) == mine


class TestRecordActivity:
    """record_activity keeps the observed date calculation."""

    async def test_first_activity_initializes_one_day(
        self, service: StreakService, repository: FakeStreakRepository, user_id: UUID
    ) -> None:
        """A missing row initializes current=longest=1 with today's timestamps."""
        before = datetime.now(UTC)

        streak = await service.record_activity(user_id)

        assert streak.current_streak_days == 1
        assert streak.longest_streak_days == 1
        assert streak.grace_used is False
        assert streak.streak_start_date is not None
        assert streak.last_activity_date is not None
        assert before <= streak.last_activity_date.replace(tzinfo=UTC)

    async def test_same_utc_day_does_not_increment(
        self, service: StreakService, repository: FakeStreakRepository, user_id: UUID
    ) -> None:
        """Activity already recorded today leaves the counters unchanged."""
        now = datetime.now(UTC)
        repository.rows[user_id] = _existing(user_id, 4, 6, now)

        streak = await service.record_activity(user_id)

        assert streak.current_streak_days == 4
        assert streak.longest_streak_days == 6
        assert streak.last_activity_date == now

    async def test_same_day_still_persists(
        self, service: StreakService, repository: FakeStreakRepository, user_id: UUID
    ) -> None:
        """Same-day activity still finalizes persistence (current commit/refresh)."""
        repository.rows[user_id] = _existing(user_id, 4, 6, datetime.now(UTC))

        await service.record_activity(user_id)

        assert len(repository.upserted) == 1

    async def test_earlier_date_increments_and_raises_longest(
        self, service: StreakService, repository: FakeStreakRepository, user_id: UUID
    ) -> None:
        """An earlier last-activity date increments and bumps the longest."""
        repository.rows[user_id] = _existing(user_id, 3, 3, datetime.now(UTC) - timedelta(days=1))

        streak = await service.record_activity(user_id)

        assert streak.current_streak_days == 4
        assert streak.longest_streak_days == 4

    async def test_earlier_date_keeps_higher_longest(
        self, service: StreakService, repository: FakeStreakRepository, user_id: UUID
    ) -> None:
        """Incrementing below the historic longest leaves the longest unchanged."""
        repository.rows[user_id] = _existing(user_id, 2, 9, datetime.now(UTC) - timedelta(days=2))

        streak = await service.record_activity(user_id)

        assert streak.current_streak_days == 3
        assert streak.longest_streak_days == 9

    async def test_future_dated_activity_still_increments(
        self, service: StreakService, repository: FakeStreakRepository, user_id: UUID
    ) -> None:
        """Any date difference — even a future last activity — increments."""
        repository.rows[user_id] = _existing(user_id, 1, 1, datetime.now(UTC) + timedelta(days=2))

        streak = await service.record_activity(user_id)

        assert streak.current_streak_days == 2

    async def test_null_last_activity_increments(
        self, service: StreakService, repository: FakeStreakRepository, user_id: UUID
    ) -> None:
        """A row without last-activity date increments on activity."""
        repository.rows[user_id] = _existing(user_id, 5, 7, None)

        streak = await service.record_activity(user_id)

        assert streak.current_streak_days == 6
        assert streak.longest_streak_days == 7

    async def test_activity_is_scoped_to_the_user(
        self, service: StreakService, repository: FakeStreakRepository, user_id: UUID
    ) -> None:
        """Recording activity never touches another user's row."""
        other_id = uuid4()
        repository.rows[other_id] = _existing(other_id, 2, 2, datetime.now(UTC))

        await service.record_activity(user_id)

        assert repository.rows[other_id].current_streak_days == 2
        assert user_id in repository.rows
