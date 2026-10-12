"""Public PostgreSQL repository contracts in a disposable, test-owned schema."""

import os
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.schema import CreateSchema, DropSchema

from server.domain.entities.intervention_action import InterventionAction
from server.domain.entities.task import Task
from server.infrastructure.persistence.models import Base, InterventionActionModel, TaskModel
from server.infrastructure.persistence.postgresql_task_repository import PostgreSQLTaskRepository
from server.models.user import User


@pytest.fixture(scope="session", autouse=True)
def initialize_test_database() -> None:
    """Use only this module's owned schema instead of root database initialization."""


@pytest.fixture
async def repository_sessions() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    """Create and clean a unique PostgreSQL schema, never touching shared tables."""
    schema = f"r19_repository_{uuid4().hex}"
    engine = create_async_engine(
        os.getenv(
            "POSTGRES_TEST_URL",
            os.getenv(
                "TEST_DATABASE_URL",
                "postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/postgres",
            ),
        ),
        execution_options={"schema_translate_map": {None: schema}},
        connect_args={"server_settings": {"statement_timeout": "10000"}},
    )
    created = False
    try:
        async with engine.begin() as connection:
            await connection.execute(CreateSchema(schema))
        created = True
        async with engine.begin() as connection:
            await connection.run_sync(
                Base.metadata.create_all,
                tables=[User.__table__, TaskModel.__table__, InterventionActionModel.__table__],
            )
        yield async_sessionmaker(engine, expire_on_commit=False)
    finally:
        try:
            if created:
                async with engine.begin() as connection:
                    await connection.execute(DropSchema(schema, cascade=True))
        finally:
            await engine.dispose()


@pytest.mark.integration
async def test_postgres_lists_paginate_and_count_only_owned_tasks(
    repository_sessions: async_sessionmaker[AsyncSession],
) -> None:
    """Owned pagination excludes another user's task while global listing stays ordered."""
    owner, other = uuid4(), uuid4()
    async with repository_sessions() as session:
        session.add_all(
            [
                User(id=uid, email=f"{uid}@r19.example", password_hash="test-only")
                for uid in (owner, other)
            ]
        )
        await session.flush()
        repository = PostgreSQLTaskRepository(session)
        older = await repository.create_task("Owner older", [], user_id=owner)
        newer = await repository.create_task("Owner newer", ["lock-owned"], user_id=owner)
        outsider = await repository.create_task("Other user's task", [], user_id=other)
        await session.commit()

    async with repository_sessions() as session:
        repository = PostgreSQLTaskRepository(session)
        assert await repository.count_tasks_by_user(owner) == 2
        assert await repository.count_tasks_by_user(uuid4()) == 0
        assert await repository.list_tasks_by_user(owner, limit=1) == [newer]
        assert await repository.list_tasks_by_user(owner, limit=1, offset=1) == [older]
        assert await repository.list_tasks(limit=2) == [outsider, newer]
        assert await repository.list_tasks(limit=1, offset=2) == [older]
        assert await repository.get_task_by_user(outsider.id, owner) is None
        assert await repository.get_task_by_user(uuid4(), owner) is None


