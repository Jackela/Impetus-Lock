"""Regressions for async intervention responsiveness at the LLM boundary."""

import asyncio
from datetime import UTC, datetime
from threading import Event
from unittest.mock import Mock

import pytest

from server.application.services.intervention_service import InterventionService
from server.domain.llm_provider import LLMProvider
from server.domain.models.anchor import AnchorPos
from server.domain.models.intervention import ClientMeta, InterventionRequest, InterventionResponse


@pytest.fixture(scope="session", autouse=True)
def initialize_test_database() -> None:
    """Skip database bootstrap for this repository-free public service test."""


@pytest.mark.asyncio
async def test_async_generation_allows_heartbeat_while_provider_is_blocked() -> None:
    """Concurrent async work must release a blocked provider before it finishes."""
    loop = asyncio.get_running_loop()
    provider_started = asyncio.Event()
    release_provider = Event()
    provider_finished = Event()
    heartbeat_ran_while_blocked = False
    expected = InterventionResponse(
        action="provoke",
        content="The door opened onto an unfamiliar street.",
        lock_id="lock_r08_responsiveness",
        anchor=AnchorPos(from_=16),
        action_id="act_r08_responsiveness",
        issued_at=datetime.now(UTC),
        source="muse",
    )

    def blocking_generation(**_: object) -> InterventionResponse:
        loop.call_soon_threadsafe(provider_started.set)
        try:
            # Deadlock escape only: success depends on event ordering, not duration.
            release_provider.wait(timeout=10)
            return expected
        finally:
            provider_finished.set()

    async def heartbeat() -> None:
        nonlocal heartbeat_ran_while_blocked
        await provider_started.wait()
        # Also require a suspended async operation to resume while generation waits.
        await asyncio.sleep(0)
        heartbeat_ran_while_blocked = not provider_finished.is_set()
        release_provider.set()

    provider = Mock(spec=LLMProvider)
    provider.generate_intervention.side_effect = blocking_generation
    service = InterventionService(llm_provider=provider)
    request = InterventionRequest(
        context="The door opened.",
        mode="muse",
        client_meta=ClientMeta(doc_version=1, selection_from=16, selection_to=16),
    )
    generation = asyncio.create_task(service.generate_intervention_async(request))
    heartbeat_task = asyncio.create_task(heartbeat())
    try:
        response, _ = await asyncio.wait_for(asyncio.gather(generation, heartbeat_task), timeout=20)
    finally:
        release_provider.set()
        for task in (generation, heartbeat_task):
            if not task.done():
                task.cancel()
        await asyncio.gather(generation, heartbeat_task, return_exceptions=True)

    assert heartbeat_ran_while_blocked, (
        "Event-loop heartbeat and suspended async work ran only after the synchronous "
        "provider finished; async intervention generation blocked the event loop"
    )
    assert response.content == "The door opened onto an unfamiliar street."


@pytest.mark.asyncio
@pytest.mark.parametrize("provider_fails", [False, True])
async def test_cancellation_keeps_provider_open_until_generation_finishes(
    provider_fails: bool,
) -> None:
    """Caller cleanup must wait for the provider, even after repeated cancellation."""
    loop = asyncio.get_running_loop()
    provider_started = asyncio.Event()
    release_provider = Event()
    provider_finished = Event()
    provider_closed = Event()
    closed_while_in_use = False
    expected = InterventionResponse(
        action="provoke",
        content="The door opened onto an unfamiliar street.",
        lock_id="lock_r08_cancellation",
        anchor=AnchorPos(from_=16),
        action_id="act_r08_cancellation",
        issued_at=datetime.now(UTC),
        source="muse",
    )

    def blocking_generation(**_: object) -> InterventionResponse:
        loop.call_soon_threadsafe(provider_started.set)
        try:
            release_provider.wait(timeout=10)
            if provider_fails:
                raise RuntimeError("Provider failed after cancellation")
            return expected
        finally:
            provider_finished.set()

    def close_provider() -> None:
        nonlocal closed_while_in_use
        closed_while_in_use = not provider_finished.is_set()
        provider_closed.set()

    default_provider = Mock(spec=LLMProvider)
    override = Mock(spec=LLMProvider)
    override.generate_intervention.side_effect = blocking_generation
    override.close = close_provider
    service = InterventionService(llm_provider=default_provider)
    request = InterventionRequest(
        context="The door opened.",
        mode="muse",
        client_meta=ClientMeta(doc_version=1, selection_from=16, selection_to=16),
    )

    async def request_with_cleanup() -> InterventionResponse:
        try:
            return await service.generate_intervention_async(request, llm_override=override)
        finally:
            # The API owns request-local providers and closes them on exit.
            override.close()

    generation = asyncio.create_task(request_with_cleanup())
    try:
        await asyncio.wait_for(provider_started.wait(), timeout=10)
        for _ in range(2):
            generation.cancel()
            # Yield through a loop barrier so cancellation is delivered first.
            barrier = asyncio.Event()
            loop.call_soon(barrier.set)
            await barrier.wait()
            assert not provider_closed.is_set(), "Caller closed provider while worker used it"
            assert not generation.done(), "Cancellation returned before provider finished"

        release_provider.set()
        with pytest.raises(asyncio.CancelledError):
            await asyncio.wait_for(generation, timeout=10)
        assert provider_closed.is_set()
        assert not closed_while_in_use
        default_provider.generate_intervention.assert_not_called()
    finally:
        release_provider.set()
        await asyncio.gather(generation, return_exceptions=True)
        assert await asyncio.to_thread(provider_finished.wait, 10), "Provider did not finish"
