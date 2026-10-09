"""Authenticated HTTP regression for intervention task ownership."""

from collections.abc import AsyncIterator
from datetime import UTC, datetime
from unittest.mock import Mock
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from server.api.main import app
from server.domain.models.anchor import AnchorPos
from server.domain.models.intervention import InterventionResponse
from server.infrastructure.llm.debug_provider import DebugLLMProvider


@pytest.mark.asyncio
async def test_foreign_task_intervention_is_rejected_before_generation_and_history_write(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A logged-in non-owner gets task404 without generating or changing history."""
    # Keep mounted authentication/CSRF, service, cache and SQL repository real.
    # The root fixture initializes the local SQLite database before this test.
    monkeypatch.delenv("TESTING", raising=False)
    monkeypatch.setenv("JWT_SECRET", "r05-task-ownership-test-secret-only")
    monkeypatch.setenv("LLM_DEFAULT_PROVIDER", "debug")
    monkeypatch.setenv("LLM_ALLOW_DEBUG_PROVIDER", "1")
    provider = Mock(
        return_value=InterventionResponse(
            action="provoke",
            content="An unexpected visitor arrived.",
            lock_id=f"lock_{uuid4()}",
            anchor=AnchorPos(from_=16),
            action_id=f"act_{uuid4()}",
            issued_at=datetime.now(UTC),
            source="muse",
        )
    )
    monkeypatch.setattr(DebugLLMProvider, "generate_intervention", provider)

    transport = ASGITransport(app=app)
    async with (
        AsyncClient(transport=transport, base_url="http://test") as owner,
        AsyncClient(transport=transport, base_url="http://test") as non_owner,
    ):
        for client in (owner, non_owner):
            registered = await client.post(
                "/auth/register",
                json={"email": f"r05-{uuid4()}@example.com", "password": "securePassword123"},
            )
            assert registered.status_code == 201
            client.headers["X-CSRF-Token"] = client.cookies["csrf_token"]
            assert (await client.get("/auth/me")).status_code == 200

        created = await owner.post("/tasks/", json={"content": "The door opened.", "lock_ids": []})
        assert created.status_code == 201
        task_id = created.json()["id"]
        history_path = f"/tasks/{task_id}/actions"
        before = await owner.get(history_path)
        assert before.status_code == 200
        assert before.json()["total"] == 0

        task404 = await non_owner.get(f"/tasks/{task_id}")
        assert task404.status_code == 404
        attempted = await non_owner.post(
            "/impetus/generate-intervention",
            headers={
                "Idempotency-Key": str(uuid4()),
                "X-Contract-Version": "2.0.0",
                "X-Task-Id": task_id,
            },
            json={
                "context": "The door opened.",
                "mode": "muse",
                "client_meta": {"doc_version": 1, "selection_from": 16, "selection_to": 16},
            },
        )
        after = await owner.get(history_path)
        assert after.status_code == 200

    # Check all forbidden effects together so RED evidence reports each outcome.
    observed = (
        attempted.status_code,
        attempted.json().get("detail"),
        provider.call_count,
        after.json()["total"],
    )
    assert observed == (404, task404.json()["detail"], 0, 0)


@pytest.fixture
async def authenticated_intervention_clients(
    monkeypatch: pytest.MonkeyPatch,
) -> AsyncIterator[tuple[AsyncClient, AsyncClient, str, Mock]]:
    """Use real authenticated clients and persistence with only the provider stubbed."""
    monkeypatch.delenv("TESTING", raising=False)
    monkeypatch.setenv("JWT_SECRET", "r05-task-ownership-test-secret-only")
    monkeypatch.setenv("LLM_DEFAULT_PROVIDER", "debug")
    monkeypatch.setenv("LLM_ALLOW_DEBUG_PROVIDER", "1")
    provider = Mock(
        return_value=InterventionResponse(
            action="provoke",
            content="An unexpected visitor arrived.",
            lock_id=f"lock_{uuid4()}",
            anchor=AnchorPos(from_=16),
            action_id=f"act_{uuid4()}",
            issued_at=datetime.now(UTC),
            source="muse",
        )
    )
    monkeypatch.setattr(DebugLLMProvider, "generate_intervention", provider)
    transport = ASGITransport(app=app)
    async with (
        AsyncClient(transport=transport, base_url="http://test") as owner,
        AsyncClient(transport=transport, base_url="http://test") as non_owner,
    ):
        for client in (owner, non_owner):
            registered = await client.post(
                "/auth/register",
                json={"email": f"r05-{uuid4()}@example.com", "password": "securePassword123"},
            )
            assert registered.status_code == 201
            client.headers["X-CSRF-Token"] = client.cookies["csrf_token"]
            assert (await client.get("/auth/me")).status_code == 200
        created = await owner.post("/tasks/", json={"content": "The door opened.", "lock_ids": []})
        assert created.status_code == 201
        yield owner, non_owner, created.json()["id"], provider


def _intervention_payload() -> dict[str, object]:
    return {
        "context": "The door opened.",
        "mode": "muse",
        "client_meta": {"doc_version": 1, "selection_from": 16, "selection_to": 16},
    }


@pytest.mark.parametrize(
    ("task_access", "warm_cache"),
    [("foreign", True), ("missing", False), ("missing", True), ("deleted", True)],
)
async def test_unavailable_task_is_rejected_even_with_a_cached_response(
    authenticated_intervention_clients: tuple[AsyncClient, AsyncClient, str, Mock],
    task_access: str,
    warm_cache: bool,
) -> None:
    """Task404 precedes generation, history writes and previously cached success."""
    owner, non_owner, owned_task_id, provider = authenticated_intervention_clients
    headers = {
        "Idempotency-Key": str(uuid4()),
        "X-Contract-Version": "2.0.0",
        "X-Task-Id": owned_task_id,
    }
    if warm_cache:
        generated = await owner.post(
            "/impetus/generate-intervention", headers=headers, json=_intervention_payload()
        )
        repeated = await owner.post(
            "/impetus/generate-intervention", headers=headers, json=_intervention_payload()
        )
        assert generated.status_code == repeated.status_code == 200
        assert repeated.json() == generated.json()
        history = await owner.get(f"/tasks/{owned_task_id}/actions")
        assert history.status_code == 200
        assert history.json()["total"] == 1

    client = non_owner if task_access == "foreign" else owner
    if task_access == "missing":
        headers["X-Task-Id"] = str(uuid4())
    elif task_access == "deleted":
        deleted = await owner.delete(f"/tasks/{owned_task_id}")
        assert deleted.status_code == 204

    task404 = await client.get(f"/tasks/{headers['X-Task-Id']}")
    assert task404.status_code == 404
    attempted = await client.post(
        "/impetus/generate-intervention", headers=headers, json=_intervention_payload()
    )
    assert (attempted.status_code, attempted.json().get("detail"), provider.call_count) == (
        404,
        task404.json()["detail"],
        int(warm_cache),
    )
    if task_access != "deleted":
        history = await owner.get(f"/tasks/{owned_task_id}/actions")
        assert history.status_code == 200
        assert history.json()["total"] == int(warm_cache)


@pytest.mark.parametrize("task_header", ["own", "omitted", "invalid-uuid"])
async def test_owner_and_optional_task_id_remain_supported(
    authenticated_intervention_clients: tuple[AsyncClient, AsyncClient, str, Mock], task_header: str
) -> None:
    """Own tasks persist history; omitted and malformed IDs retain non-persistence."""
    owner, _, task_id, provider = authenticated_intervention_clients
    headers = {"Idempotency-Key": str(uuid4()), "X-Contract-Version": "2.0.0"}
    if task_header != "omitted":
        headers["X-Task-Id"] = task_id if task_header == "own" else task_header
    generated = await owner.post(
        "/impetus/generate-intervention", headers=headers, json=_intervention_payload()
    )
    repeated = await owner.post(
        "/impetus/generate-intervention", headers=headers, json=_intervention_payload()
    )
    assert generated.status_code == repeated.status_code == 200
    assert generated.json() == repeated.json()
    assert provider.call_count == 1
    history = await owner.get(f"/tasks/{task_id}/actions")
    assert history.status_code == 200
    actions = history.json()["actions"]
    if task_header == "own":
        assert history.json()["total"] == 1
        assert actions[0]["action_id"] == generated.json()["action_id"]
    else:
        assert history.json()["total"] == 0
        assert actions == []
