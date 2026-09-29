"""HTTP regressions for publishing idempotent success after database commit."""

import asyncio
import time
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import cast
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
from server.infrastructure.llm.debug_provider import DebugLLMProvider
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


async def test_concurrent_same_key_requests_share_generation_and_commit(
    authenticated_commit_client: tuple[AsyncClient, AsyncMock, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An overlapping retry shares the first committed intervention, without duplicate work."""
    client, session, task_id = authenticated_commit_client
    provider = Mock(side_effect=DebugLLMProvider().generate_intervention)
    monkeypatch.setattr(DebugLLMProvider, "generate_intervention", provider)
    commit_entered = asyncio.Event()
    release_commit = asyncio.Event()
    retry_authorized = asyncio.Event()

    async def blocked_commit() -> None:
        commit_entered.set()
        await release_commit.wait()

    session.commit.side_effect = blocked_commit
    lookup_owned_task = session.execute.side_effect

    def lookup_retry_task(statement: Select[tuple[TaskModel]]) -> Mock:
        result = cast(Mock, lookup_owned_task(statement))
        # The second request has reached the real router's ownership check.
        # This synchronous boundary returns before the request next suspends.
        retry_authorized.set()
        return result

    headers = {
        "Idempotency-Key": str(uuid4()),
        "X-Contract-Version": "2.0.0",
        "X-Task-Id": task_id,
    }
    payload = {
        "context": "The door opened.",
        "mode": "muse",
        "client_meta": {"doc_version": 1, "selection_from": 16, "selection_to": 16},
    }
    requests = [
        asyncio.create_task(
            client.post("/impetus/generate-intervention", headers=headers, json=payload)
        )
    ]
    try:
        await asyncio.wait_for(commit_entered.wait(), timeout=5)
        session.execute.side_effect = lookup_retry_task
        requests.append(
            asyncio.create_task(
                client.post("/impetus/generate-intervention", headers=headers, json=payload)
            )
        )
        await asyncio.wait_for(retry_authorized.wait(), timeout=5)
        release_commit.set()
        first, retry = await asyncio.wait_for(asyncio.gather(*requests), timeout=5)
    finally:
        release_commit.set()
        for request in requests:
            if not request.done():
                request.cancel()
        await asyncio.gather(*requests, return_exceptions=True)

    assert first.status_code == retry.status_code == 200
    observed = (
        first.json() == retry.json(),
        provider.call_count,
        session.commit.await_count,
        session.add.call_count,
    )
    assert observed == (True, 1, 1, 1), (
        "Concurrent retries must reuse one committed response; observed "
        "(responses_equal, generations, commits, history_writes): "
        f"{observed}"
    )


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


@pytest.mark.parametrize("scope_change", ["user", "task", "no-task"])
async def test_same_key_different_scopes_generate_independent_responses(
    authenticated_commit_client: tuple[AsyncClient, AsyncMock, str], scope_change: str
) -> None:
    """The same client key cannot reuse another user's or task's intervention."""
    client, session, task_id = authenticated_commit_client
    headers = {"Idempotency-Key": str(uuid4()), "X-Contract-Version": "2.0.0"}
    if scope_change != "user":
        headers["X-Task-Id"] = task_id
    payload = {
        "context": "The door opened.",
        "mode": "muse",
        "client_meta": {"doc_version": 1, "selection_from": 16, "selection_to": 16},
    }
    first = await client.post("/impetus/generate-intervention", headers=headers, json=payload)
    assert first.status_code == 200

    if scope_change == "user":
        client.cookies.set("access_token", JWTHandler.create_token(str(uuid4())))
    elif scope_change == "no-task":
        del headers["X-Task-Id"]
    else:
        other_id = uuid4()
        owner_id = JWTHandler.verify_token(client.cookies.get("access_token"))["sub"]
        now = datetime.now(UTC)
        other_task = TaskModel(
            id=other_id,
            user_id=owner_id,
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
        result = Mock()
        result.scalar_one_or_none.return_value = other_task
        session.execute.return_value = result
        session.execute.side_effect = None
        headers["X-Task-Id"] = str(other_id)

    second = await client.post("/impetus/generate-intervention", headers=headers, json=payload)
    retry = await client.post("/impetus/generate-intervention", headers=headers, json=payload)
    assert second.status_code == retry.status_code == 200
    assert second.json()["action_id"] != first.json()["action_id"]
    assert retry.json() == second.json()
    assert session.commit.await_count == 2


def _request_payload() -> dict[str, object]:
    return {
        "context": "The door opened.",
        "mode": "muse",
        "client_meta": {"doc_version": 1, "selection_from": 16, "selection_to": 16},
    }


async def test_same_scope_retries_keep_first_result_with_changed_payload_and_provider(
    authenticated_commit_client: tuple[AsyncClient, AsyncMock, str],
) -> None:
    """Retry semantics ignore payload and BYOK changes without a new conflict response."""
    client, session, task_id = authenticated_commit_client
    headers = {
        "Idempotency-Key": str(uuid4()),
        "X-Contract-Version": "2.0.0",
        "X-Task-Id": task_id,
    }
    payload = _request_payload()
    payload["mode"] = "loki"
    first = await client.post("/impetus/generate-intervention", headers=headers, json=payload)
    assert first.status_code == 200
    headers.update(
        {
            "X-LLM-Provider": "unsupported-retry-provider",
            "X-LLM-Model": "changed-retry-model",
            "X-LLM-Api-Key": "r06-fake-byok-key-only",
        }
    )
    payload = _request_payload()
    payload["context"] = "A different story."
    retry = await client.post("/impetus/generate-intervention", headers=headers, json=payload)
    assert retry.status_code == 200
    assert retry.json() == first.json()
    assert retry.headers["X-Cooldown-Seconds"] == first.headers["X-Cooldown-Seconds"]
    assert retry.headers["X-Contract-Version"] == "2.0.0"
    assert session.commit.await_count == session.add.call_count == 1


async def test_scoped_success_expires_after_fifteen_seconds(
    authenticated_commit_client: tuple[AsyncClient, AsyncMock, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """HTTP retries reuse the first response through exact TTL, then generate again."""
    client, session, task_id = authenticated_commit_client
    now = time.time()
    monkeypatch.setattr("server.infrastructure.cache.idempotency_cache.time.time", lambda: now)
    headers = {
        "Idempotency-Key": str(uuid4()),
        "X-Contract-Version": "2.0.0",
        "X-Task-Id": task_id,
    }
    first = await client.post(
        "/impetus/generate-intervention", headers=headers, json=_request_payload()
    )
    now += 15
    boundary = await client.post(
        "/impetus/generate-intervention", headers=headers, json=_request_payload()
    )
    now += 0.1
    expired = await client.post(
        "/impetus/generate-intervention", headers=headers, json=_request_payload()
    )
    assert first.status_code == boundary.status_code == expired.status_code == 200
    assert boundary.json() == first.json()
    assert expired.json()["action_id"] != first.json()["action_id"]
    assert session.commit.await_count == 2


async def test_retry_after_generation_failure_can_generate_and_commit(
    authenticated_commit_client: tuple[AsyncClient, AsyncMock, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A failed provider call releases the key and never becomes cached success."""
    client, session, task_id = authenticated_commit_client
    generated = DebugLLMProvider().generate_intervention("The door opened.", "muse")
    provider = Mock(side_effect=[RuntimeError("generation unavailable"), generated])
    monkeypatch.setattr(DebugLLMProvider, "generate_intervention", provider)
    headers = {
        "Idempotency-Key": str(uuid4()),
        "X-Contract-Version": "2.0.0",
        "X-Task-Id": task_id,
    }
    failed = await client.post(
        "/impetus/generate-intervention", headers=headers, json=_request_payload()
    )
    assert failed.status_code == 500
    assert session.commit.await_count == session.add.call_count == 0
    retried = await asyncio.wait_for(
        client.post("/impetus/generate-intervention", headers=headers, json=_request_payload()),
        timeout=5,
    )
    cached = await client.post(
        "/impetus/generate-intervention", headers=headers, json=_request_payload()
    )
    assert retried.status_code == cached.status_code == 200
    assert retried.json() == cached.json()
    assert provider.call_count == 2
    assert session.commit.await_count == session.add.call_count == 1


@pytest.mark.parametrize("exit_kind", ["commit-failure", "cancel-holder", "cancel-waiter"])
async def test_overlapping_retry_survives_failed_or_cancelled_flight(
    authenticated_commit_client: tuple[AsyncClient, AsyncMock, str], exit_kind: str
) -> None:
    """Holder failures and waiter cancellations release work without orphaning the key."""
    client, session, task_id = authenticated_commit_client
    commit_entered = asyncio.Event()
    release_commit = asyncio.Event()
    retry_authorized = asyncio.Event()
    commits = 0

    async def blocked_first_commit() -> None:
        nonlocal commits
        commits += 1
        if commits == 1:
            commit_entered.set()
            await release_commit.wait()
            if exit_kind == "commit-failure":
                raise RuntimeError("first commit unavailable")

    session.commit.side_effect = blocked_first_commit
    lookup_owned_task = session.execute.side_effect

    def lookup_retry_task(statement: Select[tuple[TaskModel]]) -> Mock:
        result = cast(Mock, lookup_owned_task(statement))
        retry_authorized.set()
        return result

    headers = {
        "Idempotency-Key": str(uuid4()),
        "X-Contract-Version": "2.0.0",
        "X-Task-Id": task_id,
    }
    requests = [
        asyncio.create_task(
            client.post("/impetus/generate-intervention", headers=headers, json=_request_payload())
        )
    ]
    try:
        await asyncio.wait_for(commit_entered.wait(), timeout=5)
        session.execute.side_effect = lookup_retry_task
        requests.append(
            asyncio.create_task(
                client.post(
                    "/impetus/generate-intervention", headers=headers, json=_request_payload()
                )
            )
        )
        await asyncio.wait_for(retry_authorized.wait(), timeout=5)
        if exit_kind == "cancel-holder":
            requests[0].cancel()
            with pytest.raises(asyncio.CancelledError):
                await requests[0]
            successful = await asyncio.wait_for(requests[1], timeout=5)
        elif exit_kind == "cancel-waiter":
            requests[1].cancel()
            with pytest.raises(asyncio.CancelledError):
                await requests[1]
            release_commit.set()
            successful = await asyncio.wait_for(requests[0], timeout=5)
        else:
            release_commit.set()
            failed, successful = await asyncio.wait_for(asyncio.gather(*requests), timeout=5)
            assert failed.status_code == 500
            assert session.rollback.await_count == 1
        assert successful.status_code == 200
        cached = await asyncio.wait_for(
            client.post("/impetus/generate-intervention", headers=headers, json=_request_payload()),
            timeout=5,
        )
        assert cached.status_code == 200
        assert cached.json() == successful.json()
        assert commits == (1 if exit_kind == "cancel-waiter" else 2)
    finally:
        release_commit.set()
        for request in requests:
            if not request.done():
                request.cancel()
        await asyncio.gather(*requests, return_exceptions=True)


async def test_different_keys_complete_while_another_commit_is_blocked(
    authenticated_commit_client: tuple[AsyncClient, AsyncMock, str],
) -> None:
    """Serializing retries never imposes a global lock on independent requests."""
    client, session, task_id = authenticated_commit_client
    commit_entered = asyncio.Event()
    release_commit = asyncio.Event()
    commits = 0

    async def blocked_first_commit() -> None:
        nonlocal commits
        commits += 1
        if commits == 1:
            commit_entered.set()
            await release_commit.wait()

    session.commit.side_effect = blocked_first_commit
    headers = {
        "Idempotency-Key": str(uuid4()),
        "X-Contract-Version": "2.0.0",
        "X-Task-Id": task_id,
    }
    first = asyncio.create_task(
        client.post("/impetus/generate-intervention", headers=headers, json=_request_payload())
    )
    try:
        await asyncio.wait_for(commit_entered.wait(), timeout=5)
        second = await asyncio.wait_for(
            client.post(
                "/impetus/generate-intervention",
                headers={**headers, "Idempotency-Key": str(uuid4())},
                json=_request_payload(),
            ),
            timeout=5,
        )
        assert second.status_code == 200
        assert not first.done()
        release_commit.set()
        completed = await asyncio.wait_for(first, timeout=5)
        assert completed.status_code == 200
        assert completed.json()["action_id"] != second.json()["action_id"]
        assert commits == 2
    finally:
        release_commit.set()
        if not first.done():
            first.cancel()
        await asyncio.gather(first, return_exceptions=True)
