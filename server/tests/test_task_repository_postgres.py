"""Public PostgreSQL repository contracts in a disposable, test-owned schema."""

from collections.abc import AsyncIterator
from datetime import UTC, datetime
from uuid import uuid4

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
        "postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/postgres",
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
