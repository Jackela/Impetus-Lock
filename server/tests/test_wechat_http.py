"""HTTP contract and ownership boundaries for the mini program."""

from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncIterator
from unittest.mock import AsyncMock
from uuid import uuid4

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.schema import CreateSchema, DropSchema

from server.api.auth.middleware import AuthenticationMiddleware
from server.api.errors import app_error_handler
from server.api.routes import wechat
from server.application.services.wechat_preview import preview_text
from server.domain.errors import AppError
from server.infrastructure.persistence.models import Base
from server.infrastructure.security import wechat_identity


@pytest.fixture
async def http_client(tmp_path, monkeypatch):
    """Exercise real persistence with two principals and offline provider boundaries."""
    postgres = os.getenv("WECHAT_HTTP_TEST_DATABASE_URL")
    admin = None
    schema = "wechat_http_" + uuid4().hex
    if postgres:
        admin = create_async_engine(postgres)
        async with admin.begin() as conn:
            await conn.execute(CreateSchema(schema))
        engine = create_async_engine(
            postgres, connect_args={"server_settings": {"search_path": schema}}
        )
    else:
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'wechat_http.db'}")
    async with engine.begin() as conn:
        tables = [t for t in Base.metadata.tables.values() if t.name.startswith("wechat_")]
        await conn.run_sync(lambda sync: Base.metadata.create_all(sync, tables=tables))
    sessions = async_sessionmaker(engine, expire_on_commit=False)

    async def db() -> AsyncIterator[AsyncSession]:
        async with sessions() as session:
            yield session

    monkeypatch.setattr(wechat_identity, "_session", sessions)
    app = FastAPI()
    app.add_middleware(AuthenticationMiddleware)
    app.add_exception_handler(AppError, app_error_handler)
    app.include_router(wechat.router)
    app.dependency_overrides[wechat.get_session] = db
    monkeypatch.setattr(wechat, "check_public_text", AsyncMock(return_value=None))
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://local"
    ) as client:
        yield client, app
    await engine.dispose()
    if admin:
        async with admin.begin() as conn:
            await conn.execute(DropSchema(schema, cascade=True))
        await admin.dispose()


@pytest.fixture
def wechat_login(http_client, monkeypatch):
    """Sign real sessions for simulated devices using a stubbed WeChat exchange."""
    client, _ = http_client
    monkeypatch.setenv("WECHAT_APP_ID", "local-fixture-app")
    monkeypatch.setenv("WECHAT_APP_SECRET", "fixture-app-secret")
    monkeypatch.setenv("WECHAT_SESSION_SECRET", "local fixture signing secret for two test authors")
    monkeypatch.delenv("TESTING", raising=False)

    async def exchange(path, *, query=None, body=None):
        assert path == "/sns/jscode2session"
        return {"openid": "wx-user-" + query["js_code"][0], "session_key": "test-only"}

    monkeypatch.setattr(wechat_identity, "_request_wx", exchange)

    async def login(code):
        response = await client.post("/api/wechat/session", json={"code": code})
        assert response.status_code == 200, response.text
        return response.json()

    return login


