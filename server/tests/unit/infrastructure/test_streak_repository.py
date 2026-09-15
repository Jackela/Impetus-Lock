"""SQL-level and spy tests pinning the streak update read/write shape.

Guards the streak persistence hardening: the record_activity path must keep
the pre-refactor route's statement shape — exactly ONE pre-read
(get_by_user), exactly ONE write (targeted UPDATE by id, or INSERT for a
missing row), and exactly ONE post-commit read (session.get / refresh) to
build the "refreshed from storage" return value. upsert() performs no
re-reading SELECT before the write.

Counting method: the engine-level ``before_cursor_execute`` hook observes
every statement sent to the database on the session's engine — including
INSERTs emitted by the ORM flush, which do not pass through
Session.execute — and the emitted SQL kind (SELECT from / UPDATE / INSERT
INTO the streaks table) distinguishes reads from writes.

Constitutional Compliance:
- Article III (TDD): Tests updated red against the double-read behavior first
- Article I (Simplicity): Plain SQLAlchemy events and autospec'd sessions
"""

from collections.abc import AsyncIterator, Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any, cast
from unittest.mock import create_autospec
from uuid import UUID, uuid4

import pytest
from sqlalchemy import Select, Update, event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from server.application.services.streak_service import StreakService
from server.domain.entities.streak import Streak
from server.infrastructure.persistence.models import Base
from server.infrastructure.persistence.postgresql_streak_repository import (
    PostgreSQLStreakRepository,
)
from server.models.streak import Streak as StreakModel
from server.models.user import User


@dataclass
class _StreakStatementCounts:
    """Tally of ORM executes touching the streaks table, by statement kind."""

    selects: int = 0
    updates: int = 0
    inserts: int = 0
    statements: list[Any] = field(default_factory=list)


@pytest.fixture
async def session() -> AsyncIterator[AsyncSession]:
    """Provide a session bound to a fresh in-memory database (users + streaks).

    Mirrors the production session factory (expire_on_commit=False) so the
    post-commit read behavior under test matches production wiring.
    """
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")

    def _create_tables(sync_connection: Any) -> None:
        Base.metadata.create_all(sync_connection, tables=[User.__table__, StreakModel.__table__])

    async with engine.begin() as conn:
        await conn.run_sync(_create_tables)

    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as current_session:
        yield current_session

    await engine.dispose()


