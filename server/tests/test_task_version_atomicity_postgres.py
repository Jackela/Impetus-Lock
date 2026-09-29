"""R07 regression for competing task writes through real PostgreSQL sessions."""

import asyncio
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.schema import CreateSchema, DropSchema

from server.api.dependencies import get_task_service
from server.api.routes.tasks import router
from server.application.services.task_service import (
    TaskDTO,
    TaskService,
    UpdateTaskCommand,
    VersionMismatchError,
)
from server.auth.dependencies import get_current_user
from server.domain.entities.intervention_action import InterventionAction
from server.domain.entities.task import Task
from server.infrastructure.persistence.models import Base, InterventionActionModel, TaskModel
from server.infrastructure.persistence.postgresql_task_repository import PostgreSQLTaskRepository
from server.infrastructure.persistence.transactions import SqlAlchemyTransaction
from server.models.user import User

POSTGRES_TEST_URL = "postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/postgres"


class ConcurrentReadRepository(PostgreSQLTaskRepository):
    """Schedule real database reads before either competing service writes."""

    def __init__(self, session: AsyncSession, barrier: asyncio.Barrier) -> None:
        """Use the real repository with a test-only read scheduling barrier."""
        super().__init__(session)
        self.barrier = barrier

    async def get_task(self, task_id: UUID) -> Task | None:
        """Read the real task, waiting for the other writer's snapshot."""
        task = await super().get_task(task_id)
        await self.barrier.wait()
        return task

    async def get_task_by_user(self, task_id: UUID, user_id: UUID) -> Task | None:
        """Read the real owned task before allowing either write."""
        task = await super().get_task_by_user(task_id, user_id)
        await self.barrier.wait()
        return task


async def create_owned_task(sessions: async_sessionmaker[AsyncSession]) -> tuple[User, Task]:
    """Commit a disposable owner and task in the test-owned schema."""
    owner = User(id=uuid4(), email=f"{uuid4()}@r07.example", password_hash="test-only")
    async with sessions() as session:
        session.add(owner)
        await session.flush()
        task = await PostgreSQLTaskRepository(session).create_task(
            "Original draft", ["original-lock"], user_id=owner.id, title="Draft title"
        )
        await session.commit()
    return owner, task


@pytest.fixture(scope="session", autouse=True)
def initialize_test_database() -> None:
    """Replace root database setup: this module owns its PostgreSQL schema."""


@pytest.fixture
async def postgres_sessions() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    """Create independent sessions in a unique schema, cleaning only that schema."""
    schema = f"r07_atomicity_{uuid4().hex}"
    engine = create_async_engine(
        POSTGRES_TEST_URL,
        execution_options={"schema_translate_map": {None: schema}},
        connect_args={"server_settings": {"statement_timeout": "10000"}},
    )
    schema_created = False
    try:
        async with engine.begin() as connection:
            await connection.execute(CreateSchema(schema))
        schema_created = True
        async with engine.begin() as connection:
            await connection.run_sync(
                Base.metadata.create_all,
                tables=[User.__table__, TaskModel.__table__, InterventionActionModel.__table__],
            )
        yield async_sessionmaker(engine, expire_on_commit=False)
    finally:
        try:
            if schema_created:
                async with engine.begin() as connection:
                    await connection.execute(DropSchema(schema, cascade=True))
        finally:
            await engine.dispose()