async def test_private_run_and_frozen_public_card(http_client):
    """Only the owner can mutate the draft and public responses have a text-only shape."""
    client, app = http_client
    app.dependency_overrides[wechat.principal] = lambda: "author-a"
    start = {"request_id": "open-a", "theme": "letter", "mode": "normal"}
    opened = await client.post("/api/wechat/runs", json=start)
    assert opened.status_code == 200, opened.text
    run = opened.json()
    assert (await client.post("/api/wechat/runs", json=start)).json()["id"] == run["id"]
    path = f"/api/wechat/runs/{run['id']}"
    finish = {"kind": "finish", "version": run["version"], "request_id": "finish-a"}
    ended = await client.post(path + "/actions", json=finish)
    assert ended.status_code == 200, ended.text
    work_path = f"/api/wechat/works/{ended.json()['work_id']}"
    work = (await client.get(work_path)).json()
    assert work["text"]
    assert (await client.get("/api/wechat/library")).json()["progress"]["completed"] == 0
    card_response = await client.post(
        work_path + "/cards", json={"request_id": "one-card", "version": work["version"]}
    )
    assert card_response.status_code == 200, card_response.text
    card = card_response.json()
    edited = await client.patch(
        work_path, json={"title": "新版本", "text": "私稿改动", "version": work["version"]}
    )
    assert edited.status_code == 200
    updated = await client.put(
        work_path,
        json={
            "title": "再次编辑",
            "text": "第二次保存",
            "version": edited.json()["version"],
        },
    )
    assert updated.status_code == 200 and updated.json()["text"] == "第二次保存"
    app.dependency_overrides[wechat.principal] = lambda: "reader-b"
    assert (await client.get(work_path)).status_code == 404
    assert (await client.get(path)).status_code == 404
    app.dependency_overrides.pop(wechat.principal)
    public_path = f"/api/wechat/cards/{card['id']}"
    snapshot = await client.get(public_path)
    assert snapshot.status_code == 200
    assert snapshot.json()["text"] == work["text"]
    assert snapshot.json()["rules"] == work["rules"]
    assert (
        not {"subject", "run_id", "work_id", "segments", "original", "initial"}
        & snapshot.json().keys()
    )
    assert isinstance(snapshot.json()["rules"], str)
    app.dependency_overrides[wechat.principal] = lambda: "author-a"
    assert (await client.delete(work_path + "/cards/" + card["id"])).status_code == 204
    assert (await client.get(public_path)).status_code == 404


async def test_reject_invalid_commands_and_unknown_fields(http_client):
    """Malformed mutating commands never enter the service or provider."""
    client, app = http_client
    app.dependency_overrides[wechat.principal] = lambda: "author-a"
    for extra in ({"version": -1}, {"source": "injected"}, {"subject": "impersonated"}):
        payload = {"request_id": "bad", "version": 0, "kind": "turn", **extra}
        assert (await client.post("/api/wechat/runs/x/actions", json=payload)).status_code == 422


def test_openapi_describes_writer_and_work_preview_fields(http_client):
    """Publish the run and preview fields used by clients in the API contract."""
    _, app = http_client
    schema = app.openapi()
    schemas = schema["components"]["schemas"]
    assert {
        "rules",
        "generation_pending",
        "waiting_response",
        "pending_intervention",
        "responses",
        "interpretation_options",
        "interpretations",
        "interpretation",
        "recoveries",
    } <= schemas["RunView"]["properties"].keys()
    assert {"opening", "rules", "requires_consent"} <= schemas["WorkView"]["properties"].keys()
    assert schemas["RunView"]["properties"]["recoveries"]["items"]["$ref"].endswith("/RecoveryView")
    assert "ai_generated" in schemas["SegmentView"]["properties"]
    assert "request_ids" in schemas["ActionConflictDetails"]["properties"]
    assert "409" in schema["paths"]["/api/wechat/runs/{run_id}/actions"]["post"]["responses"]


