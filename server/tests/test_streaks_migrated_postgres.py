"""Authenticated writing and gamification API against the Sprint 3 migration."""

import asyncio
import os
import runpy
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient, Response
from sqlalchemy import text
from sqlalchemy.engine import Connection
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.schema import CreateSchema, DropSchema

from server.api.auth.middleware import AuthenticationMiddleware
from server.api.routes import achievements, intervention, stats, streaks, tasks
from server.auth.router import router as auth_router
from server.domain.entities.intervention_action import InterventionAction
from server.domain.entities.streak import Streak
from server.domain.entities.task import Task
from server.domain.models.intervention import InterventionResponse
from server.infrastructure.llm.base_provider import BasePromptLLMProvider, LLMInterventionDraft
from server.infrastructure.llm.provider_registry import ProviderRegistry
from server.infrastructure.persistence.database import get_session, get_session_optional
from server.infrastructure.persistence.models import Base, InterventionActionModel, TaskModel
from server.infrastructure.persistence.postgresql_intervention_replay import (
    PostgreSQLInterventionReplay,
)
from server.infrastructure.persistence.postgresql_streak_repository import (
    PostgreSQLStreakRepository,
)
from server.infrastructure.persistence.postgresql_task_repository import PostgreSQLTaskRepository
from server.models.user import User

POSTGRES_TEST_URL = os.getenv(
    "POSTGRES_TEST_URL",
    os.getenv(
        "TEST_DATABASE_URL", "postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/postgres"
    ),
)


@pytest.fixture(scope="session", autouse=True)
def initialize_test_database() -> None:
    """Only use this module's migrated schema, without shared table initialization."""


def _writing_app(sessions: async_sessionmaker[AsyncSession]) -> FastAPI:
    """Create a fresh application sharing only the supplied database sessions."""

    async def isolated_session() -> AsyncIterator[AsyncSession]:
        async with sessions() as session:
            yield session

    app = FastAPI()
    app.add_middleware(AuthenticationMiddleware)
    for router in (
        auth_router,
        tasks.router,
        intervention.router,
        stats.router,
        achievements.router,
        streaks.router,
    ):
        app.include_router(router)
    app.dependency_overrides[get_session] = isolated_session
    app.dependency_overrides[get_session_optional] = isolated_session
    return app


@pytest.fixture
async def migrated_streak_client(
    monkeypatch: pytest.MonkeyPatch,
) -> AsyncIterator[tuple[AsyncClient, AsyncClient, async_sessionmaker[AsyncSession]]]:
    """Apply the original migration in a unique schema and keep auth/SQL real."""
    schema = f"streak_migration_{uuid4().hex}"
    engine = create_async_engine(
        POSTGRES_TEST_URL,
        connect_args={"server_settings": {"search_path": schema, "statement_timeout": "5000"}},
    )
    versions = Path(__file__).parents[1] / "alembic/versions"
    migrations = [
        runpy.run_path(str(versions / filename))
        for filename in (
            "20260413130000_add_sprint3_tables.py",
            "20261126180000_add_intervention_receipts.py",
        )
    ]

    def apply_migration(connection: Connection) -> None:
        with Operations.context(MigrationContext.configure(connection)):
            for migration in migrations:
                migration["upgrade"]()

    created = False
    try:
        async with engine.begin() as connection:
            await connection.execute(CreateSchema(schema))
            created = True
            await connection.run_sync(
                Base.metadata.create_all,
                tables=[User.__table__, TaskModel.__table__, InterventionActionModel.__table__],
            )
            await connection.run_sync(apply_migration)
        sessions = async_sessionmaker(engine, expire_on_commit=False)

        monkeypatch.delenv("TESTING", raising=False)
        monkeypatch.setenv("JWT_SECRET", "streak-real-migration-auth-secret-only")
        monkeypatch.setenv("LLM_DEFAULT_PROVIDER", "debug")
        monkeypatch.setenv("LLM_ALLOW_DEBUG_PROVIDER", "1")
        app = _writing_app(sessions)
        async with (
            AsyncClient(
                transport=ASGITransport(app=app, raise_app_exceptions=False),
                base_url="http://test",
            ) as owner,
            AsyncClient(
                transport=ASGITransport(app=app, raise_app_exceptions=False),
                base_url="http://test",
            ) as other,
        ):
            for client in (owner, other):
                registered = await client.post(
                    "/auth/register",
                    json={
                        "email": f"streak-{uuid4()}@example.com",
                        "password": "securePassword123",
                    },
                )
                assert registered.status_code == 201, registered.text
                client.headers["X-CSRF-Token"] = client.cookies["csrf_token"]
                client.headers["X-Expected-User-ID"] = registered.json()["user"]["id"]
            yield owner, other, sessions
    finally:
        try:
            if created:
                async with engine.begin() as connection:
                    await connection.execute(DropSchema(schema, cascade=True))
        finally:
            await engine.dispose()


