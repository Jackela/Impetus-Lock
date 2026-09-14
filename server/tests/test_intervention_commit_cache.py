"""HTTP regressions for publishing idempotent success after database commit."""

from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from server.api.routes import intervention
from server.infrastructure.persistence.database import get_session_optional


@pytest.fixture(scope="session", autouse=True)
def initialize_test_database() -> None:
    """Replace root database bootstrap: this module fakes the DB session boundary."""


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
    monkeypatch: pytest.MonkeyPatch, commit_error: Exception
) -> None:
    """Both retries must fail and roll back when persistence cannot commit."""
    monkeypatch.setenv("LLM_DEFAULT_PROVIDER", "debug")
    monkeypatch.setenv("LLM_ALLOW_DEBUG_PROVIDER", "1")
    session = AsyncMock(spec=AsyncSession)
    session.commit.side_effect = commit_error

    app = FastAPI()
    app.include_router(intervention.router)
    # Keep the real service, registry, debug provider, cache and SQL repository.
    # Only the external database session is substituted, with no app lifecycle.
    app.dependency_overrides[get_session_optional] = lambda: session

    headers = {
        "Idempotency-Key": "550e8400-e29b-41d4-a716-446655440000",
        "X-Contract-Version": "2.0.0",
        "X-Task-Id": "550e8400-e29b-41d4-a716-446655440001",
    }
    payload = {
        "context": "The door opened.",
        "mode": "muse",
        "client_meta": {"doc_version": 1, "selection_from": 16, "selection_to": 16},
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        first = await client.post("/impetus/generate-intervention", headers=headers, json=payload)
        second = await client.post("/impetus/generate-intervention", headers=headers, json=payload)

    assert first.status_code == 500
    assert first.json()["detail"]["error"] == "DatabaseError"
    assert [first.status_code, second.status_code] == [500, 500]
    assert second.json()["detail"]["error"] == "DatabaseError"
    assert session.commit.await_count == 2
    assert session.rollback.await_count == 2


async def test_same_key_retry_after_successful_commit_returns_cached_response() -> None:
    """A committed response is reused without a second persistence or generation."""
    session = AsyncMock(spec=AsyncSession)
    app = FastAPI()
    app.include_router(intervention.router)
    app.dependency_overrides[get_session_optional] = lambda: session

    headers = {
        "Idempotency-Key": "550e8400-e29b-41d4-a716-446655440002",
        "X-Contract-Version": "2.0.0",
        "X-Task-Id": "550e8400-e29b-41d4-a716-446655440003",
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