@pytest.mark.parametrize("theme", ["letter", "detective"])
@pytest.mark.parametrize("mode", ["normal", "high"])
@pytest.mark.parametrize("source", ["choice", "keyboard", "voice"])
async def test_two_themes_modes_and_three_input_paths(
    http_client, monkeypatch, theme, mode, source
):
    """Play the first turn through to a private work using the authenticated HTTP surface."""
    client, app = http_client
    app.dependency_overrides[wechat.principal] = lambda: "player"
    seen = []

    async def generate(state, input_source, text):
        seen.append((input_source, text, state["segments"][0]["text"]))
        return {
            "paragraph": "我把纸放回桌上。" if input_source == "choice" else "",
            "choices": ["找出另一封信", "去窗边等人"],
            "lock_sentence": "纸上的日期是明天。",
            "facts": [],
            "eligible": ["returning", "interpret"],
            "consequence": None,
        }

    monkeypatch.setattr(wechat, "generate_turn", generate)
    monkeypatch.setattr(wechat, "correct_voice", AsyncMock(return_value="我决定先出去走走。"))

    async def start(request_id, chosen_theme, chosen_mode, **fields):
        r = await client.post(
            "/api/wechat/runs",
            json={
                "request_id": request_id,
                "theme": chosen_theme,
                "mode": chosen_mode,
                **fields,
            },
        )
        assert r.status_code == 200, r.text
        return r.json()

    async def command(run, request_id, kind, **fields):
        r = await client.post(
            f"/api/wechat/runs/{run['id']}/actions",
            json={
                "request_id": request_id,
                "version": run["version"],
                "kind": kind,
                **fields,
            },
        )
        assert r.status_code == 200, r.text
        return r.json()

    if theme == "detective" or mode == "high":
        initial = await start("unlock", "letter", "normal")
        written = await command(initial, "first", "turn", source="keyboard", text="我去门外。")
        await command(written, "done", "finish")
    changed_opening = "墙上的钟刚响过十二下。"
    if mode == "high":
        denied = await client.post(
            "/api/wechat/runs",
            json={
                "request_id": "round",
                "theme": theme,
                "mode": mode,
                "opening": changed_opening,
            },
        )
        assert denied.status_code == 403
    run = await start("round", theme, mode, opening=changed_opening, accept_high=mode == "high")
    assert run["turns"] == 0
    text = run["choices"][0] if source == "choice" else "我决定先出去走走"
    payload = {"source": source, "text": text}
    if source == "voice":
        payload["style"] = "voice"
    written = await command(run, "input", "turn", **payload)
    assert written["turns"] == 1
    assert any(s["locked"] for s in written["segments"])
    assert seen[-1][0] == source and seen[-1][2] == changed_opening
    count = len(seen)
    replay = await command(run, "input", "turn", **payload)
    assert replay["segments"] == written["segments"] and len(seen) == count
    if source == "voice":
        assert any(s.get("original") == text for s in written["segments"])
    ended = await command(written, "end", "finish")
    work = (await client.get(f"/api/wechat/works/{ended['work_id']}")).json()
    assert work["challenge_id"] == theme + "/v1" and work["rules_version"] == 1
    assert work["text"].startswith(changed_opening)
    assert work["ai_generated"] is True


async def test_preview_is_private_and_never_commits_stale_voice_text(http_client, monkeypatch):
    """Reject the candidate if an intervening edit won while the provider was running."""
    client, app = http_client
    app.dependency_overrides[wechat.principal] = lambda: "voice-author"
    monkeypatch.setattr(
        wechat,
        "generate_turn",
        AsyncMock(
            return_value={
                "paragraph": "",
                "choices": ["问清经过", "等到天亮"],
                "lock_sentence": "钟忽然停了。",
                "facts": [],
                "eligible": [],
                "consequence": None,
            }
        ),
    )
    run = (
        await client.post(
            "/api/wechat/runs",
            json={
                "request_id": "open",
                "theme": "letter",
                "mode": "normal",
            },
        )
    ).json()
    base = f"/api/wechat/runs/{run['id']}"
    run = (
        await client.post(
            base + "/actions",
            json={
                "request_id": "voice",
                "kind": "turn",
                "source": "voice",
                "text": "天要亮了",
                "style": "verbatim",
                "version": run["version"],
            },
        )
    ).json()
    segment = next(s for s in run["segments"] if s["source"] == "voice")
    body = {
        "kind": "restyle",
        "version": run["version"],
        "target": segment["id"],
        "style": "polish",
    }
    mock = AsyncMock(return_value="天色将明。")
    monkeypatch.setattr(wechat, "correct_voice", mock)
    app.dependency_overrides[wechat.principal] = lambda: "another-writer"
    assert (await client.post(base + "/preview", json=body)).status_code == 404
    app.dependency_overrides[wechat.principal] = lambda: "voice-author"
    assert (
        await client.post(base + "/preview", json={**body, "target": "absent"})
    ).status_code == 409
    mock.assert_not_awaited()
    preview = await client.post(base + "/preview", json=body)
    assert preview.status_code == 200, preview.text
    assert preview.json() == {
        "text": "天色将明。",
        "target": segment["id"],
        "version": run["version"],
    }
    mock.assert_awaited_once_with("天要亮了", "polish")
    assert (await client.get(base)).json()["segments"] == run["segments"]

    async def during_edit(text, style):
        edit = await client.post(
            base + "/actions",
            json={
                "request_id": "edit",
                "kind": "edit",
                "target": segment["id"],
                "text": "用户改稿",
                "version": run["version"],
            },
        )
        assert edit.status_code == 200
        return "过期候选"

    monkeypatch.setattr(wechat, "correct_voice", during_edit)
    late = await client.post(base + "/preview", json=body)
    assert late.status_code == 409 and "过期候选" not in late.text