@pytest.mark.integration
async def test_real_user_activity_persists_utc_time_under_existing_migration(
    migrated_streak_client: tuple[AsyncClient, AsyncClient, async_sessionmaker[AsyncSession]],
) -> None:
    """Normal activity must write/read migrated UTC timestamps, without schema changes."""
    client, _, sessions = migrated_streak_client
    response = await client.post("/streaks/update", json={})
    assert response.status_code == 200
    first = response.json()
    assert first["current_streak_days"] == first["longest_streak_days"] == 1
    observed = datetime.fromisoformat(first["last_activity_date"])
    assert observed.tzinfo == UTC
    assert observed.date() == datetime.now(UTC).date()
    assert (await client.get("/streaks/")).json() == first
    assert (await client.post("/streaks/update", json={})).json() == first
    async with sessions() as session:
        stored = (
            await session.execute(text("SELECT streak_start_date,last_activity_date FROM streaks"))
        ).one()
        assert stored.streak_start_date == stored.last_activity_date == observed
        assert stored.last_activity_date.tzinfo == UTC


@pytest.mark.integration
async def test_task_and_successful_intervention_update_owner_statistics_and_achievements(
    migrated_streak_client: tuple[AsyncClient, AsyncClient, async_sessionmaker[AsyncSession]],
) -> None:
    """Follow normal Web writes, including a same-key intervention and stale save."""
    owner, other, _ = migrated_streak_client
    original = "The door opened."
    denied = await owner.post(
        "/tasks/",
        json={"content": original, "lock_ids": []},
        headers={"X-CSRF-Token": "wrong-token"},
    )
    assert denied.status_code == 403
    created = await owner.post("/tasks/", json={"content": original, "lock_ids": []})
    assert created.status_code == 201, created.text
    path = f"/tasks/{created.json()['id']}"
    headers = {
        "X-Task-Id": created.json()["id"],
        "Idempotency-Key": str(uuid4()),
        "X-Contract-Version": "2.0.0",
    }
    generation = {
        "context": original,
        "mode": "muse",
        "client_meta": {
            "doc_version": 0,
            "selection_from": len(original),
            "selection_to": len(original),
        },
    }
    action = await owner.post("/impetus/generate-intervention", headers=headers, json=generation)
    assert action.status_code == 200, action.text
    assert (
        await owner.post("/impetus/generate-intervention", headers=headers, json=generation)
    ).json() == action.json()
    assert (await owner.get(f"{path}/actions")).json()["total"] == 1
    lock_id = action.json()["lock_id"]
    update = {
        "version": 0,
        "content": f"{original}\n\n> {action.json()['content']} <!-- lock:{lock_id} -->",
        "lock_ids": [lock_id],
    }
    assert (await owner.put(path, json=update)).status_code == 200
    assert (await owner.put(path, json=update)).status_code == 409
    assert (await other.put(path, json=update)).status_code == 404

    result = (await owner.get("/stats/")).json()
    assert result["total_tasks"] == 1
    assert result["total_muse_interventions"] == 1
    assert result["total_loki_interventions"] == 0
    assert result["total_locks_created"] == 1
    assert datetime.fromisoformat(result["last_activity_at"]).tzinfo == UTC
    assert (await owner.get("/stats/breakdown")).json() == {"muse_count": 1, "loki_count": 0}
    earned = (await owner.get("/achievements/")).json()["achievements"]
    assert sorted(item["achievement_type"] for item in earned) == ["first_muse", "first_task"]
    for item in earned:
        assert datetime.fromisoformat(item["earned_at"]).tzinfo == UTC
        assert (await other.get(f"/achievements/{item['id']}")).status_code == 404
    assert (await other.get("/stats/")).json()["total_tasks"] == 0
    assert (await other.get("/stats/breakdown")).json() == {"muse_count": 0, "loki_count": 0}
    assert (await other.get("/achievements/")).json()["total"] == 0


