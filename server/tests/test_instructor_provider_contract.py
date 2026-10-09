"""Offline wire and service contracts for the official, exact Sol provider branch."""

from __future__ import annotations

import asyncio
import json
import os
import socket
from collections.abc import Callable, Iterator
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from threading import Event, Lock
from typing import Any
from unittest.mock import AsyncMock
from uuid import uuid4

import httpx2
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from openai import OpenAI

from server.api.routes import intervention
from server.application.services.intervention_service import InterventionService
from server.domain.errors import LLMProviderError
from server.domain.models.intervention import ClientMeta, InterventionRequest
from server.infrastructure.llm import instructor_provider
from server.infrastructure.llm.provider_registry import ProviderRegistry, close_provider
from server.infrastructure.persistence.database import get_session_optional

MODEL = "gpt-6.1-sol"
CONTEXT = "A long passage about an unfamiliar street and a locked door. The door opened."


@pytest.fixture(scope="session", autouse=True)
def initialize_test_database() -> None:
    """These provider/service tests use no database or network services."""


def completion(content: str | None, **message_fields: Any) -> dict[str, Any]:
    return {
        "id": "offline-completion",
        "object": "chat.completion",
        "created": 1,
        "model": MODEL,
        "choices": [
            {
                "index": 0,
                "finish_reason": "stop",
                "message": {"role": "assistant", "content": content, **message_fields},
            }
        ],
    }


def request(mode: str = "loki", context: str = CONTEXT) -> InterventionRequest:
    return InterventionRequest.model_validate(
        {
            "context": context,
            "mode": mode,
            "client_meta": ClientMeta(doc_version=7, selection_from=180, selection_to=200),
        }
    )


@dataclass
class Wire:
    replies: list[dict[str, Any] | httpx2.Response | Callable[[], httpx2.Response]]
    records: list[dict[str, Any]] = field(default_factory=list)
    closed: int = 0
    raw: OpenAI | None = None
    clients: list[OpenAI] = field(default_factory=list)
    close_error: Exception | None = None
    record_lock: Any = field(default_factory=Lock, repr=False)

    def handle(self, req: httpx2.Request) -> httpx2.Response:
        # Reserve a response atomically; request parsing can yield to another worker.
        with self.record_lock:
            reply = self.replies[min(len(self.records), len(self.replies) - 1)]
            record = {"url": str(req.url), "request": json.loads(req.content)}
            self.records.append(record)
        try:
            response = reply() if callable(reply) else reply
        except Exception as exc:
            record["exception"] = type(exc).__name__
            raise
        if isinstance(response, dict):
            response = httpx2.Response(200, json=response)
        record.update({"status": response.status_code, "response": response.json()})
        return response


@pytest.fixture
def make_provider(
    monkeypatch: pytest.MonkeyPatch, request: pytest.FixtureRequest
) -> Iterator[Callable[..., tuple[Any, Wire]]]:
    wires: list[Wire] = []
    network_attempts: list[str] = []

    def deny_network(*_: Any, **__: Any) -> Any:
        network_attempts.append("blocked")
        raise AssertionError("Real network access is forbidden in provider contract tests")

    monkeypatch.setattr(socket.socket, "connect", deny_network)
    monkeypatch.setattr(socket.socket, "connect_ex", deny_network)
    monkeypatch.setattr(socket, "getaddrinfo", deny_network)
    # Keep SDK retry counts, while avoiding real retry delays in synthetic tests.
    monkeypatch.setattr("openai._base_client.time.sleep", lambda _: None)

    def make(
        replies: list[Any],
        model: str = MODEL,
        base_url: str = "https://api.openai.com/v1",
        factory_only: bool = False,
    ) -> tuple[Any, Wire]:
        wire = Wire(replies)

        class Transport(httpx2.MockTransport):
            def close(self) -> None:
                wire.closed += 1
                super().close()
                if wire.close_error is not None:
                    raise wire.close_error

        wires.append(wire)

        def raw_factory(**_: Any) -> OpenAI:
            raw = OpenAI(
                api_key="offline-dummy",
                base_url=base_url,
                http_client=httpx2.Client(transport=Transport(wire.handle), trust_env=False),
            )
            wire.raw = raw
            wire.clients.append(raw)
            return raw

        monkeypatch.setattr(instructor_provider, "OpenAI", raw_factory)
        if factory_only:
            return None, wire
        return instructor_provider.InstructorLLMProvider(api_key="offline-dummy", model=model), wire

    yield make
    for wire in wires:
        for raw in wire.clients:
            if not raw.is_closed():
                raw.close()
    evidence_dir = os.getenv("SOL_CONTRACT_EVIDENCE_DIR")
    if evidence_dir:
        path = Path(evidence_dir)
        path.mkdir(parents=True, exist_ok=True)
        name = request.node.name.replace("/", "_")
        (path / f"{name}.json").write_text(
            json.dumps(
                {
                    "test": request.node.nodeid,
                    "network_attempts": network_attempts,
                    "wires": [{"records": w.records, "transport_closes": w.closed} for w in wires],
                },
                indent=2,
                ensure_ascii=False,
            )
            + "\n"
        )
    assert network_attempts == []