async def test_finish_while_generating_freezes_only_committed_text(
    http_client, wechat_login, monkeypatch
):
    """A second signed session can reconcile its author's pending input before finishing."""
    client, _ = http_client
    first_login = await wechat_login("a1")
    second_login = await wechat_login("a2")
    other_login = await wechat_login("b1")
    assert first_login["subject"] == second_login["subject"] != other_login["subject"]
    auth_first = {"Authorization": "Bearer " + first_login["token"]}
    auth_second = {"Authorization": "Bearer " + second_login["token"]}
    auth_other = {"Authorization": "Bearer " + other_login["token"]}
    entered, release = asyncio.Event(), asyncio.Event()
    calls = 0

    async def delayed(state, source, text):
        nonlocal calls
        calls += 1
        entered.set()
        await release.wait()
        return {
            "paragraph": "迟到剧情",
            "choices": ["追上去", "留下来"],
            "lock_sentence": "灯熄了。",
            "facts": [],
            "eligible": [],
            "consequence": None,
        }

    monkeypatch.setattr(wechat, "generate_turn", delayed)
    run = (
        await client.post(
            "/api/wechat/runs",
            headers=auth_first,
            json={
                "request_id": "start",
                "theme": "letter",
                "mode": "normal",
            },
        )
    ).json()
    path = f"/api/wechat/runs/{run['id']}/actions"
    turn = {
        "request_id": "same-turn",
        "version": run["version"],
        "kind": "turn",
        "source": "choice",
        "text": run["choices"][0],
    }
    future = asyncio.create_task(client.post(path, headers=auth_first, json=turn))
    try:
        await asyncio.wait_for(entered.wait(), 3)
        duplicate = await client.post(path, headers=auth_first, json=turn)
        assert duplicate.status_code == 409
        finish = {"request_id": "end", "version": run["version"], "kind": "finish"}
        blocked = await client.post(path, headers=auth_second, json=finish)
        assert blocked.status_code == 409, blocked.text
        assert blocked.json()["error"]["code"] == "STORY_FINISH_INPUT_PENDING"
        assert blocked.json()["error"]["details"]["request_ids"] == [turn["request_id"]]
        private = await client.post(path, headers=auth_other, json=finish)
        assert private.status_code == 404 and turn["request_id"] not in private.text
        paused = await client.post(
            path,
            headers=auth_second,
            json={**finish, "request_id": "pause", "kind": "begin_finish"},
        )
        assert paused.status_code == 200 and paused.json()["finishing"]
        paused_version = paused.json()["version"]
        unresolved = await client.post(
            path, headers=auth_second, json={**finish, "version": paused_version}
        )
        assert unresolved.status_code == 409, unresolved.text
        canceled = await client.post(
            path,
            headers=auth_second,
            json={
                "request_id": "cancel-turn",
                "version": paused_version,
                "kind": "cancel",
                "target": turn["request_id"],
            },
        )
        assert canceled.status_code == 200, canceled.text
        finish["version"] = canceled.json()["version"]
        ended = await client.post(path, headers=auth_second, json=finish)
        assert ended.status_code == 200, ended.text
    finally:
        release.set()
        late = await asyncio.wait_for(future, 3)
    assert calls == 1
    assert late.json() == ended.json()
    assert (await client.post(path, headers=auth_first, json=turn)).json() == ended.json()
    assert (await client.post(path, headers=auth_second, json=finish)).json() == ended.json()
    assert "迟到剧情" not in str(
        (await client.get("/api/wechat/library", headers=auth_second)).json()
    )
    assert ended.json()["turns"] == 0 and ended.json()["status"] == "finished"