@pytest.mark.integration
@pytest.mark.parametrize("second_gap", [2, 5])
async def test_writing_records_utc_days_grace_and_failed_save_does_not_record_activity(
    migrated_streak_client: tuple[AsyncClient, AsyncClient, async_sessionmaker[AsyncSession]],
    second_gap: int,
) -> None:
    """Take a single grace day, start a new streak after a gap and preserve the longest."""
    owner, other, sessions = migrated_streak_client
    created = await owner.post("/tasks/", json={"content": "Original", "lock_ids": []})
    assert created.status_code == 201, created.text
    path = f"/tasks/{created.json()['id']}"
    first = (await owner.get("/streaks/")).json()
    assert first["current_streak_days"] == first["longest_streak_days"] == 1
    assert (await other.get("/streaks/")).json()["current_streak_days"] == 0

    async def set_last_activity(days_ago: int) -> None:
        past = datetime.now(UTC) - timedelta(days=days_ago)
        async with sessions() as session:
            await session.execute(
                text("UPDATE streaks SET last_activity_date = :past"), {"past": past}
            )
            await session.commit()

    await set_last_activity(1)
    yesterday = (await owner.get("/streaks/")).json()
    assert (
        await owner.put(path, json={"content": "Stale", "lock_ids": [], "version": 1})
    ).status_code == 409
    assert (await owner.get("/streaks/")).json() == yesterday
    assert (
        await owner.put(path, json={"content": "Today", "lock_ids": [], "version": 0})
    ).status_code == 200
    adjacent = (await owner.get("/streaks/")).json()
    assert adjacent["current_streak_days"] == 2 and not adjacent["grace_used"]

    await set_last_activity(2)
    assert (
        await owner.put(path, json={"content": "After one break", "lock_ids": [], "version": 1})
    ).status_code == 200
    recovered = (await owner.get("/streaks/")).json()
    assert recovered["current_streak_days"] == recovered["longest_streak_days"] == 3
    assert recovered["grace_used"]
    assert (await owner.post("/streaks/update", json={})).json() == recovered

    await set_last_activity(second_gap)
    restarted = (await owner.post("/streaks/update", json={})).json()
    assert restarted["current_streak_days"] == 1
    assert restarted["longest_streak_days"] == 3
    assert not restarted["grace_used"]
    assert restarted["streak_start_date"] == restarted["last_activity_date"]


