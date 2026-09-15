"""Characterization tests pinning the current /streaks API contract.

Frozen safety net for the route-to-service extraction described in
openspec/changes/refactor-route-service-boundaries. These tests exercise the
real sqlite-backed session and pin the CURRENT external contract: response
fields, zero response when the row is absent, observed UTC date calculation
(same-day no increment; ANY other last-activity date increments — the grace
rule in the streaks specification is NOT implemented today and stays
untouched), user isolation and the no-session 500 outcomes. They must pass
UNCHANGED before and after the refactor.
"""

from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient

from server.api.main import app
from server.auth.dependencies import get_current_user
from server.infrastructure.persistence.database import (
    get_db_manager,
    get_session_optional,
)
from server.models.streak import Streak
from server.models.user import User

ZERO_RESPONSE = {
    "current_streak_days": 0,
    "longest_streak_days": 0,
    "streak_start_date": None,
    "last_activity_date": None,
    "grace_used": False,
}


def _make_user(email: str) -> User:
    """Create a synthetic authenticated user (auth dependency is overridden)."""
    return User(id=uuid4(), email=email, password_hash="mock_hash")


@pytest.fixture
def user_a() -> User:
    """First synthetic user (streak owner in isolation tests)."""
    return _make_user(f"stk-a-{uuid4()}@example.com")


@pytest.fixture
def user_b() -> User:
    """Second synthetic user (foreign user in isolation tests)."""
    return _make_user(f"stk-b-{uuid4()}@example.com")


@pytest.fixture
def current_user(user_a: User) -> AsyncGenerator[dict[str, User], None]:
    """Override auth with a mutable holder so tests can switch users."""
    holder = {"user": user_a}
    app.dependency_overrides[get_current_user] = lambda: holder["user"]
    yield holder
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def no_session() -> AsyncGenerator[None, None]:
    """Simulate database unavailability for the optional session dependency."""
    app.dependency_overrides[get_session_optional] = lambda: None
    yield None
    app.dependency_overrides.pop(get_session_optional, None)


async def seed_streak(
    user_id: UUID,
    current: int,
    longest: int,
    last_activity: datetime | None,
    start: datetime | None = None,
    grace_used: bool = False,
) -> None:
    """Insert a streak row directly through the global database manager."""
    streak = Streak(
        user_id=user_id,
        current_streak_days=current,
        longest_streak_days=longest,
        streak_start_date=start,
        last_activity_date=last_activity,
        grace_used=grace_used,
    )
    async with get_db_manager().session() as session:
        session.add(streak)
        await session.commit()


async def _update_streak(client: AsyncClient) -> dict[str, Any]:
    """POST /streaks/update and return the parsed response body."""
    response = await client.post("/streaks/update", json={})
    assert response.status_code == 200, response.text
    return response.json()


class TestStreakGetContract:
    """Pins GET /streaks/."""

    async def test_get_missing_row_returns_zero_response(
        self, async_client: AsyncClient, current_user: dict[str, User]
    ) -> None:
        """A user without a streak row gets the exact zero-valued response."""
        response = await async_client.get("/streaks/")

        assert response.status_code == 200
        assert response.json() == ZERO_RESPONSE

    async def test_get_returns_existing_row_fields(
        self, async_client: AsyncClient, current_user: dict[str, User], user_a: User
    ) -> None:
        """An existing row is returned with all current fields serialized."""
        start = datetime.now(UTC) - timedelta(days=3)
        await seed_streak(
            user_a.id,
            current=3,
            longest=5,
            last_activity=datetime.now(UTC) - timedelta(days=1),
            start=start,
            grace_used=True,
        )

        response = await async_client.get("/streaks/")

        assert response.status_code == 200
        data = response.json()
        assert set(data.keys()) == set(ZERO_RESPONSE.keys())
        assert data["current_streak_days"] == 3
        assert data["longest_streak_days"] == 5
        # sqlite roundtrips the tz-aware seed value as naive UTC wall time.
        assert data["streak_start_date"] == start.replace(tzinfo=None).isoformat()
        assert data["grace_used"] is True