@pytest.mark.parametrize(
    "kind,mode,action,locked,uses,expected",
    [
        ("replace", "high", "", True, 1, "候选"),
        ("replace", "normal", "", True, 1, 403),
        ("replace", "high", "", True, 0, 403),
        ("replace", "high", "", True, 2, 403),
        ("rewrite", "custom", "rewrite", False, 0, "候选"),
        ("rewrite", "custom", "rewrite", True, 0, 403),
        ("rewrite", "custom", "delete", False, 0, 403),
        ("insert", "custom", "insert", False, 0, "候选"),
        ("restyle", "normal", "", False, 0, 422),
    ],
)
async def test_preview_permission_checked_before_supplier(
    kind, mode, action, locked, uses, expected
):
    """A preview consumes provider resources only after checking the target and permission."""
    state = {
        "status": "active",
        "mode": mode,
        "turns": 1,
        "waiting_response": False,
        "abilities": {"interpret": {"level": 2, "enabled": True}},
        "lock_uses": uses,
        "rules": {"trigger": "manual", "action": action},
        "segments": [{"id": "s", "text": "今晚有风", "source": "keyboard", "locked": locked}],
    }
    provider = AsyncMock(return_value="候选")

    async def preview():
        return await preview_text(
            state,
            kind,
            "s",
            "voice",
            correct_voice=provider,
            replace=provider,
            rewrite=provider,
            insert=provider,
        )

    if isinstance(expected, str):
        assert await preview() == expected
        provider.assert_awaited_once()
    else:
        with pytest.raises(AppError) as error:
            await preview()
        assert error.value.status_code == expected
        provider.assert_not_awaited()


async def test_inflight_lock_preview_cannot_apply_after_another_session_unlocks(
    http_client, monkeypatch
):
    """An unlocked target keeps its original text and a late preview cannot spend again."""
    client, app = http_client
    app.dependency_overrides[wechat.principal] = lambda: "lock-author"

    async def generate(state, source, text):
        return {
            "choices": ["查案头的线索", "追问后来的人"],
            "lock_sentence": f"案上新添了第{state['turns'] + 1}张纸。",
            "eligible": ["interpret"],
        }

    monkeypatch.setattr(wechat, "generate_turn", generate)

    async def start(mode):
        result = await client.post(
            "/api/wechat/runs",
            json={
                "theme": "detective" if mode == "high" else "letter",
                "mode": mode,
                "accept_high": mode == "high",
                "request_id": mode,
            },
        )
        assert result.status_code == 200, result.text
        return result.json()

    async def command(run, kind, request_id, **fields):
        return await client.post(
            f"/api/wechat/runs/{run['id']}/actions",
            json={"kind": kind, "request_id": request_id, "version": run["version"], **fields},
        )

    normal = await start("normal")
    first = await command(normal, "turn", "first", source="keyboard", text="我走到窗边。")
    assert first.status_code == 200, first.text
    assert (await command(first.json(), "finish", "finish")).status_code == 200
    run = await start("high")
    for round_index in (1, 2):
        for step, text in (("lock", "我拿起案头上的纸。"), ("reply", "我请书吏看印章。")):
            result = await command(
                run, "turn", f"{round_index}-{step}", source="keyboard", text=text
            )
            assert result.status_code == 200, result.text
            run = result.json()
        result = await command(run, "ability", f"{round_index}-ability", ability="interpret")
        assert result.status_code == 200, result.text
        run = result.json()
    target = next(segment for segment in run["segments"] if segment["locked"])
    assert run["lock_uses"] == 1
    failed = await command(run, "replace", "unchanged", target=target["id"], text=target["text"])
    assert failed.status_code == 422, failed.text

    entered, release = asyncio.Event(), asyncio.Event()
    replacement = "我终于看清纸背画的符号。"

    async def delayed(state, original):
        assert original == target["text"] and state["lock_uses"] == 1
        entered.set()
        await release.wait()
        return replacement

    monkeypatch.setattr(wechat.story_writer, "propose_lock_replacement", delayed)
    path = f"/api/wechat/runs/{run['id']}"
    preview = asyncio.create_task(
        client.post(
            path + "/preview",
            json={"kind": "replace", "version": run["version"], "target": target["id"]},
        )
    )
    try:
        await asyncio.wait_for(entered.wait(), 3)
        response = await command(run, "unlock", "winner", target=target["id"])
        assert response.status_code == 200, response.text
        unlocked = response.json()
    finally:
        release.set()
        late = await asyncio.wait_for(preview, 3)

    assert late.status_code == 409 and replacement not in late.text
    assert unlocked["lock_uses"] == 0 and unlocked["version"] == run["version"] + 1
    assert unlocked["segments"] == [
        {**segment, "locked": False} if segment["id"] == target["id"] else segment
        for segment in run["segments"]
    ]
    outdated = await command(run, "replace", "late", target=target["id"], text=replacement)
    assert outdated.status_code == 409
    used = await command(unlocked, "replace", "another", target=target["id"], text=replacement)
    assert used.status_code == 422
    assert (await command(run, "unlock", "winner", target=target["id"])).json() == unlocked
    assert (await client.get(path)).json() == unlocked


