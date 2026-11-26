"""WeChat-only identity and text screening at the real HTTP dependency boundary."""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import jwt
import pytest
from fastapi import Depends, FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from server.api.auth.middleware import AuthenticationMiddleware
from server.infrastructure.security import wechat_identity as wx
from server.models.wechat_identity import WechatIdentity


@pytest.fixture
async def identities(tmp_path, monkeypatch):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'accounts.sqlite3'}")
    async with engine.begin() as conn:
        await conn.run_sync(WechatIdentity.__table__.create)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    monkeypatch.setattr(wx, "_session", sessions)
    monkeypatch.setenv("WECHAT_APP_ID", "wx-game")
    monkeypatch.setenv("WECHAT_APP_SECRET", "app-secret")
    monkeypatch.setenv("WECHAT_SESSION_SECRET", "test signing key that is at least 32 bytes")
    yield
    await engine.dispose()


async def test_reissued_code_recovers_internal_subject_without_exposing_wechat_fields(
    identities, monkeypatch
):
    async def reply(path: str, *, query=None, body=None):
        assert path == "/sns/jscode2session" and query["grant_type"] == "authorization_code"
        return {"openid": "person-" + query["js_code"][0], "session_key": "never-return-this"}

    monkeypatch.setattr(wx, "_request_wx", reply)
    a = await wx.exchange_code("a1")
    again = await wx.exchange_code("a2")
    b = await wx.exchange_code("b1")
    assert a["subject"] == again["subject"] != b["subject"]
    assert set(a) == {"token", "subject"} and "person-a" not in str(a)
    app = FastAPI()
    app.add_middleware(AuthenticationMiddleware)

    @app.get("/api/wechat/private")
    def private(subject: str = Depends(wx.principal)):
        return subject

    @app.get("/api/wechat-lookalike")
    def ordinary():
        return "protected web"

    monkeypatch.delenv("TESTING", raising=False)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        path = "/api/wechat/private"
        assert (await client.get(path)).status_code == 401
        assert (
            await client.get(path, headers={"Authorization": "Bearer wrong"})
        ).status_code == 401
        good = {"Authorization": "Bearer " + a["token"]}
        assert (await client.get(path, headers=good)).json() == a["subject"]
        assert (await client.get("/api/wechat-lookalike", headers=good)).status_code == 401
        for overrides in ({"aud": "web"}, {"exp": datetime.now(UTC) - timedelta(minutes=1)}):
            payload = {
                "aud": "wechat:wx-game",
                "sub": str(uuid4()),
                "iat": datetime.now(UTC),
                "iss": "impetus-lock-wechat",
                "exp": datetime.now(UTC) + timedelta(hours=1),
                **overrides,
            }
            token = jwt.encode(
                payload, "test signing key that is at least 32 bytes", algorithm="HS256"
            )
            assert (
                await client.get(path, headers={"Authorization": "Bearer " + token})
            ).status_code == 401


async def test_wechat_error_does_not_create_anonymous_or_return_provider_details(
    identities, monkeypatch
):
    async def reply(*args, **kwargs):
        return {"errcode": 40029, "errmsg": "private-provider-detail"}

    monkeypatch.setattr(wx, "_request_wx", reply)
    with pytest.raises(HTTPException) as error:
        await wx.exchange_code("expired")
    assert error.value.status_code == 401
    assert "private-provider-detail" not in str(error.value)


async def test_publication_checks_all_text_with_verified_openid(identities, monkeypatch):
    chunks = []
    verdict = "pass"

    async def reply(path: str, *, query=None, body: dict[str, Any] | None = None):
        if path.endswith("jscode2session"):
            return {"openid": "wx-a", "session_key": "unused"}
        if path.endswith("stable_token"):
            return {"access_token": "moderator", "expires_in": 7200}
        assert path == "/wxa/msg_sec_check" and query == {"access_token": "moderator"}
        assert body and body["openid"] == "wx-a" and body["version"] == 2
        chunks.append(body["content"])
        return {"errcode": 0, "result": {"suggest": verdict}}

    monkeypatch.setattr(wx, "_request_wx", reply)
    account = await wx.exchange_code("ok")
    await wx.check_public_text(account["subject"], "字" * 4500)
    assert "".join(chunks) == "字" * 4500 and max(map(len, chunks)) <= 2500
    verdict = "review"
    with pytest.raises(HTTPException) as denied:
        await wx.check_public_text(account["subject"], "需复核的作品")
    assert denied.value.status_code == 422