@pytest.mark.integration
@pytest.mark.parametrize("scoped", [True, False], ids=["owned", "global"])
async def test_postgres_pagination_keeps_same_time_tasks_in_stable_uuid_order(
    repository_sessions: async_sessionmaker[AsyncSession], scoped: bool
) -> None:
    """Same-time tasks stay complete and ordered across pages without changing ownership."""
    owner, other = uuid4(), uuid4()
    created_at = datetime(2026, 10, 11, 21, 24, 49, 382758, tzinfo=UTC)
    newer_id, older_id, other_id = UUID(int=1000), UUID(int=2000), UUID(int=3000)
    async with repository_sessions() as session:
        session.add_all(
            [
                User(id=uid, email=f"{uid}@r19.example", password_hash="test-only")
                for uid in (owner, other)
            ]
        )
        await session.flush()
        session.add_all(
            [
                TaskModel(
                    id=UUID(int=number),
                    user_id=owner,
                    content=f"Owned task {number}",
                    lock_ids=[f"lock_{number}"],
                    created_at=created_at,
                    updated_at=created_at,
                    version=number,
                )
                for number in range(1, 202)
            ]
            + [
                TaskModel(
                    id=newer_id,
                    user_id=owner,
                    content="Newest task",
                    lock_ids=[],
                    created_at=created_at + timedelta(seconds=1),
                    updated_at=created_at,
                ),
                TaskModel(
                    id=older_id,
                    user_id=owner,
                    content="Oldest task",
                    lock_ids=[],
                    created_at=created_at - timedelta(seconds=1),
                    updated_at=created_at,
                ),
                TaskModel(
                    id=other_id,
                    user_id=other,
                    content="Other account task",
                    lock_ids=[],
                    created_at=created_at,
                    updated_at=created_at,
                ),
            ]
        )
        await session.commit()

    expected_ids = [newer_id]
    if not scoped:
        expected_ids.append(other_id)
    expected_ids.extend(UUID(int=number) for number in range(201, 0, -1))
    expected_ids.append(older_id)
    for _round in range(2):
        async with repository_sessions() as session:
            repository = PostgreSQLTaskRepository(session)
            pages = [
                (
                    await repository.list_tasks_by_user(owner, limit=100, offset=offset)
                    if scoped
                    else await repository.list_tasks(limit=100, offset=offset)
                )
                for offset in (0, 100, 200)
            ]
            actual = [task for page in pages for task in page]
            assert [len(page) for page in pages] == [100, 100, 3 if scoped else 4]
            assert len({task.id for task in actual}) == len(expected_ids)
            assert [task.id for task in actual] == expected_ids
            assert await repository.count_tasks_by_user(owner) == 203
            assert [task.id for task in await repository.list_tasks_by_user(other)] == [other_id]
            assert await repository.get_task_by_user(other_id, owner) is None
            for task in actual:
                assert task.user_id == (other if task.id == other_id else owner)
                if 1 <= task.id.int <= 201:
                    assert task.content == f"Owned task {task.id.int}"
                    assert task.lock_ids == [f"lock_{task.id.int}"]
                    assert task.version == task.id.int


@pytest.mark.integration
async def test_postgres_deletion_removes_task_and_action_history(
    repository_sessions: async_sessionmaker[AsyncSession],
) -> None:
    """Committed deletion removes a task and its history through repository interfaces."""
    async with repository_sessions() as session:
        owner = uuid4()
        session.add(User(id=owner, email=f"{owner}@r19.example", password_hash="test-only"))
        await session.flush()
        repository = PostgreSQLTaskRepository(session)
        task = await repository.create_task("Draft", ["lock-history"], user_id=owner)
        action = InterventionAction.create(
            task_id=task.id,
            action_type="provoke",
            action_id=f"act_{uuid4()}",
            lock_id="lock-history",
            content="Constraint",
            anchor={"type": "pos", "from": 0},
            mode="muse",
            context="Draft",
            issued_at=datetime.now(UTC),
        )
        await repository.save_action(action)
        await session.commit()

    async with repository_sessions() as session:
        repository = PostgreSQLTaskRepository(session)
        assert await repository.get_action_count(task.id) == 1
        assert await repository.get_actions(task.id, limit=1) == [action]
        assert await repository.get_actions(task.id, offset=1) == []
        await repository.delete_task(task.id)
        await session.commit()

    async with repository_sessions() as session:
        repository = PostgreSQLTaskRepository(session)
        assert await repository.get_task(task.id) is None
        assert await repository.get_action_count(task.id) == 0
        assert await repository.get_actions(task.id) == []
        with pytest.raises(ValueError, match="not found"):
            await repository.delete_task(task.id)
        missing = Task.create("Missing task")
        missing.update_content("Unsavable update", [])
        with pytest.raises(ValueError, match="not found"):
            await repository.update_task(missing)