async def test_discover_modes_and_share_irreversible_game_without_its_history(
    http_client, monkeypatch
):
    """Earn the rules through play, erase a voice passage, then start a friend's independent run."""
    client, app = http_client
    app.dependency_overrides[wechat.principal] = lambda: "mode-author"

    async def generate(state, source, text):
        n = state["turns"] + 1
        return {
            "paragraph": "",
            "choices": ["看看窗外", "出门找她"],
            "lock_sentence": f"桌上有第{n}封信。",
            "facts": [],
            "eligible": ["returning", "interpret"],
            "consequence": None,
        }

    monkeypatch.setattr(wechat, "generate_turn", generate)

    async def post(path, payload, expected=200):
        response = await client.post("/api/wechat/" + path, json=payload)
        assert response.status_code == expected, response.text
        return response.json()

    def start_fields(operation, **extra):
        return {"theme": "letter", "mode": "normal", "request_id": operation, **extra}

    async def act(run, kind, operation, **extra):
        return await post(
            f"runs/{run['id']}/actions",
            {"kind": kind, "request_id": operation, "version": run["version"], **extra},
        )

    rules = {
        "name": "手动删除",
        "trigger": "manual",
        "action": "delete",
        "lock": False,
        "recoverable": False,
    }
    await post("modes", rules, 403)
    for stage, turns in enumerate((1, 2, 4), 1):
        run = await post("runs", start_fields(f"earn-{stage}"))
        for index in range(turns):
            run = await act(
                run, "turn", f"turn-{index}", source="keyboard", text=f"我看看第{index + 1}封。"
            )
        await act(run, "finish", "finish")
        progress = (await client.get("/api/wechat/library")).json()["progress"]
        assert progress["completed"] == stage
        assert progress["rewrite"] == (stage >= 2)
        assert progress["delete"] == (stage >= 3)
        if stage == 2:
            original = await post("modes", {**rules, "name": "最初设置", "action": "insert"})
            response = await client.put(f"/api/wechat/modes/{original['id']}", json=rules)
            assert response.status_code == 403, response.text
            assert (await client.get("/api/wechat/library")).json()["modes"] == [original]

    for trigger in ("response", "automatic"):
        other = await post(
            "modes", {**rules, "name": trigger, "trigger": trigger, "action": "insert"}
        )
        assert other["trigger"] == trigger
    mode = await post("modes", rules)
    replacement = {
        **rules,
        "name": "  新模式名称  ",
        "trigger": "automatic",
        "action": "insert",
        "lock": True,
    }
    path = f"/api/wechat/modes/{mode['id']}"
    initial = start_fields("begin-mode", mode="custom", mode_id=mode["id"])
    await post("runs", initial, 403)
    private = await post("runs", {**initial, "accept_irreversible": True})
    secret = "白纸背面的旧门牌是三十七号。"
    speaking = {"source": "voice", "text": secret, "style": "verbatim"}
    recorded = await act(private, "turn", "audio", **speaking)
    target = next(s["id"] for s in recorded["segments"] if s["source"] == "voice")
    deleted = await act(recorded, "intervene", "delete", target=target)
    assert secret not in str(deleted)
    assert secret not in str(await act(private, "turn", "audio", **speaking))
    fixed = await post(
        "runs", {**initial, "request_id": "other-old-run", "accept_irreversible": True}
    )
    ended = await act(deleted, "finish", "finished")
    work = (await client.get(f"/api/wechat/works/{ended['work_id']}")).json()
    assert secret not in work["text"]
    card = await post(
        f"works/{work['id']}/cards", {"request_id": "shared", "version": work["version"]}
    )
    assert secret not in str(card) and card["requires_consent"]
    app.dependency_overrides[wechat.principal] = lambda: "reader"
    response = await client.put(path, json=replacement)
    assert response.status_code == 404, response.text
    app.dependency_overrides[wechat.principal] = lambda: "mode-author"
    await post("modes", {**rules, "lock": True}, 422)
    response = await client.put(path, json={**rules, "lock": True})
    assert response.status_code == 422, response.text
    response = await client.put(path, json=replacement)
    assert response.status_code == 200, response.text
    updated = {**replacement, "id": mode["id"], "name": "新模式名称"}
    assert response.json() == updated
    modes = (await client.get("/api/wechat/library")).json()["modes"]
    assert [saved for saved in modes if saved["id"] == mode["id"]] == [updated]
    assert len(modes) == 4
    same_run = (await client.get(f"/api/wechat/runs/{fixed['id']}")).json()
    assert same_run["rules"] == fixed["rules"] and same_run["rules"]["action"] == "delete"
    new_run = await post("runs", {**initial, "request_id": "updated-run"})
    assert new_run["rules"]["action"] == "insert" and new_run["rules"]["trigger"] == "automatic"
    assert (await client.get(f"/api/wechat/works/{work['id']}")).json() == work
    assert work["rules"] == card["rules"] and work["requires_consent"] is True
    assert "由作者手动触发" in work["rules"]

    app.dependency_overrides[wechat.principal] = lambda: "reader"
    assert (await client.get(f"/api/wechat/cards/{card['id']}")).json() == card
    same = start_fields("same", card_id=card["id"])
    await post("runs", same, 403)
    friend = await post("runs", {**same, "accept_irreversible": True})
    assert friend["mode"] == "custom" and friend["turns"] == 0 and friend["id"] != ended["id"]
    assert friend["rules"] == fixed["rules"]
    assert (await client.get("/api/wechat/library")).json()["progress"]["delete"] is False


