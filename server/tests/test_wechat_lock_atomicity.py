"""Verify the high-intensity lock opportunity against real PostgreSQL."""

import asyncio
import os
from collections.abc import AsyncIterator
from typing import Any
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.schema import CreateSchema, DropSchema

from server.api.routes import wechat
from server.api.routes.wechat_schemas import Preview
from server.domain.errors import AppError, ConflictError, NotFoundError
from server.infrastructure.persistence.models import Base
from server.infrastructure.persistence.wechat_runs import act, action_receipt, get_run, start_run

Document = dict[str, Any]
Sessions = async_sessionmaker[AsyncSession]
OWNER = "lock-writer"
OTHER = "different-writer"
REPLACEMENT = "第二枚印章落在背面，只有翻过纸才能看见。"


@pytest.fixture(scope="session", autouse=True)
def initialize_test_database() -> None:
    """Use this module's dedicated schema in place of the shared test setup."""


@pytest.fixture
async def lock_sessions() -> AsyncIterator[Sessions]:
    """Provide independent sessions using a unique PostgreSQL schema."""
    url = os.getenv(
        "POSTGRES_TEST_URL",
        os.getenv(
            "TEST_DATABASE_URL", "postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/postgres"
        ),
    )
    schema = f"wechat_lock_{uuid4().hex}"
    admin = create_async_engine(url)
    try:
        async with admin.begin() as connection:
            await connection.execute(CreateSchema(schema))
        engine = create_async_engine(url, connect_args={"server_settings": {"search_path": schema}})
        try:
            async with engine.begin() as connection:
                tables = [
                    table
                    for table in Base.metadata.tables.values()
                    if table.name.startswith("wechat_")
                ]
                await connection.run_sync(
                    lambda sync: Base.metadata.create_all(sync, tables=tables)
                )
            yield async_sessionmaker(engine, expire_on_commit=False)
        finally:
            await engine.dispose()
            async with admin.begin() as connection:
                await connection.execute(DropSchema(schema, cascade=True))
    finally:
        await admin.dispose()


async def _candidate(state: Document, source: str, text: str) -> Document:
    assert source == "keyboard"
    return {
        "choices": ["问书吏", "验印章"],
        "eligible": ["interpret"],
        "lock_sentence": f"第{state['turns'] + 1}张纸带有不同的印记。",
    }


async def _no_correction(text: str, style: str) -> str:
    raise AssertionError("改锁验证不应调用口述整理。")


async def _submit(
    sessions: Sessions,
    run: Document,
    request_id: str,
    kind: str,
    *,
    subject: str = OWNER,
    **fields: Any,
) -> Document:
    async with sessions() as db:
        return await act(
            db,
            subject,
            run["id"],
            {"request_id": request_id, "kind": kind, "version": run["version"], **fields},
            generate_turn=_candidate,
            correct_voice=_no_correction,
        )


async def _evolved_high_run(sessions: Sessions) -> Document:
    async with sessions() as db:
        first = await start_run(
            db, OWNER, {"request_id": "first", "theme": "letter", "mode": "normal"}
        )
    first = await _submit(
        sessions, first, "first-turn", "turn", source="keyboard", text="我翻过信封。"
    )
    await _submit(sessions, first, "first-finish", "finish")
    async with sessions() as db:
        run = await start_run(
            db,
            OWNER,
            {"request_id": "advanced", "theme": "detective", "mode": "high", "accept_high": True},
        )
    for round_index in (1, 2):
        for step, text in (("lock", "我拿起案头上的纸。"), ("reply", "我请书吏看印章。")):
            run = await _submit(
                sessions, run, f"{round_index}-{step}", "turn", source="keyboard", text=text
            )
        run = await _submit(sessions, run, f"{round_index}-ability", "ability", ability="interpret")
    return run


@pytest.mark.integration
async def test_high_lock_change_is_atomic_and_replay_safe(
    lock_sessions: Sessions, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Only one writer command spends the chance after a preview and cancellation."""
    run = await _evolved_high_run(lock_sessions)
    assert run["abilities"]["interpret"] == {"enabled": True, "level": 2}
    assert run["lock_uses"] == 1
    target = next(segment for segment in run["segments"] if segment["locked"])
    model = AsyncMock(return_value=REPLACEMENT)
    monkeypatch.setattr(wechat.story_writer, "propose_lock_replacement", model)
    body = Preview(kind="replace", version=run["version"], target=target["id"])

    async with lock_sessions() as db:
        result = await wechat.preview(run["id"], body, OWNER, db)
        assert result == {"version": run["version"], "target": target["id"], "text": REPLACEMENT}
        assert await get_run(db, OWNER, run["id"]) == run
    model.assert_awaited_once()
    assert model.await_args is not None and model.await_args.args[1] == target["text"]
    async with lock_sessions() as db:
        with pytest.raises(NotFoundError):
            await wechat.preview(run["id"], body, OTHER, db)

    ready = await _submit(lock_sessions, run, "cancel", "cancel", target="canceled-replacement")
    assert ready["lock_uses"] == 1 and ready["segments"] == run["segments"]
    assert ready["version"] == run["version"] + 1
    replacement = {"target": target["id"], "text": result["text"]}
    assert (
        await _submit(lock_sessions, ready, "canceled-replacement", "replace", **replacement)
        == ready
    )
    async with lock_sessions() as db:
        assert await action_receipt(db, OWNER, run["id"], "canceled-replacement") == {
            "status": "canceled",
            "run_version": ready["version"],
        }
    with pytest.raises(ConflictError):
        await _submit(lock_sessions, run, "outdated-unlock", "unlock", target=target["id"])
    with pytest.raises(NotFoundError):
        await _submit(
            lock_sessions, ready, "foreign-replace", "replace", subject=OTHER, **replacement
        )

    start = asyncio.Barrier(2)
    unlock = {"target": target["id"]}

    async def compete(kind: str, fields: Document) -> Document | AppError:
        await start.wait()
        try:
            return await _submit(lock_sessions, ready, kind, kind, **fields)
        except AppError as error:
            return error

    unlocked, replaced = await asyncio.wait_for(
        asyncio.gather(compete("unlock", unlock), compete("replace", replacement)), timeout=10
    )
    if isinstance(unlocked, dict):
        winner, loser, succeeded, rejected, fields = "unlock", "replace", unlocked, replaced, unlock
        changed = {**target, "locked": False}
    else:
        assert isinstance(replaced, dict)
        winner, loser, succeeded, rejected, fields = (
            "replace",
            "unlock",
            replaced,
            unlocked,
            replacement,
        )
        changed = {**target, "locked": True, "text": result["text"], "ai_generated": True}
    assert isinstance(rejected, ConflictError)
    assert succeeded["lock_uses"] == 0
    assert succeeded["version"] == ready["version"] + 1
    assert succeeded["turns"] == ready["turns"]
    assert succeeded["responses"] == ready["responses"]
    assert succeeded["segments"] == [
        changed if segment["id"] == target["id"] else segment for segment in ready["segments"]
    ]
    assert await _submit(lock_sessions, ready, winner, winner, **fields) == succeeded
    async with lock_sessions() as db:
        assert await get_run(db, OWNER, run["id"]) == succeeded
        assert await action_receipt(db, OWNER, run["id"], winner) == {
            "status": "committed",
            "run_version": succeeded["version"],
        }
        assert await action_receipt(db, OWNER, run["id"], loser) == {
            "status": "unknown",
            "run_version": succeeded["version"],
        }
        with pytest.raises(NotFoundError):
            await action_receipt(db, OTHER, run["id"], winner)