def test_sol_strict_wire_preserves_backend_fields(make_provider: Callable[..., Any]) -> None:
    provider, wire = make_provider(
        [
            completion(
                json.dumps(
                    {
                        "action": "provoke",
                        "content": "A new constraint.",
                        "source": "fake",
                        "anchor": {"from": 999},
                        "action_id": "fake",
                        "lock_id": "fake",
                    }
                )
            )
        ]
    )
    response = InterventionService(provider).generate_intervention(request("muse"))
    assert response.action == "provoke"
    assert response.content == "A new constraint."
    assert response.source == "muse"
    assert response.anchor.model_dump(by_alias=True) == {"type": "pos", "from": 200}
    assert response.action_id.startswith("act_") and response.action_id != "fake"
    assert response.lock_id.startswith("lock_") and response.lock_id != "fake"
    assert len(wire.records) == 1
    body = wire.records[0]["request"]
    assert not {"tools", "tool_choice", "temperature"} & body.keys()
    schema = body["response_format"]["json_schema"]
    assert schema["strict"] is True
    assert schema["schema"]["required"] == ["action", "content"]
    assert schema["schema"]["additionalProperties"] is False
    assert {"type": "null"} in schema["schema"]["properties"]["content"]["anyOf"]


@pytest.mark.parametrize(
    "kind",
    [
        "refusal",
        "refusal_valid",
        "empty_refusal",
        "none",
        "length",
        "filter",
        "zero_choices",
        "two_choices",
        "invalid_then_refusal",
        "tool_calls",
        "wrong_role",
        "unknown_finish",
    ],
)
def test_sol_terminal_output_never_executes_or_reasks(
    make_provider: Callable[..., Any], kind: str
) -> None:
    payload = completion(json.dumps({"action": "provoke", "content": "Synthetic text."}))
    choice = payload["choices"][0]
    if kind in {"refusal", "refusal_valid", "empty_refusal", "invalid_then_refusal"}:
        choice["message"]["refusal"] = "" if kind == "empty_refusal" else "Synthetic refusal"
        if kind == "refusal":
            choice["message"]["content"] = None
        elif kind == "invalid_then_refusal":
            choice["message"]["content"] = "{broken"
    elif kind == "none":
        choice["message"]["content"] = None
    elif kind in {"length", "filter", "unknown_finish"}:
        choice["finish_reason"] = {
            "length": "length",
            "filter": "content_filter",
            "unknown_finish": "unknown",
        }[kind]
    elif kind == "zero_choices":
        payload["choices"] = []
    elif kind == "two_choices":
        payload["choices"].append(completion("{broken")["choices"][0])
    elif kind == "tool_calls":
        choice["message"]["tool_calls"] = [
            {"id": "fake", "type": "function", "function": {"name": "fake", "arguments": "{}"}}
        ]
    elif kind == "wrong_role":
        choice["message"]["role"] = "user"
    provider, wire = make_provider([payload])
    with pytest.raises(LLMProviderError) as error:
        InterventionService(provider).generate_intervention(request())
    assert (error.value.code, error.value.status_code) == ("llm_api_error", 502)
    assert len(wire.records) == 1