@contextmanager
def _count_streak_statements(session: AsyncSession) -> Iterator[_StreakStatementCounts]:
    """Tally the SQL statements that read or write the streaks table.

    Args:
        session: Session whose engine traffic is observed.

    Yields:
        _StreakStatementCounts: Accumulator filled while the context is open.
    """
    counts = _StreakStatementCounts()

    def _record(
        connection: Any,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        normalized = " ".join(statement.split()).upper()
        if normalized.startswith("SELECT") and "FROM STREAKS" in normalized:
            counts.selects += 1
            counts.statements.append(normalized)
        elif normalized.startswith("UPDATE STREAKS"):
            counts.updates += 1
            counts.statements.append(normalized)
        elif normalized.startswith("INSERT INTO STREAKS"):
            counts.inserts += 1
            counts.statements.append(normalized)

    engine = cast(Any, session.bind).sync_engine
    event.listen(engine, "before_cursor_execute", _record)
    try:
        yield counts
    finally:
        event.remove(engine, "before_cursor_execute", _record)


async def _seed_streak_row(
    session: AsyncSession,
    user_id: UUID,
    current: int,
    longest: int,
    last_activity: datetime | None,
) -> None:
    """Insert a user and their streak row through a separate session."""
    factory = async_sessionmaker(session.bind, class_=AsyncSession, expire_on_commit=False)
    async with factory() as seed_session:
        seed_session.add(User(id=user_id, email=f"{user_id}@example.com", password_hash="x"))
        seed_session.add(
            StreakModel(
                user_id=user_id,
                current_streak_days=current,
                longest_streak_days=longest,
                streak_start_date=datetime.now(UTC) - timedelta(days=current),
                last_activity_date=last_activity,
                grace_used=False,
            )
        )
        await seed_session.commit()


def _existing_entity(
    user_id: UUID,
    row_id: UUID | None,
    current: int,
    longest: int,
    last_activity: datetime | None,
) -> Streak:
    """Build a domain entity that carries an already-persisted row id."""
    return Streak(
        user_id=user_id,
        current_streak_days=current,
        longest_streak_days=longest,
        streak_start_date=datetime.now(UTC) - timedelta(days=current),
        last_activity_date=last_activity,
        grace_used=False,
        id=row_id,
    )


class TestUpsertWriteFirstShape:
    """upsert writes first and reads back exactly once after commit."""

    async def test_existing_entity_updates_by_id_without_pre_read(
        self,
    ) -> None:
        """upsert issues one Core UPDATE by id; no SELECT precedes the write.

        The commit -> single post-commit read (session.get) -> return tail is
        pinned alongside, with refresh unused on the update branch.
        """
        row_id, user_id = uuid4(), uuid4()
        stored = StreakModel(
            id=row_id,
            user_id=user_id,
            current_streak_days=4,
            longest_streak_days=4,
            streak_start_date=datetime.now(UTC) - timedelta(days=4),
            last_activity_date=datetime.now(UTC),
            grace_used=False,
        )
        session = create_autospec(AsyncSession, instance=True)
        session.get.return_value = stored
        session.execute.return_value.rowcount = 1

        repository = PostgreSQLStreakRepository(cast(AsyncSession, session))
        entity = _existing_entity(user_id, row_id, 4, 4, datetime.now(UTC))
        persisted = await repository.upsert(entity)

        session.execute.assert_awaited_once()
        statement = session.execute.await_args.args[0]
        assert isinstance(statement, Update)
        assert not isinstance(statement, Select)
        session.get.assert_awaited_once_with(StreakModel, row_id)
        session.refresh.assert_not_awaited()
        session.commit.assert_awaited_once_with()
        assert [name for name, _, _ in session.mock_calls] == ["execute", "commit", "get"]
        assert persisted.id == row_id
        assert persisted.current_streak_days == 4

    async def test_rowcount_zero_falls_back_to_insert_branch(self) -> None:
        """A missed UPDATE (row gone) inserts instead, mirroring get-None."""
        session = create_autospec(AsyncSession, instance=True)
        session.get.return_value = None
        session.execute.return_value.rowcount = 0

        repository = PostgreSQLStreakRepository(cast(AsyncSession, session))
        entity = _existing_entity(uuid4(), uuid4(), 4, 4, datetime.now(UTC))

        await repository.upsert(entity)

        session.execute.assert_awaited_once()
        session.add.assert_called_once()
        session.get.assert_not_awaited()
        session.refresh.assert_awaited_once_with(session.add.call_args.args[0])
        assert [name for name, _, _ in session.mock_calls] == [
            "execute",
            "add",
            "commit",
            "refresh",
        ]

    async def test_entity_without_id_skips_update_and_inserts(self) -> None:
        """A transient entity (id None) goes straight to the insert branch."""
        session = create_autospec(AsyncSession, instance=True)
        session.get.return_value = None

        repository = PostgreSQLStreakRepository(cast(AsyncSession, session))
        entity = _existing_entity(uuid4(), None, 1, 1, datetime.now(UTC))

        await repository.upsert(entity)

        session.execute.assert_not_awaited()
        session.get.assert_not_awaited()
        session.add.assert_called_once()
        session.refresh.assert_awaited_once_with(session.add.call_args.args[0])
        assert [name for name, _, _ in session.mock_calls] == ["add", "commit", "refresh"]


class TestRecordActivityReadWriteShape:
    """record_activity keeps the route's 1 pre-read + 1 write + 1 post-read shape."""

    async def test_existing_row_reads_twice_and_updates_once(self, session: AsyncSession) -> None:
        """Exactly two SELECTs (pre-read + post-commit read) and one UPDATE."""
        user_id = uuid4()
        await _seed_streak_row(session, user_id, 3, 3, datetime.now(UTC) - timedelta(days=1))

        service = StreakService(PostgreSQLStreakRepository(session))
        with _count_streak_statements(session) as counts:
            streak = await service.record_activity(user_id)

        assert streak.current_streak_days == 4
        assert streak.longest_streak_days == 4
        assert counts.selects == 2, (
            "record_activity must read the streaks table exactly twice "
            f"(pre-read + post-commit read); observed {counts.selects}"
        )
        assert counts.updates == 1, f"expected one UPDATE; observed {counts.updates}"
        assert counts.inserts == 0

    async def test_first_activity_reads_twice_and_inserts_once(self, session: AsyncSession) -> None:
        """A missing row still reads twice (pre-read + post-commit refresh)."""
        service = StreakService(PostgreSQLStreakRepository(session))

        with _count_streak_statements(session) as counts:
            streak = await service.record_activity(uuid4())

        assert streak.current_streak_days == 1
        assert streak.longest_streak_days == 1
        assert counts.selects == 2, (
            "record_activity must read the streaks table exactly twice "
            f"(pre-read + post-commit read); observed {counts.selects}"
        )
        assert counts.inserts == 1, f"expected one INSERT; observed {counts.inserts}"
        assert counts.updates == 0