@pytest.mark.integration
@pytest.mark.asyncio
async def test_postgres_same_version_writers_have_one_success_and_one_conflict(
    postgres_sessions: async_sessionmaker[AsyncSession],
) -> None:
    """Two version-zero snapshots cannot both commit or overwrite the winner."""
    owner_id = uuid4()
    due_date = datetime(2026, 10, 1, tzinfo=UTC)
    async with postgres_sessions() as setup_session:
        setup_session.add(
            User(id=owner_id, email=f"{owner_id}@r07.example", password_hash="test-only")
        )
        await setup_session.flush()
        repository = PostgreSQLTaskRepository(setup_session)
        created = await repository.create_task(
            content="Original draft",
            lock_ids=["original-lock"],
            user_id=owner_id,
            title="Draft title",
            category="WRITING",
            priority="HIGH",
            due_date=due_date,
            word_count=2,
        )
        action = InterventionAction.create(
            task_id=created.id,
            action_type="provoke",
            action_id=f"r07_{uuid4().hex}",
            lock_id="original-lock",
            content="Original constraint",
            anchor={"type": "pos", "from": 0},
            mode="muse",
            context="Original draft",
            issued_at=datetime.now(UTC),
        )
        await repository.save_action(action)
        await setup_session.commit()

    async with postgres_sessions() as first_session, postgres_sessions() as second_session:
        first_repository = PostgreSQLTaskRepository(first_session)
        second_repository = PostgreSQLTaskRepository(second_session)
        # Both sessions hold their own read transaction before either writer starts.
        first_writer = await first_repository.get_task(created.id)
        second_writer = await second_repository.get_task(created.id)
        assert first_writer is not None
        assert second_writer is not None
        assert first_writer.version == second_writer.version == 0
        first_writer.update_content("First candidate", ["first-lock"])
        second_writer.update_content("Second candidate", ["second-lock"])

        async def save(session: AsyncSession, candidate: Task) -> Task | ValueError:
            """Commit success or roll back the repository's documented conflict."""
            try:
                saved = await PostgreSQLTaskRepository(session).update_task(candidate)
                await session.commit()
                return saved
            except ValueError as conflict:
                await session.rollback()
                return conflict

        outcomes = await asyncio.gather(
            save(first_session, first_writer), save(second_session, second_writer)
        )

    successes = [outcome for outcome in outcomes if isinstance(outcome, Task)]
    conflicts = [outcome for outcome in outcomes if isinstance(outcome, ValueError)]
    assert (len(successes), len(conflicts)) == (1, 1), (
        f"Expected one success and one version conflict; "
        f"got {len(successes)} successes and {len(conflicts)} conflicts"
    )
    assert "version" in str(conflicts[0]).lower()
    winner = successes[0]
    assert winner.version == 1

    async with postgres_sessions() as verification_session:
        repository = PostgreSQLTaskRepository(verification_session)
        persisted = await repository.get_task(created.id)
        assert persisted is not None
        assert persisted.content == winner.content
        assert persisted.lock_ids == winner.lock_ids
        assert persisted.version == 1
        assert persisted.user_id == owner_id
        assert persisted.title == "Draft title"
        assert persisted.category == "WRITING"
        assert persisted.priority == "HIGH"
        assert persisted.due_date == due_date
        assert persisted.word_count == 2
        assert persisted.created_at == created.created_at
        assert persisted.updated_at == winner.updated_at
        assert await repository.get_actions(created.id) == [action]


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.parametrize("legacy", [False, True], ids=["scoped", "legacy"])
async def test_service_translates_atomic_postgres_conflict(
    postgres_sessions: async_sessionmaker[AsyncSession], legacy: bool
) -> None:
    """Both service entry points preserve the existing typed conflict contract."""
    owner, task = await create_owned_task(postgres_sessions)
    barrier = asyncio.Barrier(2)

    async def write(content: str) -> Task | TaskDTO | ValueError | VersionMismatchError:
        """Exercise a real service/session, rolling back a rejected write."""
        async with postgres_sessions() as session:
            service = TaskService(
                ConcurrentReadRepository(session, barrier), SqlAlchemyTransaction(session)
            )
            try:
                if legacy:
                    result = await service.update_task(
                        UpdateTaskCommand(task.id, content, [content], 0)
                    )
                    await session.commit()
                    return result
                return await service.update_task_for_user(
                    owner.id, task.id, content=content, lock_ids=[content], version=0
                )
            except (ValueError, VersionMismatchError) as conflict:
                await session.rollback()
                return conflict

    outcomes = await asyncio.gather(write("First candidate"), write("Second candidate"))
    conflicts = [outcome for outcome in outcomes if isinstance(outcome, VersionMismatchError)]
    successes = [outcome for outcome in outcomes if isinstance(outcome, (Task, TaskDTO))]
    assert len(successes) == len(conflicts) == 1, outcomes
    assert (conflicts[0].expected, conflicts[0].actual) == (0, 1)
    assert successes[0].version == 1
    async with postgres_sessions() as session:
        persisted = await PostgreSQLTaskRepository(session).get_task(task.id)
        assert persisted is not None
        assert persisted.content == successes[0].content
        assert persisted.version == 1


@pytest.mark.integration
@pytest.mark.asyncio
async def test_http_put_maps_atomic_postgres_conflict_to_409(
    postgres_sessions: async_sessionmaker[AsyncSession],
) -> None:
    """Concurrent owned PUT requests return one 200 and one 409, never 500."""
    owner, task = await create_owned_task(postgres_sessions)
    barrier = asyncio.Barrier(2)
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: owner

    async def service_dependency() -> AsyncIterator[TaskService]:
        """Give each HTTP request an independent real PostgreSQL transaction."""
        async with postgres_sessions() as session:
            yield TaskService(
                ConcurrentReadRepository(session, barrier), SqlAlchemyTransaction(session)
            )

    app.dependency_overrides[get_task_service] = service_dependency
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        outcomes = await asyncio.gather(
            *[
                client.put(
                    f"/tasks/{task.id}",
                    json={"content": content, "lock_ids": [content], "version": 0},
                )
                for content in ["First candidate", "Second candidate"]
            ]
        )
    assert sorted(response.status_code for response in outcomes) == [200, 409]
    winner = next(response.json() for response in outcomes if response.status_code == 200)
    conflict = next(response.json() for response in outcomes if response.status_code == 409)
    assert conflict == {"detail": "Version mismatch: expected 0, got 1"}
    assert winner["version"] == 1
    async with postgres_sessions() as session:
        persisted = await PostgreSQLTaskRepository(session).get_task(task.id)
        assert persisted is not None
        assert persisted.content == winner["content"]
        assert persisted.lock_ids == winner["lock_ids"]
        assert persisted.title == "Draft title"
        assert persisted.version == 1