async def test_begin_finish_survives_refresh_and_only_keeps_explicit_text(http_client, monkeypatch):
    """Opening the finish panel persists a pause before the author reviews pending text."""
    client, app = http_client
    app.dependency_overrides[wechat.principal] = lambda: "author"
    provider = AsyncMock(
        side_effect=AssertionError("Paused keyboard input must not invoke a model")
    )
    monkeypatch.setattr(wechat, "generate_turn", provider)
    run = (
        await client.post(
            "/api/wechat/runs",
            json={
                "request_id": "start",
                "theme": "letter",
                "mode": "normal",
            },
        )
    ).json()
    path = "/api/wechat/runs/" + run["id"]
    start_pause = {"kind": "begin_finish", "request_id": "pause", "version": run["version"]}
    paused = await client.post(path + "/actions", json=start_pause)
    assert paused.status_code == 200, paused.text
    assert paused.json()["finishing"] and paused.json()["status"] == "active"
    assert (await client.get(path)).json() == paused.json()
    pending = {
        "kind": "turn",
        "source": "keyboard",
        "text": "我把信收好。",
        "request_id": "draft",
        "version": paused.json()["version"],
    }
    unknown = (await client.get(path + "/receipts/draft")).json()
    assert unknown["status"] == "unknown"
    assert (await client.post(path + "/actions", json=pending)).status_code in {409, 422}
    retained = await client.post(path + "/actions", json={**pending, "retain": True})
    assert retained.status_code == 200, retained.text
    assert retained.json()["turns"] == 1 and retained.json()["finishing"]
    assert not any(s["locked"] for s in retained.json()["segments"])
    assert retained.json()["offers"] == []
    receipt = (await client.get(path + "/receipts/draft")).json()
    assert receipt["status"] == "committed" and "我把信收好" not in str(receipt)
    assert (
        await client.post(path + "/actions", json={**pending, "retain": True})
    ).json() == retained.json()
    resumed = await client.post(
        path + "/actions",
        json={
            "kind": "resume",
            "version": retained.json()["version"],
            "request_id": "resume",
        },
    )
    assert resumed.status_code == 200 and not resumed.json()["finishing"]
    provider.assert_not_awaited()


