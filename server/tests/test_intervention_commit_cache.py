"""HTTP regressions for publishing idempotent success after database commit."""

from collections.abc import AsyncIterator
from datetime import UTC, datetime
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import Select
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from server.api.auth.middleware import AuthenticationMiddleware
from server.api.routes import intervention
from server.infrastructure.persistence.database import get_session_optional
from server.infrastructure.persistence.models import TaskModel
from server.infrastructure.security.jwt_handler import JWTHandler


@pytest.fixture(scope="session", autouse=True)
def initialize_test_database() -> None:
    """Replace root database bootstrap: this module fakes the DB session boundary."""


@pytest.fixture
async def authenticated_commit_client(
    monkeypatch: pytest.MonkeyPatch,
) -> AsyncIterator[tuple[AsyncClient, AsyncMock, str]]:
    """Authenticate an owner and represent its task at the external DB boundary."""
    monkeypatch.delenv("TESTING", raising=False)
    monkeypatch.setenv("JWT_SECRET", "r05-commit-cache-test-secret-only")
    monkeypatch.setenv("LLM_DEFAULT_PROVIDER", "debug")
    monkeypatch.setenv("LLM_ALLOW_DEBUG_PROVIDER", "1")
    now = datetime.now(UTC)
    task = TaskModel(
        id=uuid4(),
        user_id=uuid4(),
        content="The door opened.",
        lock_ids=[],
        created_at=now,
        updated_at=now,
        version=0,
        title="",
        category="WRITING",
        priority="MEDIUM",
        due_date=None,
        word_count=3,
    )
    session = AsyncMock(spec=AsyncSession)

    def lookup_owned_task(statement: Select[tuple[TaskModel]]) -> Mock:
        # Faithfully return the row only for the matching task and owner filters.
        parameters = statement.compile().params.values()
        result = Mock()
        result.scalar_one_or_none.return_value = (
            task if task.id in parameters and task.user_id in parameters else None
        )
        return result

    session.execute.side_effect = lookup_owned_task
    app = FastAPI()
    app.add_middleware(AuthenticationMiddleware)
    app.include_router(intervention.router)
    # Router, auth, service, provider, cache and SQL repository remain real.
    app.dependency_overrides[get_session_optional] = lambda: session
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        cookies={
            "access_token": JWTHandler.create_token(str(task.user_id)),
            "csrf_token": "r05-commit-cache-csrf",
        },
        headers={"X-CSRF-Token": "r05-commit-cache-csrf"},
    ) as client:
        yield client, session, str(task.id)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "commit_error",
    [
        RuntimeError("commit unavailable"),
        OperationalError("COMMIT", {}, RuntimeError("database unavailable")),
    ],
    ids=["runtime-error", "operational-error"],
)
async def test_same_key_retry_after_failed_commit_remains_an_error(
    authenticated_commit_client: tuple[AsyncClient, AsyncMock, str], commit_error: Exception
) -> None:
    """Both retries must fail and roll back when persistence cannot commit."""
    client, session, task_id = authenticated_commit_client
    session.commit.side_effect = commit_error

    headers = {
        "Idempotency-Key": "550e8400-e29b-41d4-a716-446655440000",
        "X-Contract-Version": "2.0.0",
        "X-Task-Id": task_id,
    }
    payload = {
        "context": "The door opened.",
        "mode": "muse",
        "client_meta": {"doc_version": 1, "selection_from": 16, "selection_to": 16},
    }
    first = await client.post("/impetus/generate-intervention", headers=headers, json=payload)
    second = await client.post("/impetus/generate-intervention", headers=headers, json=payload)

    assert first.status_code == 500
    assert first.json()["detail"]["error"] == "DatabaseError"
    assert [first.status_code, second.status_code] == [500, 500]
    assert second.json()["detail"]["error"] == "DatabaseError"
    assert session.commit.await_count == 2
    assert session.rollback.await_count == 2


async def test_same_key_retry_after_successful_commit_returns_cached_response(
    authenticated_commit_client: tuple[AsyncClient, AsyncMock, str],
) -> None:
    """A committed response is reused without a second persistence or generation."""
    client, session, task_id = authenticated_commit_client

    headers = {
        "Idempotency-Key": "550e8400-e29b-41d4-a716-446655440002",
        "X-Contract-Version": "2.0.0",
        "X-Task-Id": task_id,
    }
    payload = {
        "context": "The door opened.",
        "mode": "muse",
        "client_meta": {"doc_version": 1, "selection_from": 16, "selection_to": 16},
    }
    first = await client.post("/impetus/generate-intervention", headers=headers, json=payload)
    second = await client.post("/impetus/generate-intervention", headers=headers, json=payload)

    assert first.status_code == second.status_code == 200
    assert first.json()["action_id"] == second.json()["action_id"]
    assert first.json()["lock_id"] == second.json()["lock_id"]
    assert session.commit.await_count == 1
    assert session.add.call_count == 1


async def test_no_session_success_still_caches_response() -> None:
    """A successful response without persistence still participates in idempotency."""
    app = FastAPI()
    app.include_router(intervention.router)
    app.dependency_overrides[get_session_optional] = lambda: None

    headers = {
        "Idempotency-Key": "550e8400-e29b-41d4-a716-446655440004",
        "X-Contract-Version": "2.0.0",
    }
    payload = {
        "context": "The door opened.",
        "mode": "muse",
        "client_meta": {"doc_version": 1, "selection_from": 16, "selection_to": 16},
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        first = await client.post("/impetus/generate-intervention", headers=headers, json=payload)
        second = await client.post("/impetus/generate-intervention", headers=headers, json=payload)

    assert first.status_code == second.status_code == 200
    assert first.json()["action_id"] == second.json()["action_id"]
    assert first.json()["lock_id"] == second.json()["lock_id"]