@pytest.mark.integration
async def test_concurrent_first_activity_requests_both_succeed_and_count_once(
    migrated_streak_client: tuple[AsyncClient, AsyncClient, async_sessionmaker[AsyncSession]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Overlap both first writes within the account's normal Cookie/CSRF contract."""
    owner, _, sessions = migrated_streak_client
    begin = asyncio.Barrier(2)
    original_upsert = PostgreSQLStreakRepository.upsert

    async def delayed_upsert(repository: PostgreSQLStreakRepository, streak: Streak) -> Streak:
        await asyncio.sleep(0.1)
        return await original_upsert(repository, streak)

    monkeypatch.setattr(PostgreSQLStreakRepository, "upsert", delayed_upsert)

    async def update() -> Response:
        await begin.wait()
        return await owner.post("/streaks/update", json={})

    outcomes = await asyncio.gather(update(), update())
    assert [item.status_code for item in outcomes] == [200, 200]
    assert outcomes[0].json() == outcomes[1].json()
    assert outcomes[0].json()["current_streak_days"] == 1
    async with sessions() as session:
        assert await session.scalar(text("SELECT count(*) FROM streaks")) == 1


@pytest.mark.integration
async def test_delete_committing_after_ownership_check_returns_save_404(
    migrated_streak_client: tuple[AsyncClient, AsyncClient, async_sessionmaker[AsyncSession]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A deleted owned task has the same 404 as an ordinary missing task."""
    owner, other, _ = migrated_streak_client
    created = await owner.post(
        "/tasks/", json={"content": "Original", "lock_ids": ["lock-original"]}
    )
    assert created.status_code == 201, created.text
    task_id = UUID(created.json()["id"])
    path = f"/tasks/{task_id}"
    admitted = asyncio.Event()
    deleted = asyncio.Event()
    original_update = PostgreSQLTaskRepository.update_task

    async def pause_owned_update(repository: PostgreSQLTaskRepository, task: Task) -> Task:
        assert task.id == task_id
        admitted.set()
        await asyncio.wait_for(deleted.wait(), timeout=5)
        return await original_update(repository, task)

    monkeypatch.setattr(PostgreSQLTaskRepository, "update_task", pause_owned_update)
    update = {"version": 0, "content": "Save", "lock_ids": ["lock-original"]}
    assert (await other.put(path, json=update)).status_code == 404
    assert (await other.delete(path)).status_code == 404
    saving = asyncio.create_task(owner.put(path, json=update))
    try:
        await asyncio.wait_for(admitted.wait(), timeout=5)
        assert (await owner.delete(path)).status_code == 204
    finally:
        deleted.set()
        saved = await saving
    missing = await owner.get(path)
    assert saved.status_code == missing.status_code == 404
    assert saved.json() == missing.json()


@pytest.mark.integration
async def test_existing_drafts_seed_totals_and_deleting_tracked_drafts_keeps_them(
    migrated_streak_client: tuple[AsyncClient, AsyncClient, async_sessionmaker[AsyncSession]],
) -> None:
    """Read retained pre-tracking facts and keep tracked counters past deletion."""
    owner, _, sessions = migrated_streak_client
    user_id = UUID(owner.headers["X-Expected-User-ID"])
    async with sessions() as session:
        repository = PostgreSQLTaskRepository(session)
        task = await repository.create_task(
            "Earlier draft", ["old-lock", "old-lock"], user_id=user_id
        )
        await repository.save_action(
            InterventionAction.create(
                task.id,
                "delete",
                "legacy-loki",
                {"type": "range", "from": 0, "to": 2},
                "loki",
                task.content,
                task.created_at,
            )
        )
        await session.commit()

    before = (await owner.get("/stats/")).json()
    assert before["total_tasks"] == before["total_loki_interventions"] == 1
    assert before["total_locks_created"] == 1
    assert before["total_muse_interventions"] == before["writing_minutes"] == 0

    created = await owner.post("/tasks/", json={"content": "Current draft", "lock_ids": ["fresh"]})
    assert created.status_code == 201, created.text
    after = (await owner.get("/stats/")).json()
    assert after["total_tasks"] == after["total_locks_created"] == 2
    assert after["total_loki_interventions"] == 1
    achievements = (await owner.get("/achievements/")).json()["achievements"]
    assert sorted(item["achievement_type"] for item in achievements) == ["first_loki", "first_task"]
    assert (await owner.delete(f"/tasks/{task.id}")).status_code == 204
    assert (await owner.get("/stats/")).json() == after


@pytest.mark.integration
async def test_parallel_task_writes_award_first_task_once(
    migrated_streak_client: tuple[AsyncClient, AsyncClient, async_sessionmaker[AsyncSession]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Competing creations and same-version saves share the actual account counters."""
    owner, _, _ = migrated_streak_client
    response_a, response_b = await asyncio.gather(
        owner.post("/tasks/", json={"content": "First draft", "lock_ids": []}),
        owner.post("/tasks/", json={"content": "Second draft", "lock_ids": []}),
    )
    assert response_a.status_code == response_b.status_code == 201
    assert (await owner.get("/streaks/")).json()["current_streak_days"] == 1
    earned = (await owner.get("/achievements/")).json()["achievements"]
    assert [item["achievement_type"] for item in earned] == ["first_task"]

    snapshots = asyncio.Barrier(2)
    original_get = PostgreSQLTaskRepository.get_task_by_user

    async def wait_for_both_reads(
        repository: PostgreSQLTaskRepository, task_id: UUID, user_id: UUID
    ) -> Task | None:
        task = await original_get(repository, task_id, user_id)
        await asyncio.wait_for(snapshots.wait(), timeout=5)
        return task

    monkeypatch.setattr(PostgreSQLTaskRepository, "get_task_by_user", wait_for_both_reads)
    path = f"/tasks/{response_a.json()['id']}"
    outcomes = await asyncio.gather(
        owner.put(path, json={"content": "First change", "lock_ids": ["first"], "version": 0}),
        owner.put(path, json={"content": "Second change", "lock_ids": ["second"], "version": 0}),
    )
    assert sorted(response.status_code for response in outcomes) == [200, 409]
    result = (await owner.get("/stats/")).json()
    assert result["total_tasks"] == 2
    assert result["total_locks_created"] == 1
    assert (await owner.get("/achievements/")).json()["achievements"] == earned


@pytest.mark.integration
async def test_task_statistics_and_streak_roll_back_when_commit_fails(
    migrated_streak_client: tuple[AsyncClient, AsyncClient, async_sessionmaker[AsyncSession]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Flush all real SQL writes, then simulate a database failure before commit."""
    owner, _, _ = migrated_streak_client
    original_commit = AsyncSession.commit

    async def fail_commit(session: AsyncSession) -> None:
        await session.flush()
        raise OperationalError("COMMIT", {}, RuntimeError("simulated unavailable database"))

    monkeypatch.setattr(AsyncSession, "commit", fail_commit)
    request = {"content": "Draft", "lock_ids": ["draft-lock"]}
    failed = await owner.post("/tasks/", json=request)
    assert failed.status_code == 500
    assert (await owner.get("/tasks/")).json()["total"] == 0
    assert (await owner.get("/stats/")).json()["total_locks_created"] == 0
    assert (await owner.get("/achievements/")).json()["total"] == 0
    assert (await owner.get("/streaks/")).json()["current_streak_days"] == 0

    monkeypatch.setattr(AsyncSession, "commit", original_commit)
    assert (await owner.post("/tasks/", json=request)).status_code == 201
    assert (await owner.get("/stats/")).json()["total_locks_created"] == 1
    assert (await owner.get("/achievements/")).json()["total"] == 1
    assert (await owner.get("/streaks/")).json()["current_streak_days"] == 1


@pytest.mark.integration
@pytest.mark.parametrize("overlap", [False, True], ids=["replay", "concurrent"])
async def test_task_intervention_retries_share_one_committed_result_across_workers(
    migrated_streak_client: tuple[AsyncClient, AsyncClient, async_sessionmaker[AsyncSession]],
    overlap: bool,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Two real API applications with independent caches share task-associated receipts."""

    class ProviderSDKStub(BasePromptLLMProvider):
        """Use the production response construction with a local SDK result."""

        def __init__(self) -> None:
            super().__init__(model="test-only")
            self.calls = 0

        def _complete(self, system_prompt: str, user_message: str) -> LLMInterventionDraft:
            self.calls += 1
            return LLMInterventionDraft(action="provoke", content="Try the stairwell.")

    provider = ProviderSDKStub()
    monkeypatch.setattr(ProviderRegistry, "get_provider", lambda *args, **kwargs: provider)
    owner, _, sessions = migrated_streak_client
    original = "A draft."
    created = await owner.post("/tasks/", json={"content": original, "lock_ids": []})
    assert created.status_code == 201, created.text
    task_id = created.json()["id"]
    path = "/impetus/generate-intervention"
    headers = {
        "X-Task-Id": task_id,
        "Idempotency-Key": str(uuid4()),
        "X-Contract-Version": "2.0.0",
    }
    request = {
        "context": original,
        "mode": "loki",
        "client_meta": {"doc_version": 0, "selection_from": 8, "selection_to": 8},
    }
    # The worker keeps its own FastAPI state, provider registry and in-process cache.
    async with AsyncClient(
        transport=ASGITransport(app=_writing_app(sessions), raise_app_exceptions=False),
        base_url="http://test",
        cookies=dict(owner.cookies),
        headers=dict(owner.headers),
    ) as second_worker:
        if overlap:
            first, replay = await asyncio.gather(
                owner.post(path, headers=headers, json=request),
                second_worker.post(path, headers=headers, json=request),
            )
        else:
            first = await owner.post(path, headers=headers, json=request)
            replay = await second_worker.post(
                path,
                headers={**headers, "X-LLM-Provider": "ignored-after-the-first-result"},
                json={**request, "mode": "muse"},
            )
    assert first.status_code == replay.status_code == 200, (first.text, replay.text)
    stats_result = (await owner.get("/stats/")).json()
    actions = (await owner.get(f"/tasks/{task_id}/actions")).json()
    assert (
        replay.json()["action_id"],
        actions["total"],
        stats_result["total_loki_interventions"],
    ) == (first.json()["action_id"], 1, 1)
    assert replay.json() == first.json()
    assert first.json()["issued_at"].endswith("Z")
    assert provider.calls == 1
    assert replay.headers["X-Cooldown-Seconds"] == first.headers["X-Cooldown-Seconds"]


@pytest.mark.integration
async def test_intervention_receipts_expire_and_cascade_without_removing_history(
    migrated_streak_client: tuple[AsyncClient, AsyncClient, async_sessionmaker[AsyncSession]],
) -> None:
    """An expired task receipt permits a fresh result, and deletion denies replay."""
    owner, other, sessions = migrated_streak_client
    original = "A different draft."
    payload = {"content": original, "lock_ids": []}
    task_ids = [
        (await client.post("/tasks/", json=payload)).json()["id"] for client in (owner, other)
    ]
    first_task_id, other_task_id = task_ids
    path = "/impetus/generate-intervention"
    headers = {
        "X-Task-Id": first_task_id,
        "Idempotency-Key": "this-key-is-not-stored-verbatim",
        "X-Contract-Version": "2.0.0",
        "X-LLM-Api-Key": "irrelevant-test-only-key",
        "X-LLM-Provider": "debug",
    }
    request = {
        "context": original,
        "mode": "muse",
        "client_meta": {"doc_version": 0, "selection_from": 0, "selection_to": 0},
    }
    first = await owner.post(path, headers=headers, json=request)
    assert first.status_code == 200, first.text
    assert (await other.post(path, headers=headers, json=request)).status_code == 404
    other_action = await other.post(
        path, headers={**headers, "X-Task-Id": other_task_id}, json=request
    )
    assert other_action.status_code == 200, other_action.text
    assert other_action.json()["action_id"] != first.json()["action_id"]

    async with sessions() as session:
        receipt = (
            (
                await session.execute(
                    text(
                        "SELECT *, EXTRACT(EPOCH FROM expires_at - clock_timestamp()) AS remaining "
                        "FROM intervention_receipts WHERE task_id = :task_id"
                    ),
                    {"task_id": UUID(first_task_id)},
                )
            )
            .mappings()
            .one()
        )
        assert set(receipt) == {
            "user_id",
            "task_id",
            "action_id",
            "key_digest",
            "expires_at",
            "remaining",
        }
        assert 0 < receipt["remaining"] <= 15
        assert len(receipt["key_digest"]) == 64
        assert receipt["key_digest"] != headers["Idempotency-Key"]
        await session.execute(
            text(
                "UPDATE intervention_receipts "
                "SET expires_at = clock_timestamp() - interval '1 second' "
                "WHERE task_id = :task_id"
            ),
            {"task_id": UUID(first_task_id)},
        )
        await session.commit()

    # Use another fresh request to exercise cleanup independently of same-key replacement.
    different_key = await owner.post(
        path, headers={**headers, "Idempotency-Key": str(uuid4())}, json=request
    )
    assert different_key.status_code == 200, different_key.text
    async with sessions() as session:
        assert (
            await session.scalar(
                text("SELECT count(*) FROM intervention_receipts WHERE action_id = :action_id"),
                {"action_id": first.json()["action_id"]},
            )
            == 0
        )
        assert (
            await session.scalar(
                text("SELECT count(*) FROM intervention_actions WHERE action_id = :action_id"),
                {"action_id": first.json()["action_id"]},
            )
            == 1
        )
    new_result = await owner.post(path, headers=headers, json=request)
    assert new_result.status_code == 200, new_result.text
    assert new_result.json()["action_id"] != first.json()["action_id"]
    assert (await owner.get("/stats/")).json()["total_muse_interventions"] == 3

    assert (await owner.delete(f"/tasks/{first_task_id}")).status_code == 204
    assert (await owner.post(path, headers=headers, json=request)).status_code == 404
    async with sessions() as session:
        assert (
            await session.scalar(
                text("SELECT count(*) FROM intervention_receipts WHERE task_id = :task_id"),
                {"task_id": UUID(first_task_id)},
            )
            == 0
        )


@pytest.mark.integration
async def test_intervention_rechecks_task_after_the_first_ownership_read(
    migrated_streak_client: tuple[AsyncClient, AsyncClient, async_sessionmaker[AsyncSession]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A request that was admitted before deleting the draft cannot replay or generate."""
    owner, _, _ = migrated_streak_client
    created = await owner.post("/tasks/", json={"content": "A draft", "lock_ids": []})
    assert created.status_code == 201
    task_id = created.json()["id"]
    entering_lock = asyncio.Event()
    resume = asyncio.Event()
    original_lock = PostgreSQLInterventionReplay.lock_and_read

    async def after_first_ownership_read(
        replay: PostgreSQLInterventionReplay,
    ) -> InterventionResponse | None:
        entering_lock.set()
        await asyncio.wait_for(resume.wait(), timeout=5)
        return await original_lock(replay)

    monkeypatch.setattr(PostgreSQLInterventionReplay, "lock_and_read", after_first_ownership_read)
    generation = asyncio.create_task(
        owner.post(
            "/impetus/generate-intervention",
            headers={
                "X-Task-Id": task_id,
                "Idempotency-Key": str(uuid4()),
                "X-Contract-Version": "2.0.0",
            },
            json={
                "context": "A draft",
                "mode": "muse",
                "client_meta": {"doc_version": 0, "selection_from": 0, "selection_to": 0},
            },
        )
    )
    try:
        await asyncio.wait_for(entering_lock.wait(), timeout=5)
        assert (await owner.delete(f"/tasks/{task_id}")).status_code == 204
    finally:
        resume.set()
        rejected = await generation
    assert rejected.status_code == 404, rejected.text
    assert (await owner.get("/stats/")).json()["total_muse_interventions"] == 0


@pytest.mark.integration
async def test_failed_intervention_commit_leaves_no_receipt_and_can_be_retried(
    migrated_streak_client: tuple[AsyncClient, AsyncClient, async_sessionmaker[AsyncSession]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Record action, achievement, stats and receipt in one PostgreSQL transaction."""
    owner, _, sessions = migrated_streak_client
    created = await owner.post("/tasks/", json={"content": "Original", "lock_ids": []})
    assert created.status_code == 201
    task_id = created.json()["id"]
    path = "/impetus/generate-intervention"
    headers = {
        "X-Task-Id": task_id,
        "Idempotency-Key": str(uuid4()),
        "X-Contract-Version": "2.0.0",
    }
    request = {
        "context": "Original",
        "mode": "muse",
        "client_meta": {"doc_version": 0, "selection_from": 0, "selection_to": 0},
    }

    async def fail_commit(session: AsyncSession) -> None:
        await session.flush()
        raise OperationalError("COMMIT", {}, RuntimeError("simulated database failure"))

    with monkeypatch.context() as patch:
        patch.setattr(AsyncSession, "commit", fail_commit)
        failed = await owner.post(path, headers=headers, json=request)
    assert failed.status_code == 500
    assert failed.json()["detail"]["error"] == "DatabaseError"
    assert (await owner.get("/stats/")).json()["total_muse_interventions"] == 0
    assert (await owner.get(f"/tasks/{task_id}/actions")).json()["total"] == 0
    assert (await owner.get("/achievements/")).json()["total"] == 1
    async with sessions() as session:
        assert await session.scalar(text("SELECT count(*) FROM intervention_receipts")) == 0
    async with AsyncClient(
        transport=ASGITransport(app=_writing_app(sessions), raise_app_exceptions=False),
        base_url="http://test",
        cookies=dict(owner.cookies),
        headers=dict(owner.headers),
    ) as second_worker:
        committed = await second_worker.post(path, headers=headers, json=request)
    assert committed.status_code == 200, committed.text
    assert (await owner.post(path, headers=headers, json=request)).json() == committed.json()
    assert (await owner.get("/stats/")).json()["total_muse_interventions"] == 1
    assert (await owner.get(f"/tasks/{task_id}/actions")).json()["total"] == 1
    assert (await owner.get("/achievements/")).json()["total"] == 2
