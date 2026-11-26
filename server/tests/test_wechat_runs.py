"""Persistence checks for the private WeChat challenge service."""

from asyncio import Event, create_task, gather, wait_for
from collections.abc import AsyncIterator, Awaitable, Callable
from pathlib import Path
from time import time
from typing import Any

import pytest
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from server.domain.errors import AppError, LLMProviderError
from server.infrastructure.persistence import wechat_runs
from server.infrastructure.persistence.models import Base
from server.infrastructure.persistence.wechat_runs import (
    act,
    action_receipt,
    get_progress,
    get_run,
    start_run,
)
from server.infrastructure.persistence.wechat_works import (
    freeze_work,
    get_work,
    publish_card,
    write_mode,
)
from server.models.wechat_works import WechatCardModel

Document = dict[str, Any]


@pytest.fixture
async def sessions(tmp_path: Path) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    """Create a fresh database while allowing separate API sessions to race."""
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'wechat.sqlite'}")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    try:
        yield async_sessionmaker(engine, expire_on_commit=False)
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_first_run_retries_across_sessions_and_is_private(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    payload = {"request_id": "start", "theme": "letter", "mode": "normal"}
    async with sessions() as db:
        run = await start_run(db, "author", payload)
    assert run["opening"]
    assert run["segments"][0]["text"] == run["opening"]
    assert len(run["choices"]) >= 2
    assert run["turns"] == 0
    assert run["status"] == "active"
    async with sessions() as db:
        assert await start_run(db, "author", payload) == run
        with pytest.raises(AppError) as error:
            await get_run(db, "friend", run["id"])
        assert error.value.status_code == 404
    async with sessions() as db:
        friend = await start_run(db, "friend", payload)
    assert friend["id"] != run["id"]


async def _start(sessions: async_sessionmaker[AsyncSession], **changes: Any) -> Document:
    payload = {"request_id": "start", "theme": "letter", "mode": "normal", **changes}
    async with sessions() as db:
        return await start_run(db, "author", payload)


async def _no_correction(text: str, style: str) -> str:
    raise AssertionError(f"Unexpected voice correction ({style})")


async def _passage(state: Document, source: str, text: str) -> Document:
    return {
        "paragraph": "我从窗台拿下一只杯子。" if source == "choice" else "",
        "choices": ["翻看日历", "把杯子挪开"],
        "lock_sentence": "杯底刻着去年的日期。",
    }


async def _action(
    sessions: async_sessionmaker[AsyncSession],
    run: Document,
    request_id: str,
    kind: str,
    *,
    generate: Callable[[Document, str, str], Awaitable[Document]] = _passage,
    correct: Callable[[str, str], Awaitable[str]] = _no_correction,
    **fields: Any,
) -> Document:
    async with sessions() as db:
        return await act(
            db,
            "author",
            run["id"],
            {"request_id": request_id, "kind": kind, "version": run["version"], **fields},
            generate_turn=generate,
            correct_voice=correct,
        )


@pytest.mark.asyncio
async def test_edited_opening_is_not_the_replay_prompt(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    started = await _start(sessions, opening="这是我改过的第一句话。")
    assert started["opening"] == "十年后，你收到一封自己寄出的信"
    assert started["segments"][0]["text"] == "这是我改过的第一句话。"
    assert started["turns"] == 0
    assert not any(segment["locked"] for segment in started["segments"])


@pytest.mark.asyncio
async def test_same_pending_action_is_not_generated_twice_and_cancel_discards_late_result(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    run = await _start(sessions)
    in_provider = Event()
    release_provider = Event()
    provider_calls = 0

    async def delayed(state: Document, source: str, text: str) -> Document:
        nonlocal provider_calls
        provider_calls += 1
        in_provider.set()
        await release_provider.wait()
        return await _passage(state, source, text)

    inputs = {"source": "choice", "text": run["choices"][0], "generate": delayed}
    pending = create_task(_action(sessions, run, "chosen", "turn", **inputs))
    try:
        await wait_for(in_provider.wait(), 5)
        with pytest.raises(AppError) as duplicate:
            await wait_for(_action(sessions, run, "chosen", "turn", **inputs), 5)
        assert duplicate.value.code == "STORY_REQUEST_PENDING"
        canceled = await wait_for(_action(sessions, run, "cancel", "cancel", target="chosen"), 5)
    finally:
        release_provider.set()
    assert await wait_for(pending, 5) == canceled
    assert canceled["turns"] == 0
    assert canceled["segments"] == run["segments"]
    assert await _action(sessions, run, "chosen", "turn", **inputs) == canceled
    assert provider_calls == 1
    async with sessions() as db:
        assert await action_receipt(db, "author", run["id"], "chosen") == {
            "status": "canceled",
            "run_version": canceled["version"],
        }


@pytest.mark.asyncio
async def test_distinct_turns_against_same_version_cannot_both_commit(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    run = await _start(sessions)
    both_in_provider = Event()
    count = 0

    async def delayed(state: Document, source: str, text: str) -> Document:
        nonlocal count
        count += 1
        if count == 2:
            both_in_provider.set()
        await both_in_provider.wait()
        return await _passage(state, source, text)

    first, second = await wait_for(
        gather(
            _action(
                sessions, run, "left", "turn", source="keyboard", text="我走了。", generate=delayed
            ),
            _action(
                sessions, run, "right", "turn", source="keyboard", text="我留下。", generate=delayed
            ),
            return_exceptions=True,
        ),
        5,
    )
    conflicts = [result for result in (first, second) if isinstance(result, AppError)]
    assert [error.status_code for error in conflicts] == [409]
    async with sessions() as db:
        current = await get_run(db, "author", run["id"])
    assert current["turns"] == 1
    assert len([segment for segment in current["segments"] if segment["source"] == "keyboard"]) == 1


@pytest.mark.asyncio
async def test_expired_generation_is_retryable_without_duplicate_input(
    sessions: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> None:
    run = await _start(sessions)
    entered, release = Event(), Event()

    async def abandoned(state: Document, source: str, text: str) -> Document:
        entered.set()
        await release.wait()
        return {"paragraph": "不会写入原候选。", "choices": ["睡觉", "起来"]}

    inputs = {"source": "choice", "text": run["choices"][0]}
    original = create_task(_action(sessions, run, "choice", "turn", generate=abandoned, **inputs))
    try:
        await wait_for(entered.wait(), 5)
        after_expiry = time() + 3_600
        monkeypatch.setattr(wechat_runs, "time", lambda: after_expiry)
        async with sessions() as db:
            receipt = await action_receipt(db, "author", run["id"], "choice")
        assert receipt == {"status": "unknown", "run_version": run["version"]}
        retried = await _action(sessions, run, "choice", "turn", **inputs)
    finally:
        release.set()
        late = await wait_for(original, 5)
    assert late == retried
    assert retried["turns"] == 1
    assert "不会写入原候选。" not in repr(retried)


@pytest.mark.asyncio
async def test_finish_requires_explicitly_discarding_an_in_flight_turn(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    run = await _start(sessions)
    in_provider = Event()
    release_provider = Event()

    async def delayed(state: Document, source: str, text: str) -> Document:
        in_provider.set()
        await release_provider.wait()
        return await _passage(state, source, text)

    pending = create_task(
        _action(
            sessions,
            run,
            "chosen",
            "turn",
            source="choice",
            text=run["choices"][0],
            generate=delayed,
        )
    )
    try:
        await wait_for(in_provider.wait(), 5)
        with pytest.raises(AppError) as direct:
            await _action(sessions, run, "finish", "finish")
        assert direct.value.code == "STORY_FINISH_INPUT_PENDING"
        assert direct.value.details == {"request_ids": ["chosen"]}
        paused = await _action(sessions, run, "pause", "begin_finish")
        assert paused["finishing"]
        with pytest.raises(AppError) as unresolved:
            await _action(sessions, paused, "finish", "finish")
        assert unresolved.value.code == "STORY_FINISH_INPUT_PENDING"
        async with sessions() as db:
            assert await action_receipt(db, "author", run["id"], "chosen") == {
                "status": "pending",
                "run_version": paused["version"],
            }
        discarded = await _action(sessions, paused, "discard", "cancel", target="chosen")
        finished = await _action(sessions, discarded, "finish", "finish")
    finally:
        release_provider.set()
        late = await wait_for(pending, 5)
    assert late == finished
    assert await _action(sessions, run, "finish", "finish") == finished
    assert finished["status"] == "finished"
    assert finished["turns"] == 0
    async with sessions() as db:
        assert (await get_work(db, "author", finished["work_id"]))["text"] == run["opening"]
        assert (await get_progress(db, "author"))["completed"] == 0
        assert await action_receipt(db, "author", run["id"], "chosen") == {
            "status": "canceled",
            "run_version": finished["version"],
        }


@pytest.mark.asyncio
async def test_finish_cannot_discard_an_author_input_with_unknown_outcome(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    run = await _start(sessions)

    async def unavailable(text: str, style: str) -> str:
        raise LLMProviderError(code="TEST_OUTAGE", message="暂时无法整理", status_code=502)

    original = "我把信放回口袋，然后出门。"
    with pytest.raises(LLMProviderError):
        await _action(
            sessions, run, "speech", "turn", source="voice", text=original, correct=unavailable
        )
    async with sessions() as db:
        assert await action_receipt(db, "author", run["id"], "speech") == {
            "status": "unknown",
            "run_version": run["version"],
        }
    paused = await _action(sessions, run, "pause", "begin_finish")
    with pytest.raises(AppError) as unresolved:
        await _action(sessions, paused, "finish", "finish")
    assert unresolved.value.code == "STORY_FINISH_INPUT_PENDING"
    assert unresolved.value.details == {"request_ids": ["speech"]}
    kept = await _action(
        sessions,
        paused,
        "speech",
        "turn",
        source="voice",
        style="verbatim",
        text=original,
        retain=True,
    )
    finished = await _action(sessions, kept, "finish", "finish")
    async with sessions() as db:
        assert (await get_work(db, "author", finished["work_id"]))["text"].count(original) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("record_instead", [False, True])
async def test_active_deferred_intervention_can_yield_to_finishing_or_recording(
    sessions: async_sessionmaker[AsyncSession], record_instead: bool
) -> None:
    run = await _start(sessions)
    spoken = "我点燃了信，盯着它变成灰。"

    async def missing(state: Document, source: str, text: str) -> Document:
        raise LLMProviderError(code="TEST_OUTAGE", message="暂时无法生成干预", status_code=502)

    written = await _action(
        sessions,
        run,
        "first-voice",
        "turn",
        source="voice",
        style="verbatim",
        text=spoken,
        generate=missing,
    )
    assert written["pending_intervention"]
    entered, release = Event(), Event()
    old_lock = "一盏灯忽然熄灭了。"

    async def delayed(state: Document, source: str, text: str) -> Document:
        entered.set()
        await release.wait()
        assert state["deferred_generation"] is True
        assert (source, text) == ("voice", spoken)
        return {"choices": ["走进屋里", "关上门"], "lock_sentence": old_lock}

    background = create_task(
        _action(sessions, written, "background", "intervene", generate=delayed)
    )
    try:
        await wait_for(entered.wait(), 5)
        async with sessions() as db:
            assert await action_receipt(db, "author", run["id"], "background") == {
                "status": "pending",
                "run_version": written["version"],
            }
        if record_instead:
            canceled = await _action(
                sessions, written, "prioritize-voice", "cancel", target="background"
            )
            async with sessions() as db:
                assert await action_receipt(db, "author", run["id"], "background") == {
                    "status": "canceled",
                    "run_version": canceled["version"],
                }
            updated = await _action(
                sessions,
                canceled,
                "second-voice",
                "turn",
                source="voice",
                style="verbatim",
                text="我把余灰扫进簸箕。",
            )
            assert updated["turns"] == 2
            assert updated["segments"][-1]["locked"]
        else:
            updated = await _action(sessions, written, "finish", "finish")
            assert updated["status"] == "finished"
    finally:
        release.set()
        late = await wait_for(background, 5)
    assert late == updated
    assert old_lock not in repr(updated)
    async with sessions() as db:
        assert await action_receipt(db, "author", run["id"], "background") == {
            "status": "canceled",
            "run_version": updated["version"],
        }


@pytest.mark.asyncio
async def test_actual_continuation_opens_detective_and_high_after_finishing(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    with pytest.raises(AppError) as forbidden:
        await _start(sessions, mode="high")
    assert forbidden.value.status_code == 403
    with pytest.raises(AppError) as forbidden:
        await _start(sessions, theme="detective")
    assert forbidden.value.status_code == 403

    run = await _start(sessions)
    written = await _action(
        sessions, run, "first", "turn", source="keyboard", text="我提起手中的信。"
    )
    assert (
        await _action(sessions, run, "first", "turn", source="keyboard", text="我提起手中的信。")
        == written
    )
    await _action(sessions, written, "finish", "finish")
    async with sessions() as db:
        assert await get_progress(db, "author") == {
            "completed": 1,
            "detective": True,
            "high": True,
            "rewrite": False,
            "delete": False,
        }
    with pytest.raises(AppError) as missing_consent:
        await _start(sessions, request_id="next", theme="detective", mode="high")
    assert missing_consent.value.code == "STORY_HIGH_CONSENT_REQUIRED"
    detective = await _start(
        sessions, request_id="next", theme="detective", mode="high", accept_high=True
    )
    assert detective["theme"] == "detective"
    assert detective["mode"] == "high"
    assert await _start(sessions, request_id="next", theme="detective", mode="high") == detective


@pytest.mark.asyncio
async def test_outage_preserves_own_text_and_retries_only_the_missing_generation(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    run = await _start(sessions)

    async def unavailable(state: Document, source: str, text: str) -> Document:
        raise LLMProviderError(code="TEST_OUTAGE", message="暂时无法成文", status_code=502)

    with pytest.raises(LLMProviderError):
        await _action(
            sessions,
            run,
            "choice",
            "turn",
            source="choice",
            text=run["choices"][0],
            generate=unavailable,
        )
    author_text = "我拿起信，走到窗边。"
    written = await _action(
        sessions, run, "own", "turn", source="keyboard", text=author_text, generate=unavailable
    )
    assert written["turns"] == 1
    assert written["generation_pending"]
    assert written["segments"][-1]["text"] == author_text
    assert not any(segment["locked"] for segment in written["segments"])

    retried = await _action(sessions, written, "recover-generation", "intervene")
    assert retried["turns"] == 1
    assert retried["segments"][-2]["text"] == author_text
    assert retried["segments"][-1]["locked"]
    assert retried["choices"]
    assert not retried["generation_pending"]


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ["restyle", "edit"])
async def test_voice_restyle_commits_the_reviewed_candidate_without_generating_again(
    sessions: async_sessionmaker[AsyncSession],
    kind: str,
) -> None:
    run = await _start(sessions)
    original = "呃，我拿起了信。"
    confirmed = "我拿起了那封信。"
    written = await _action(
        sessions, run, "voice", "turn", source="voice", text=original, style="verbatim"
    )
    voice = next(segment for segment in written["segments"] if segment["source"] == "voice")
    restyled = await _action(
        sessions, written, "restyle", kind, target=voice["id"], text=confirmed, style="polish"
    )
    updated = next(segment for segment in restyled["segments"] if segment["id"] == voice["id"])
    assert updated["text"] == confirmed
    assert updated["original"] == original
    assert updated["ai_generated"]
    assert restyled["turns"] == written["turns"]


@pytest.mark.asyncio
async def test_permanent_deletion_never_replays_transcript_or_deleted_passage(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    async with sessions.begin() as db:
        mode = await write_mode(
            db,
            "author",
            "干预试局",
            {
                "action": "delete",
                "trigger": "manual",
                "lock": False,
                "recoverable": False,
            },
        )
    with pytest.raises(AppError) as forbidden:
        await _start(sessions, mode="custom", mode_id=mode["id"])
    assert forbidden.value.code == "STORY_CONSENT_REQUIRED"

    run = await _start(sessions, mode="custom", mode_id=mode["id"], accept_irreversible=True)
    original, edited = "壁炉下藏着白玫瑰", "壁炉下的白花是玫瑰。"

    async def corrected(text: str, style: str) -> str:
        return edited

    fields: Document = {"source": "voice", "text": original, "correct": corrected}
    written = await _action(sessions, run, "voice", "turn", **fields)
    target = next(segment["id"] for segment in written["segments"] if segment["source"] == "voice")
    assert original in repr(written) and edited in repr(written)
    deleted = await _action(sessions, written, "remove", "intervene", target=target)
    assert original not in repr(deleted) and edited not in repr(deleted)
    assert await _action(sessions, run, "voice", "turn", **fields) == deleted
    assert deleted["generation_pending"]
    with pytest.raises(AppError) as missing:
        await _action(sessions, deleted, "restore", "restore", target=target)
    assert missing.value.status_code == 422

    async def refreshed(state: Document, source: str, text: str) -> Document:
        assert state["deferred_generation"] and not source and not text
        assert original not in repr(state) and edited not in repr(state)
        return {"choices": ["查看窗台", "关门离开"]}

    regenerated = await _action(sessions, deleted, "refresh", "intervene", generate=refreshed)
    assert regenerated["choices"] == ["查看窗台", "关门离开"]
    finished = await _action(sessions, regenerated, "finish", "finish")
    async with sessions() as db:
        work = await get_work(db, "author", finished["work_id"])
        assert work["text"] == run["opening"]


@pytest.mark.asyncio
async def test_concurrent_finish_counts_each_run_and_each_milestone_once(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    async def two_responses(run: Document) -> Document:
        for index, sentence in enumerate(("我伸出手", "我推开门", "我跨过门槛", "我听到人声")):

            async def generate(
                state: Document, source: str, text: str, index: int = index
            ) -> Document:
                return {
                    "choices": ["走近", "离开"],
                    "lock_sentence": f"门上写着第{index + 1}个字。",
                }

            run = await _action(
                sessions,
                run,
                f"turn-{index}",
                "turn",
                source="keyboard",
                text=sentence,
                generate=generate,
            )
        assert run["responses"] == 2
        return run

    first = await two_responses(await _start(sessions, request_id="one"))
    second = await two_responses(await _start(sessions, request_id="two"))
    await gather(
        _action(sessions, first, "finish", "finish"),
        _action(sessions, second, "finish", "finish"),
    )
    async with sessions() as db:
        assert await get_progress(db, "author") == {
            "completed": 2,
            "detective": True,
            "high": True,
            "rewrite": True,
            "delete": False,
        }
    third = await two_responses(await _start(sessions, request_id="three"))
    await _action(sessions, third, "finish", "finish")
    async with sessions() as db:
        assert await get_progress(db, "author") == {
            "completed": 3,
            "detective": True,
            "high": True,
            "rewrite": True,
            "delete": True,
        }


@pytest.mark.asyncio
async def test_pause_keeps_authored_turn_at_most_once_without_late_automatic_effects(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    run = await _start(sessions)
    in_provider = Event()
    release_provider = Event()

    async def delayed(state: Document, source: str, text: str) -> Document:
        in_provider.set()
        await release_provider.wait()
        return await _passage(state, source, text)

    async def unexpected(state: Document, source: str, text: str) -> Document:
        raise AssertionError("Retained keyboard text must not call the model")

    text = "我拿着杯子回了家。"
    pending = create_task(
        _action(sessions, run, "in-flight", "turn", source="keyboard", text=text, generate=delayed)
    )
    try:
        await wait_for(in_provider.wait(), 5)
        async with sessions() as db:
            assert await action_receipt(db, "author", run["id"], "absent") == {
                "status": "unknown",
                "run_version": run["version"],
            }
            assert await action_receipt(db, "author", run["id"], "in-flight") == {
                "status": "pending",
                "run_version": run["version"],
            }
        paused = await _action(sessions, run, "pause", "begin_finish")
        assert paused["status"] == "active" and paused["finishing"]
        assert await _action(sessions, run, "pause", "begin_finish") == paused
        async with sessions() as db:
            assert await get_run(db, "author", run["id"]) == paused
        with pytest.raises(AppError):
            await _action(
                sessions,
                paused,
                "unapproved",
                "turn",
                source="keyboard",
                text=text,
                generate=unexpected,
            )
        kept = await _action(
            sessions,
            paused,
            "in-flight",
            "turn",
            source="keyboard",
            text=text,
            retain=True,
            generate=unexpected,
        )
    finally:
        release_provider.set()
        late_result = await wait_for(pending, 5)
    assert late_result == kept
    assert kept["finishing"] and kept["turns"] == 1
    assert kept["segments"][-1]["text"] == text
    assert not any(segment["locked"] for segment in kept["segments"])
    assert kept["offers"] == []
    async with sessions() as db:
        assert await action_receipt(db, "author", run["id"], "in-flight") == {
            "status": "committed",
            "run_version": kept["version"],
        }
        with pytest.raises(AppError) as hidden:
            await action_receipt(db, "other", run["id"], "in-flight")
        assert hidden.value.status_code == 404
    resumed = await _action(sessions, kept, "resume", "resume")
    assert resumed["status"] == "active" and not resumed["finishing"]
    assert await _action(sessions, kept, "resume", "resume") == resumed
    next_turn = await _action(
        sessions, resumed, "next", "turn", source="keyboard", text="我把杯子放在桌上。"
    )
    assert next_turn["turns"] == 2
    assert any(segment["locked"] for segment in next_turn["segments"])
    next_pause = await _action(sessions, next_turn, "pause-again", "begin_finish")
    already_committed = await _action(
        sessions,
        next_pause,
        "next",
        "turn",
        source="keyboard",
        text="我把杯子放在桌上。",
        retain=True,
    )
    assert already_committed == next_pause


@pytest.mark.asyncio
async def test_pausing_invalidates_in_flight_automatic_deletion(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    async with sessions.begin() as db:
        mode = await write_mode(
            db,
            "author",
            "自动删除试局",
            {
                "action": "delete",
                "trigger": "automatic",
                "lock": False,
                "recoverable": False,
            },
        )
    run = await _start(sessions, mode="custom", mode_id=mode["id"], accept_irreversible=True)
    authored = "窗上的裂纹绕过了那道划痕。"
    written = await _action(sessions, run, "author", "turn", source="keyboard", text=authored)
    target = next(
        segment["id"] for segment in written["segments"] if segment["source"] == "keyboard"
    )
    assert written["pending_intervention"]
    in_provider = Event()
    release_provider = Event()

    async def delayed(state: Document, source: str, text: str) -> Document:
        in_provider.set()
        await release_provider.wait()
        return {"choices": ["看窗台", "开门"], "intervention": {"target": target}}

    pending = create_task(_action(sessions, written, "automatic", "intervene", generate=delayed))
    try:
        await wait_for(in_provider.wait(), 5)
        paused = await _action(sessions, written, "pause", "begin_finish")
    finally:
        release_provider.set()
    with pytest.raises(AppError) as conflict:
        await wait_for(pending, 5)
    assert conflict.value.status_code == 409
    async with sessions() as db:
        assert await get_run(db, "author", run["id"]) == paused
    assert any(segment["text"] == authored for segment in paused["segments"])


@pytest.mark.asyncio
@pytest.mark.parametrize("metadata", [{}, {"challenge_id": "letter/v1", "rules_version": 1}])
async def test_high_card_needs_independent_confirmation_and_supports_initial_v1_cards(
    sessions: async_sessionmaker[AsyncSession], metadata: Document
) -> None:
    card = await _publish_snapshot(sessions, {"mode": "high", **metadata})
    payload = {"theme": "letter", "mode": "normal", "card_id": card["id"], "request_id": "friend"}
    async with sessions() as db:
        with pytest.raises(AppError) as missing_consent:
            await start_run(db, "friend", payload)
        assert missing_consent.value.code == "STORY_HIGH_CONSENT_REQUIRED"
        started = await start_run(db, "friend", {**payload, "accept_high": True})
        assert started["mode"] == "high"
        assert started["opening"] == "来自同题卡的原题。"
        assert await start_run(db, "friend", payload) == started


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "metadata", [{"rules_version": 2}, {"challenge_id": "detective/v1", "rules_version": 1}]
)
async def test_card_with_unsupported_rules_or_the_wrong_challenge_cannot_start(
    sessions: async_sessionmaker[AsyncSession], metadata: Document
) -> None:
    card = await _publish_snapshot(sessions, metadata)
    with pytest.raises(AppError) as failure:
        await _start(sessions, card_id=card["id"])
    assert failure.value.code == "STORY_CHALLENGE_UNAVAILABLE"


async def _publish_snapshot(
    sessions: async_sessionmaker[AsyncSession], metadata: Document
) -> Document:
    initial = {
        "theme": "letter",
        "mode": "normal",
        "opening": "来自同题卡的原题。",
        "rules": {},
        **metadata,
    }
    state = {"segments": [{"source": "keyboard", "text": "可以分享的正文。"}]}

    async def clean(subject: str, text: str) -> None:
        return None

    async with sessions() as db, db.begin():
        work_id = await freeze_work(db, "author", "source-challenge", state, initial)
    assert work_id
    async with sessions() as db:
        async with db.begin():
            work = await get_work(db, "author", work_id)
        card = await publish_card(
            db,
            "author",
            work_id,
            {"version": work["version"], "request_id": "share"},
            check_public_text=clean,
        )
        if "challenge_id" not in metadata and "rules_version" not in metadata:
            # Reproduce a stored card created before version metadata was explicit.
            async with db.begin():
                await db.execute(
                    update(WechatCardModel)
                    .where(WechatCardModel.id == card["id"])
                    .values(initial=initial)
                )
        return card