@pytest.mark.parametrize(
    "invalid",
    ["{broken", '{"action":"invalid","content":"text"}', '{"action":"provoke","content":7}'],
)
def test_sol_repairs_structure_with_bounded_requests(
    make_provider: Callable[..., Any], invalid: str
) -> None:
    provider, wire = make_provider(
        [completion(invalid), completion('{"action":"rewrite","content":"Repaired sentence."}')]
    )
    response = InterventionService(provider).generate_intervention(request("muse"))
    assert response.action == "rewrite"
    assert response.anchor.model_dump(by_alias=True) == {"type": "range", "from": 184, "to": 200}
    assert len(wire.records) == 2
    original = wire.records[0]["request"]["messages"]
    repaired = wire.records[1]["request"]["messages"]
    assert repaired[:2] == original
    assert repaired[2] == {"role": "assistant", "content": invalid}
    assert repaired[3]["role"] == "user" and "valid" in repaired[3]["content"].lower()


def test_sol_structure_exhaustion_is_502_after_four_rounds(
    make_provider: Callable[..., Any],
) -> None:
    provider, wire = make_provider([completion('{"action":"invalid","content":"text"}')])
    with pytest.raises(LLMProviderError) as error:
        InterventionService(provider).generate_intervention(request())
    assert (error.value.code, error.value.status_code) == ("llm_api_error", 502)
    assert len(wire.records) == 4


def test_sol_mixed_sdk_failures_are_at_most_twelve_requests(
    make_provider: Callable[..., Any],
) -> None:
    transient = httpx2.Response(
        500, json={"error": {"message": "Synthetic transient", "type": "server_error"}}
    )
    provider, wire = make_provider([transient, transient, completion('{"action":"invalid"}')] * 4)
    with pytest.raises(LLMProviderError):
        InterventionService(provider).generate_intervention(request())
    assert len(wire.records) == 12


def test_sol_close_releases_transport_once(make_provider: Callable[..., Any]) -> None:
    provider, wire = make_provider([completion('{"action":"delete","content":null}')])
    close_provider(provider)
    close_provider(provider)
    assert wire.closed == 1 and wire.raw.is_closed()
    with pytest.raises(LLMProviderError):
        InterventionService(provider).generate_intervention(request())
    assert wire.records == []


@pytest.mark.parametrize("worker_fails", [False, True])
async def test_sol_repeated_cancellation_drains_worker_before_close_without_history(
    make_provider: Callable[..., Any],
    worker_fails: bool,
) -> None:
    loop = asyncio.get_running_loop()
    started = asyncio.Event()
    release = Event()
    finished = Event()

    def blocked_reply() -> httpx2.Response:
        loop.call_soon_threadsafe(started.set)
        try:
            assert release.wait(5)
            if worker_fails:
                raise RuntimeError("Synthetic worker failure")
            return httpx2.Response(200, json=completion('{"action":"delete","content":null}'))
        finally:
            finished.set()

    provider, wire = make_provider([blocked_reply])
    repository = AsyncMock()

    async def run() -> Any:
        try:
            return await InterventionService(provider).generate_intervention_async(
                request(), task_id=uuid4(), repository=repository
            )
        finally:
            close_provider(provider)

    task = asyncio.create_task(run())
    try:
        await asyncio.wait_for(started.wait(), 5)
        for _ in range(2):
            task.cancel()
            barrier = asyncio.Event()
            loop.call_soon(barrier.set)
            await barrier.wait()
            assert not task.done() and wire.closed == 0
        release.set()
        with pytest.raises(asyncio.CancelledError):
            await asyncio.wait_for(task, 5)
        assert finished.is_set() and wire.closed == 1
        repository.save_action.assert_not_awaited()
    finally:
        release.set()
        await asyncio.gather(task, return_exceptions=True)