async def test_code_exchange_and_bearer_private_routes_share_real_identity_storage(
    http_client, wechat_login
):
    """Use signed mini-program tokens with only the upstream WeChat exchange stubbed."""
    client, _ = http_client
    author = await wechat_login("a1")
    assert set(author) == {"token", "subject"} and author["subject"] != "wx-user-a"
    again = await wechat_login("a2")
    reader = await wechat_login("b1")
    assert reader["subject"] != author["subject"] == again["subject"]
    auth = {"Authorization": "Bearer " + author["token"]}
    incoming = {"request_id": "start", "mode": "normal", "theme": "letter"}
    assert (await client.post("/api/wechat/runs", json=incoming)).status_code == 401
    run = (await client.post("/api/wechat/runs", headers=auth, json=incoming)).json()
    path = "/api/wechat/runs/" + run["id"]
    assert (
        await client.get(path, headers={"Authorization": "Bearer " + again["token"]})
    ).status_code == 200
    assert (
        await client.get(path, headers={"Authorization": "Bearer " + reader["token"]})
    ).status_code == 404
    assert (await client.get(path, headers={"Authorization": "Bearer invalid"})).status_code == 401


async def test_keep_pending_choice_claims_original_receipt_once(http_client, monkeypatch):
    """Pause between provider and commit, then explicitly retain the same logical input."""
    client, app = http_client
    app.dependency_overrides[wechat.principal] = lambda: "pausing-writer"
    entered, release = asyncio.Event(), asyncio.Event()

    async def controlled(state, source, text):
        if not state.get("finishing"):
            entered.set()
            await release.wait()
        return {
            "paragraph": "我推开了门。",
            "lock_sentence": "墙上另有笔迹。",
            "choices": ["追问笔迹", "等一会"],
            "eligible": ["interpret"],
        }

    monkeypatch.setattr(wechat, "generate_turn", controlled)
    run = (
        await client.post(
            "/api/wechat/runs",
            json={
                "request_id": "start",
                "mode": "normal",
                "theme": "letter",
            },
        )
    ).json()
    path = "/api/wechat/runs/" + run["id"]
    command = {
        "kind": "turn",
        "source": "choice",
        "request_id": "opening-choice",
        "text": run["choices"][0],
        "version": run["version"],
    }
    old = asyncio.create_task(client.post(path + "/actions", json=command))
    try:
        await asyncio.wait_for(entered.wait(), 3)
        paused = await client.post(
            path + "/actions",
            json={
                "request_id": "pause",
                "kind": "begin_finish",
                "version": run["version"],
            },
        )
        assert paused.status_code == 200, paused.text
        check_path = path + "/receipts/opening-choice"
        assert (await client.get(check_path)).json()["status"] == "pending"
        keep = {**command, "retain": True, "version": paused.json()["version"]}
        kept = await client.post(path + "/actions", json=keep)
        assert kept.status_code == 200, kept.text
        current = kept.json()
        assert current["finishing"] and current["turns"] == 1
        assert [s["text"] for s in current["segments"][1:]] == ["我推开了门。"]
        assert not any(s["locked"] for s in current["segments"])
        assert current["offers"] == []
        assert (await client.get(check_path)).json()["status"] == "committed"
        assert (await client.post(path + "/actions", json=keep)).json() == current
    finally:
        release.set()
        late = await asyncio.wait_for(old, 3)
    assert late.status_code in {200, 409}
    assert (await client.get(path)).json() == current
