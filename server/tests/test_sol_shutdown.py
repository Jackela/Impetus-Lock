"""Actual app lifecycle contracts for cached official Sol client ownership."""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from threading import Event
from typing import Any
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import httpx2
import pytest
from fastapi import FastAPI

from server.api import main
from server.api.routes.collaboration import collab_service
from server.application.services.intervention_service import InterventionService
from server.domain.errors import LLMProviderError
from server.infrastructure.llm.provider_registry import ProviderRegistry
from tests.test_instructor_provider_contract import (
    MODEL,
    completion,
    request,
)
from tests.test_instructor_provider_contract import (
    make_provider as make_provider,
)


@pytest.fixture(scope="session", autouse=True)
def initialize_test_database() -> None:
    """Stub external database/collaboration work in these lifecycle contracts."""


@pytest.fixture
def lifecycle(monkeypatch: pytest.MonkeyPatch) -> FastAPI:
    monkeypatch.setenv("OPENAI_API_KEY", "offline-dummy")
    monkeypatch.setenv("OPENAI_MODEL", MODEL)
    monkeypatch.setenv("LLM_DEFAULT_PROVIDER", "openai")
    monkeypatch.setattr(main, "init_database", AsyncMock())
    monkeypatch.setattr(main, "is_database_initialized", lambda: False)
    monkeypatch.setattr(collab_service, "initialize", AsyncMock())
    monkeypatch.setattr(collab_service, "shutdown", AsyncMock())
    return FastAPI()


async def test_actual_lifespan_closes_cached_sol_once_and_restart_gets_fresh_client(
    lifecycle: FastAPI,
    make_provider: Callable[..., Any],
) -> None:
    _, wire = make_provider([completion('{"action":"delete","content":null}')], factory_only=True)
    previous = None
    for run in range(2):
        async with main.lifespan(lifecycle):
            registry = lifecycle.state.provider_registry
            provider = registry.get_provider()
            assert provider is not previous
            response = await InterventionService(provider).generate_intervention_async(request())
            assert response.action == "delete" and wire.closed == run
            previous = provider
        assert wire.closed == run + 1 and wire.raw.is_closed()
        registry.close()
        registry.close()
        assert wire.closed == run + 1
    assert len(wire.clients) == 2


async def wait_for(event: Event) -> None:
    assert await asyncio.to_thread(event.wait, 2)


@pytest.mark.parametrize(
    "outcome",
    ["success", "auth", "worker_error", "cancel", "success_close_error", "auth_close_error"],
)
async def test_lifespan_waits_for_last_worker_despite_repeated_shutdown_cancellation(
    lifecycle: FastAPI,
    make_provider: Callable[..., Any],
    outcome: str,
) -> None:
    close_error = outcome.endswith("_close_error")
    outcome = outcome.removesuffix("_close_error")
    entered = [Event(), Event()]
    released = [Event(), Event()]

    def blocked(index: int) -> httpx2.Response:
        entered[index].set()
        assert released[index].wait(3)
        if outcome == "auth":
            return httpx2.Response(
                401, json={"error": {"message": "Synthetic", "type": "invalid_api_key"}}
            )
        if outcome == "worker_error":
            raise RuntimeError("Synthetic worker failure")
        return httpx2.Response(200, json=completion('{"action":"delete","content":null}'))

    _, wire = make_provider([lambda: blocked(0), lambda: blocked(1)], factory_only=True)
    if close_error:
        wire.close_error = RuntimeError("Synthetic deferred transport close failure")
    scope = main.lifespan(lifecycle)
    await scope.__aenter__()
    provider = lifecycle.state.provider_registry.get_provider()
    repository = Mock()
    repository.save_action = AsyncMock()
    service = InterventionService(provider, task_repository=repository)
    workers = [
        asyncio.create_task(service.generate_intervention_async(request(), task_id=uuid4()))
        for _ in range(2)
    ]
    shutdown = None
    try:
        await wait_for(entered[0])
        await wait_for(entered[1])
        if outcome == "cancel":
            for worker in workers:
                worker.cancel()
                worker.cancel()
        shutdown = asyncio.create_task(scope.__aexit__(None, None, None))
        # This is an observable handshake with the real registry/provider cleanup.
        for _ in range(100):
            if provider._sol_closing:
                break
            await asyncio.sleep(0.001)
        assert provider._sol_closing
        for _ in range(2):
            shutdown.cancel()
            await asyncio.sleep(0.001)
            assert not shutdown.done() and wire.closed == 0
        with pytest.raises(LLMProviderError, match="closed"):
            service.generate_intervention(request())
        released[0].set()
        await asyncio.sleep(0.01)
        assert not shutdown.done() and wire.closed == 0
        # Concurrent duplicate owners must join the same last-worker close.
        duplicates = [
            asyncio.create_task(asyncio.to_thread(lifecycle.state.provider_registry.close))
            for _ in range(2)
        ]
        released[1].set()
        results = await asyncio.gather(*workers, return_exceptions=True)
        await asyncio.gather(*duplicates)
        with pytest.raises(asyncio.CancelledError):
            await shutdown
        assert wire.closed == 1 and wire.raw.is_closed()
        assert repository.save_action.await_count == (2 if outcome == "success" else 0)
        if outcome == "success":
            assert all(result.action == "delete" for result in results)
        elif outcome == "cancel":
            assert all(isinstance(result, asyncio.CancelledError) for result in results)
        else:
            assert all(isinstance(result, LLMProviderError) for result in results)
            expected = ("invalid_api_key", 401) if outcome == "auth" else ("llm_api_error", 502)
            assert all((result.code, result.status_code) == expected for result in results)
        collab_service.shutdown.assert_awaited_once()
    finally:
        for event in released:
            event.set()
        await asyncio.gather(*workers, return_exceptions=True)
        if shutdown is not None:
            await asyncio.gather(shutdown, return_exceptions=True)
        else:
            await scope.__aexit__(None, None, None)