async def test_sol_registry_reload_defers_close_for_active_worker(
    make_provider: Callable[..., Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    loop = asyncio.get_running_loop()
    started = asyncio.Event()
    release = Event()

    def blocked_reply() -> httpx2.Response:
        loop.call_soon_threadsafe(started.set)
        assert release.wait(5)
        return httpx2.Response(200, json=completion('{"action":"delete","content":null}'))

    _, wire = make_provider([blocked_reply], factory_only=True)
    monkeypatch.setenv("OPENAI_API_KEY", "offline-dummy")
    monkeypatch.setenv("OPENAI_MODEL", MODEL)
    monkeypatch.setenv("LLM_DEFAULT_PROVIDER", "openai")
    registry = ProviderRegistry()
    # The actual factory constructs a provider using the synthetic SDK client.
    cached = registry.get_provider()
    task = asyncio.create_task(InterventionService(cached).generate_intervention_async(request()))
    try:
        await asyncio.wait_for(started.wait(), 5)
        registry.reload()
        close_provider(cached)
        assert not registry.is_cached(cached) and wire.closed == 0
        release.set()
        response = await asyncio.wait_for(task, 5)
        assert response.action == "delete" and wire.closed == 1
    finally:
        release.set()
        await asyncio.gather(task, return_exceptions=True)


@pytest.mark.parametrize(
    "action,content,anchor",
    [
        ("provoke", "A constraint.", {"type": "pos", "from": 200}),
        ("rewrite", "A replacement.", {"type": "range", "from": 184, "to": 200}),
        ("delete", None, {"type": "range", "from": 80, "to": 200}),
        ("delete", "Discarded content.", {"type": "range", "from": 80, "to": 200}),
    ],
)
def test_sol_three_actions_keep_service_contract(
    make_provider: Callable[..., Any], action: str, content: str | None, anchor: dict[str, Any]
) -> None:
    provider, wire = make_provider([completion(json.dumps({"action": action, "content": content}))])
    response = InterventionService(provider).generate_intervention(request())
    assert response.action == action and response.source == "loki"
    assert response.anchor.model_dump(by_alias=True) == anchor
    assert response.content == (None if action == "delete" else content)
    assert bool(response.lock_id) == (action != "delete")
    assert len(wire.records) == 1


@pytest.mark.parametrize("draft", ['{"action":"delete"}', '{"action":"delete","content":null}'])
def test_sol_local_delete_nullable_compatibility(
    make_provider: Callable[..., Any], draft: str
) -> None:
    provider, wire = make_provider([completion(draft)])
    response = InterventionService(provider).generate_intervention(request())
    assert response.action == "delete" and response.content is None and response.lock_id is None
    assert len(wire.records) == 1


@pytest.mark.parametrize(
    "mode,action,context",
    [
        ("muse", "delete", CONTEXT),
        ("loki", "delete", "A short passage."),
        ("loki", "rewrite", "A short passage."),
    ],
)
def test_sol_service_safety_guards_unchanged(
    make_provider: Callable[..., Any], mode: str, action: str, context: str
) -> None:
    provider, _ = make_provider([completion(json.dumps({"action": action, "content": "Text."}))])
    response = InterventionService(provider).generate_intervention(request(mode, context))
    assert response.action == "provoke" and response.source == mode and response.lock_id
    assert response.anchor.model_dump(by_alias=True) == {"type": "pos", "from": 180}


@pytest.mark.parametrize(
    "model,base_url",
    [
        ("gpt-4o-mini", "https://api.openai.com/v1"),
        ("gpt-6.1-sol-2026-09-29", "https://api.openai.com/v1"),
        ("gpt-6.1-sol", "https://proxy.invalid/v1"),
        ("gpt-6.1-sol", "https://api.openai.com/v1/proxy"),
        ("gpt-6.1-sol", "http://api.openai.com/v1"),
    ],
)
def test_non_target_paths_keep_instructor_tools_and_temperature(
    make_provider: Callable[..., Any],
    model: str,
    base_url: str,
) -> None:
    payload = completion(
        None,
        tool_calls=[
            {
                "id": "synthetic-tool",
                "type": "function",
                "function": {
                    "name": "LLMInterventionDraft",
                    "arguments": '{"action":"delete","content":null}',
                },
            }
        ],
    )
    provider, wire = make_provider([payload], model=model, base_url=base_url)
    response = InterventionService(provider).generate_intervention(request())
    assert response.action == "delete" and len(wire.records) == 1
    body = wire.records[0]["request"]
    assert body["model"] == model and body["temperature"] == 0.9
    assert "tools" in body and "tool_choice" in body and "response_format" not in body


def upstream_error(status: int) -> httpx2.Response:
    return httpx2.Response(
        status,
        json={
            "error": {
                "message": "Synthetic upstream failure",
                "type": "insufficient_quota" if status == 429 else "synthetic_error",
                "code": "insufficient_quota" if status == 429 else "synthetic_error",
            }
        },
    )


@pytest.mark.parametrize("upstream_status", [200, 401])
async def test_sol_retirement_close_failure_preserves_http_outcome(
    make_provider: Callable[..., Any],
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
    upstream_status: int,
) -> None:
    loop = asyncio.get_running_loop()
    started = asyncio.Event()
    release = Event()

    def blocked_reply() -> httpx2.Response:
        loop.call_soon_threadsafe(started.set)
        assert release.wait(5)
        if upstream_status != 200:
            return upstream_error(upstream_status)
        return httpx2.Response(200, json=completion('{"action":"delete","content":null}'))

    _, wire = make_provider([blocked_reply], factory_only=True)
    wire.close_error = RuntimeError("Synthetic transport close failure")
    app, registry = route_app(monkeypatch)
    headers = {"Idempotency-Key": str(uuid4()), "X-Contract-Version": "2.0.0"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        task = asyncio.create_task(
            client.post(
                "/impetus/generate-intervention", headers=headers, json=request().model_dump()
            )
        )
        try:
            await asyncio.wait_for(started.wait(), 5)
            registry.reload()
            assert wire.closed == 0
            release.set()
            response = await asyncio.wait_for(task, 5)
            assert response.status_code == upstream_status
            if upstream_status == 401:
                assert response.json()["code"] == "invalid_api_key"
            else:
                assert response.json()["action"] == "delete"
            assert wire.closed == 1
            assert "Failed to close OpenAI Sol client" in caplog.text
        finally:
            release.set()
            await asyncio.gather(task, return_exceptions=True)


@pytest.mark.parametrize(
    "status,code,public_status,attempts",
    [
        (401, "invalid_api_key", 401, 1),
        (429, "quota_exceeded", 402, 3),
        (400, "llm_api_error", 502, 1),
        (403, "llm_api_error", 502, 1),
        (500, "llm_api_error", 502, 3),
        (503, "llm_api_error", 502, 3),
    ],
)
def test_sol_actual_sdk_typed_errors(
    make_provider: Callable[..., Any], status: int, code: str, public_status: int, attempts: int
) -> None:
    provider, wire = make_provider([upstream_error(status)])
    with pytest.raises(LLMProviderError) as error:
        InterventionService(provider).generate_intervention(request())
    assert (error.value.code, error.value.status_code) == (code, public_status)
    assert len(wire.records) == attempts


@pytest.mark.parametrize("error_class", [httpx2.ConnectError, httpx2.ReadTimeout])
def test_sol_actual_sdk_transport_error_stays_502(
    make_provider: Callable[..., Any], error_class: type[Exception]
) -> None:
    def fail() -> httpx2.Response:
        raise error_class("Synthetic network failure")

    provider, wire = make_provider([fail])
    with pytest.raises(LLMProviderError) as error:
        InterventionService(provider).generate_intervention(request())
    assert (error.value.code, error.value.status_code) == ("llm_api_error", 502)
    assert len(wire.records) == 3


def route_app(monkeypatch: pytest.MonkeyPatch) -> tuple[FastAPI, ProviderRegistry]:
    monkeypatch.setenv("OPENAI_API_KEY", "offline-dummy")
    monkeypatch.setenv("OPENAI_MODEL", MODEL)
    monkeypatch.setenv("LLM_DEFAULT_PROVIDER", "openai")
    for name in ("ANTHROPIC_API_KEY", "GEMINI_API_KEY"):
        monkeypatch.delenv(name, raising=False)
    registry = ProviderRegistry()
    app = FastAPI()
    app.state.provider_registry = registry
    app.include_router(intervention.router)
    app.dependency_overrides[get_session_optional] = lambda: None
    app.dependency_overrides[intervention.get_intervention_service] = lambda: InterventionService()
    return app, registry


@pytest.mark.parametrize("ownership", ["byok", "model-only", "shared"])
async def test_sol_http_success_cache_and_provider_ownership(
    make_provider: Callable[..., Any], monkeypatch: pytest.MonkeyPatch, ownership: str
) -> None:
    _, wire = make_provider(
        [completion('{"action":"rewrite","content":"Replacement."}')], factory_only=True
    )
    app, registry = route_app(monkeypatch)
    headers = {"Idempotency-Key": str(uuid4()), "X-Contract-Version": "2.0.0"}
    if ownership != "shared":
        headers["X-LLM-Model"] = MODEL
    if ownership == "byok":
        headers["X-LLM-Api-Key"] = "offline-byok-dummy"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        first = await client.post(
            "/impetus/generate-intervention", headers=headers, json=request().model_dump()
        )
        retry = await client.post(
            "/impetus/generate-intervention",
            headers={**headers, "X-LLM-Provider": "unsupported-retry"},
            json=request("muse", "Changed retry.").model_dump(),
        )
    assert first.status_code == retry.status_code == 200
    assert first.json() == retry.json()
    assert first.headers["X-Contract-Version"] == "2.0.0"
    assert first.json()["anchor"] == {"type": "range", "from": 184, "to": 200}
    assert len(wire.records) == 1 and len(wire.clients) == 1
    assert wire.closed == (0 if ownership == "shared" else 1)
    if ownership == "shared":
        provider = registry.get_provider()
        assert registry.is_cached(provider)
        registry.reload()
        assert wire.closed == 1


@pytest.mark.parametrize(
    "kind,status,code,attempts",
    [
        ("auth", 401, "invalid_api_key", 1),
        ("quota", 402, "quota_exceeded", 3),
        ("refusal", 502, "llm_api_error", 1),
        ("structure", 502, "llm_api_error", 4),
        ("null", 422, None, 1),
        ("empty", 422, None, 1),
        ("whitespace", 422, None, 1),
        ("omitted", 422, None, 1),
    ],
)
async def test_sol_http_failure_is_not_cached_and_semantics_keep_422(
    make_provider: Callable[..., Any],
    monkeypatch: pytest.MonkeyPatch,
    kind: str,
    status: int,
    code: str | None,
    attempts: int,
) -> None:
    if kind == "auth":
        failure = upstream_error(401)
    elif kind == "quota":
        failure = upstream_error(429)
    elif kind == "refusal":
        failure = completion('{"action":"provoke","content":"Synthetic text."}', refusal="No")
    elif kind == "structure":
        failure = completion('{"action":"invalid"}')
    else:
        value = {"null": None, "empty": "", "whitespace": "   ", "omitted": None}[kind]
        draft = {"action": "provoke"}
        if kind != "omitted":
            draft["content"] = value
        failure = completion(json.dumps(draft))
    _, wire = make_provider(
        [failure] * attempts + [completion('{"action":"delete","content":null}')], factory_only=True
    )
    app, _ = route_app(monkeypatch)
    headers = {
        "Idempotency-Key": str(uuid4()),
        "X-Contract-Version": "2.0.0",
        "X-LLM-Model": MODEL,
        "X-LLM-Api-Key": "offline-dummy",
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        failed = await client.post(
            "/impetus/generate-intervention", headers=headers, json=request().model_dump()
        )
        assert failed.status_code == status
        if code:
            assert failed.json()["code"] == code
        assert wire.closed == 1
        retried = await client.post(
            "/impetus/generate-intervention", headers=headers, json=request().model_dump()
        )
        cached = await client.post(
            "/impetus/generate-intervention", headers=headers, json=request().model_dump()
        )
    assert retried.status_code == cached.status_code == 200 and retried.json() == cached.json()
    assert len(wire.records) == attempts + 1 and wire.closed == len(wire.clients) == 2


def test_wire_reserves_distinct_replies_before_concurrent_request_parsing() -> None:
    """A blocked first parse cannot make another worker consume the same fixture reply."""
    entered, released, second_started, second_finished = Event(), Event(), Event(), Event()

    class BlockedRequest(httpx2.Request):
        @property
        def content(self) -> bytes:
            entered.set()
            assert released.wait(5)
            return super().content

    wire = Wire([{"reply": "first"}, {"reply": "second"}])
    first_request = BlockedRequest("POST", "https://fixture.invalid", content=b"{}")
    second_request = httpx2.Request("POST", "https://fixture.invalid", content=b"{}")

    def second() -> httpx2.Response:
        second_started.set()
        try:
            return wire.handle(second_request)
        finally:
            second_finished.set()

    with ThreadPoolExecutor(max_workers=2) as executor:
        first = executor.submit(wire.handle, first_request)
        try:
            assert entered.wait(2)
            other = executor.submit(second)
            assert second_started.wait(2)
            # The broken fixture finishes the second request while the first parse is held.
            second_finished.wait(0.2)
        finally:
            released.set()
        assert first.result(timeout=5).json() == {"reply": "first"}
        assert other.result(timeout=5).json() == {"reply": "second"}