class TestStreakUpdateDateLogic:
    """Pins the observed (non-grace) streak calculation."""

    async def test_update_initializes_streak_at_one(
        self, async_client: AsyncClient, current_user: dict[str, User]
    ) -> None:
        """First activity creates the row with 1/1 and today's timestamps."""
        data = await _update_streak(async_client)

        assert data["current_streak_days"] == 1
        assert data["longest_streak_days"] == 1
        assert data["grace_used"] is False
        assert data["streak_start_date"] is not None
        assert data["last_activity_date"] is not None

        persisted = await async_client.get("/streaks/")
        assert persisted.json() == data

    async def test_update_same_utc_day_does_not_increment(
        self, async_client: AsyncClient, current_user: dict[str, User], user_a: User
    ) -> None:
        """Activity already recorded today leaves the streak unchanged."""
        now = datetime.now(UTC)
        await seed_streak(user_a.id, current=4, longest=6, last_activity=now, start=now)

        data = await _update_streak(async_client)

        assert data["current_streak_days"] == 4
        assert data["longest_streak_days"] == 6
        # sqlite roundtrips the tz-aware seed value as naive UTC wall time.
        assert data["last_activity_date"] == now.replace(tzinfo=None).isoformat()

    async def test_update_later_date_increments_and_raises_longest(
        self, async_client: AsyncClient, current_user: dict[str, User], user_a: User
    ) -> None:
        """A last activity on an earlier date increments and bumps the longest."""
        await seed_streak(
            user_a.id,
            current=3,
            longest=3,
            last_activity=datetime.now(UTC) - timedelta(days=1),
            start=datetime.now(UTC) - timedelta(days=3),
        )

        data = await _update_streak(async_client)

        assert data["current_streak_days"] == 4
        assert data["longest_streak_days"] == 4

    async def test_update_later_date_keeps_higher_longest(
        self, async_client: AsyncClient, current_user: dict[str, User], user_a: User
    ) -> None:
        """Incrementing below the historic longest leaves the longest unchanged."""
        await seed_streak(
            user_a.id,
            current=2,
            longest=9,
            last_activity=datetime.now(UTC) - timedelta(days=2),
        )

        data = await _update_streak(async_client)

        assert data["current_streak_days"] == 3
        assert data["longest_streak_days"] == 9

    async def test_update_future_dated_last_activity_still_increments(
        self, async_client: AsyncClient, current_user: dict[str, User], user_a: User
    ) -> None:
        """Any date difference (even a future last activity) increments today."""
        await seed_streak(
            user_a.id,
            current=1,
            longest=1,
            last_activity=datetime.now(UTC) + timedelta(days=2),
        )

        data = await _update_streak(async_client)

        assert data["current_streak_days"] == 2
        assert data["longest_streak_days"] == 2

    async def test_update_null_last_activity_increments(
        self, async_client: AsyncClient, current_user: dict[str, User], user_a: User
    ) -> None:
        """A row without last activity date increments on first activity."""
        await seed_streak(user_a.id, current=5, longest=7, last_activity=None)

        data = await _update_streak(async_client)

        assert data["current_streak_days"] == 6
        assert data["longest_streak_days"] == 7

    async def test_update_requires_a_body(
        self, async_client: AsyncClient, current_user: dict[str, User]
    ) -> None:
        """POST without a JSON body returns 422 (body schema is required)."""
        response = await async_client.post("/streaks/update")

        assert response.status_code == 422


class TestStreakTwoUserIsolation:
    """Pins per-user streak isolation."""

    async def test_users_have_separate_rows(
        self,
        async_client: AsyncClient,
        current_user: dict[str, User],
        user_a: User,
        user_b: User,
    ) -> None:
        """Each user reads and writes only their own streak row."""
        data_a = await _update_streak(async_client)

        current_user["user"] = user_b
        assert (await async_client.get("/streaks/")).json() == ZERO_RESPONSE

        data_b = await _update_streak(async_client)
        assert data_b["current_streak_days"] == 1

        current_user["user"] = user_a
        assert (await async_client.get("/streaks/")).json() == data_a


class TestStreakNoSessionContract:
    """Pins degraded outcomes when no database session is available."""

    async def test_get_returns_500_database_not_available(
        self, async_client: AsyncClient, current_user: dict[str, User], no_session: None
    ) -> None:
        """Without a session GET returns 500 'Database not available'."""
        response = await async_client.get("/streaks/")

        assert response.status_code == 500
        assert response.json() == {"detail": "Database not available"}

    async def test_update_returns_500_database_not_available(
        self, async_client: AsyncClient, current_user: dict[str, User], no_session: None
    ) -> None:
        """Without a session POST /update returns 500 'Database not available'."""
        response = await async_client.post("/streaks/update", json={})

        assert response.status_code == 500
        assert response.json() == {"detail": "Database not available"}


class TestStreakAuthContract:
    """Pins authentication failure behavior."""

    async def test_unauthenticated_requests_return_401(self, async_client: AsyncClient) -> None:
        """Without authentication both streak endpoints return 401."""
        get_response = await async_client.get("/streaks/")
        assert get_response.status_code == 401
        assert get_response.json()["detail"] == "Not authenticated"

        update_response = await async_client.post("/streaks/update", json={})
        assert update_response.status_code == 401
        assert update_response.json()["detail"] == "Not authenticated"