@pytest.mark.parametrize("failure", ["body", "database", "collaboration", "transport"])
async def test_shutdown_close_does_not_mask_result_or_existing_cleanup_error(
    lifecycle: FastAPI,
    make_provider: Callable[..., Any],
    monkeypatch: pytest.MonkeyPatch,
    failure: str,
) -> None:
    _, wire = make_provider([completion('{"action":"delete","content":null}')], factory_only=True)
    error = RuntimeError(f"Synthetic {failure} failure")
    if failure == "transport":
        wire.close_error = error
    elif failure == "database":
        monkeypatch.setattr(main, "is_database_initialized", lambda: True)
        monkeypatch.setattr(
            main, "get_db_manager", lambda: Mock(close=AsyncMock(side_effect=error))
        )
    elif failure == "collaboration":
        collab_service.shutdown.side_effect = error

    async def run() -> Any:
        async with main.lifespan(lifecycle):
            provider = lifecycle.state.provider_registry.get_provider()
            response = await InterventionService(provider).generate_intervention_async(request())
            if failure == "body":
                raise error
        return response

    if failure == "transport":
        assert (await run()).action == "delete"
    else:
        with pytest.raises(RuntimeError) as caught:
            await run()
        assert caught.value is error
    assert wire.closed == 1 and wire.raw.is_closed()
    lifecycle.state.provider_registry.close()
    assert wire.closed == 1


@pytest.mark.parametrize(
    "model,base",
    [("gpt-4o-mini", "https://api.openai.com/v1"), (MODEL, "https://proxy.invalid/v1")],
)
async def test_lifespan_preserves_non_target_openai_and_other_provider_ownership(
    lifecycle: FastAPI,
    make_provider: Callable[..., Any],
    monkeypatch: pytest.MonkeyPatch,
    model: str,
    base: str,
) -> None:
    monkeypatch.setenv("OPENAI_MODEL", model)
    _, wire = make_provider([], model=model, base_url=base, factory_only=True)
    other = Mock()
    async with main.lifespan(lifecycle):
        registry = lifecycle.state.provider_registry
        provider = registry.get_provider()
        registry._default_instances["anthropic"] = other
        assert provider._sol_client is None and wire.closed == 0
    assert wire.closed == 0 and not wire.raw.is_closed()
    other.close.assert_not_called()
    other.wait_closed.assert_not_called()


async def test_lifespan_shutdown_does_not_instantiate_an_unused_provider(
    lifecycle: FastAPI,
    make_provider: Callable[..., Any],
) -> None:
    _, wire = make_provider([], factory_only=True)
    async with main.lifespan(lifecycle):
        assert lifecycle.state.provider_registry._default_instances == {}
    assert wire.clients == [] and wire.closed == 0


def test_registry_shutdown_wait_failure_is_contained(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_DEFAULT_PROVIDER", "debug")
    registry = ProviderRegistry()
    provider = Mock(wait_closed=Mock(side_effect=RuntimeError("Synthetic wait failure")))
    registry._default_instances["openai"] = provider
    registry.close()
    provider.close.assert_called_once()
    provider.wait_closed.assert_called_once()


@pytest.mark.parametrize("replacement", [False, True])
async def test_shutdown_joins_sol_worker_retired_by_reload(
    lifecycle: FastAPI,
    make_provider: Callable[..., Any],
    replacement: bool,
) -> None:
    entered, released = Event(), Event()

    def blocked() -> httpx2.Response:
        entered.set()
        assert released.wait(3)
        return httpx2.Response(200, json=completion('{"action":"delete","content":null}'))

    _, wire = make_provider([blocked], factory_only=True)
    scope = main.lifespan(lifecycle)
    await scope.__aenter__()
    registry = lifecycle.state.provider_registry
    worker = asyncio.create_task(
        InterventionService(registry.get_provider()).generate_intervention_async(request())
    )
    shutdown = None
    try:
        await wait_for(entered)
        registry.reload()
        if replacement:
            registry.get_provider()
        shutdown = asyncio.create_task(scope.__aexit__(None, None, None))
        await asyncio.sleep(0.02)
        assert not shutdown.done()
        assert not wire.clients[0].is_closed()
        released.set()
        assert (await worker).action == "delete"
        await shutdown
        assert wire.closed == (2 if replacement else 1)
        assert all(raw.is_closed() for raw in wire.clients)
    finally:
        released.set()
        await asyncio.gather(worker, return_exceptions=True)
        if shutdown is not None:
            await asyncio.gather(shutdown, return_exceptions=True)
        else:
            await scope.__aexit__(None, None, None)


def test_cached_sol_created_after_shutdown_is_closed_before_use(
    make_provider: Callable[..., Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "offline-dummy")
    monkeypatch.setenv("OPENAI_MODEL", MODEL)
    monkeypatch.setenv("LLM_DEFAULT_PROVIDER", "openai")
    _, wire = make_provider([completion('{"action":"delete","content":null}')], factory_only=True)
    registry = ProviderRegistry()
    registry.close()
    provider = registry.get_provider()
    with pytest.raises(LLMProviderError, match="closed"):
        InterventionService(provider).generate_intervention(request())
    assert wire.closed == 1 and wire.records == []
