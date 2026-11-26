"""Exchange verified WeChat codes, issue app-scoped sessions and check shared text."""

import asyncio
import json
import os
import time
from contextlib import AbstractAsyncContextManager
from datetime import UTC, datetime, timedelta
from http.client import HTTPException as HTTPClientError
from http.client import HTTPSConnection
from typing import Any
from urllib.parse import urlencode
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from server.infrastructure.persistence.database import get_db_manager
from server.models.wechat_identity import WechatIdentity

_bearer = HTTPBearer(auto_error=False, scheme_name="WechatSession")
_issuer = "impetus-lock-wechat"
_access_tokens: dict[str, tuple[str, float]] = {}


def _setting(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value or (name == "WECHAT_SESSION_SECRET" and len(value.encode()) < 32):
        raise HTTPException(503, "小程序服务尚未配置完成。")
    return value


def _session() -> AbstractAsyncContextManager[AsyncSession]:
    return get_db_manager().session()


async def _request_wx(
    path: str, *, query: dict[str, str] | None = None, body: dict[str, Any] | None = None
) -> dict[str, Any]:
    """Call the fixed WeChat API host without logging credential-bearing query strings."""

    def send() -> dict[str, Any]:
        connection = HTTPSConnection("api.weixin.qq.com", timeout=8)
        try:
            target = path + ("?" + urlencode(query) if query else "")
            connection.request(
                "GET" if body is None else "POST",
                target,
                body=None if body is None else json.dumps(body, ensure_ascii=False).encode(),
                headers={"Content-Type": "application/json; charset=utf-8"},
            )
            response = connection.getresponse()
            if response.status != 200:
                raise HTTPException(503, "微信服务暂时不可用，请稍后重试。")
            data = json.loads(response.read(131072))
            if not isinstance(data, dict):
                raise ValueError("unexpected upstream response")
            return data
        except (OSError, HTTPClientError, ValueError) as exc:
            raise HTTPException(503, "微信服务暂时不可用，请稍后重试。") from exc
        finally:
            connection.close()

    return await asyncio.to_thread(send)


async def exchange_code(code: str) -> dict[str, str]:
    """Resolve a single-use login code against WeChat and return our own business session."""
    app_id = _setting("WECHAT_APP_ID")
    signing_key = _setting("WECHAT_SESSION_SECRET")
    if not code.strip() or len(code) > 1024:
        raise HTTPException(401, "微信登录凭证无效，请重新登录。")
    reply = await _request_wx(
        "/sns/jscode2session",
        query={
            "appid": app_id,
            "secret": _setting("WECHAT_APP_SECRET"),
            "js_code": code,
            "grant_type": "authorization_code",
        },
    )
    open_id = reply.get("openid")
    if reply.get("errcode") in (40029, 40163):
        raise HTTPException(401, "微信登录凭证已失效，请重新登录。")
    if reply.get("errcode", 0) != 0 or not isinstance(open_id, str) or not 0 < len(open_id) <= 128:
        raise HTTPException(503, "微信身份暂时无法确认，请重试。")
    lookup = select(WechatIdentity.subject).where(
        WechatIdentity.app_id == app_id, WechatIdentity.open_id == open_id
    )
    async with _session() as db:
        subject = await db.scalar(lookup)
        if subject is None:
            account = WechatIdentity(app_id=app_id, open_id=open_id)
            db.add(account)
            try:
                await db.flush()
                subject = account.subject
                await db.commit()
            except IntegrityError:
                await db.rollback()
                subject = (await db.execute(lookup)).scalar_one()
    now = datetime.now(UTC)
    token = jwt.encode(
        {
            "sub": subject,
            "iss": _issuer,
            "aud": "wechat:" + app_id,
            "iat": now,
            "exp": now + timedelta(hours=12),
        },
        signing_key,
        algorithm="HS256",
    )
    return {"subject": str(subject), "token": token}


async def principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str:
    """Authenticate only a bearer issued for the configured mini program."""
    if credentials is None:
        raise HTTPException(401, "请重新确认微信身份。")
    try:
        claims = jwt.decode(
            credentials.credentials,
            _setting("WECHAT_SESSION_SECRET"),
            algorithms=["HS256"],
            audience="wechat:" + _setting("WECHAT_APP_ID"),
            issuer=_issuer,
            options={"require": ["sub", "iat", "exp", "aud", "iss"]},
        )
        return str(UUID(claims["sub"]))
    except (jwt.InvalidTokenError, ValueError, TypeError) as exc:
        raise HTTPException(401, "微信会话已失效，请重新登录。") from exc


async def _moderation_token(app_id: str) -> str:
    cached = _access_tokens.get(app_id)
    if cached and cached[1] > time.monotonic():
        return cached[0]
    reply = await _request_wx(
        "/cgi-bin/stable_token",
        body={
            "grant_type": "client_credential",
            "appid": app_id,
            "secret": _setting("WECHAT_APP_SECRET"),
        },
    )
    token, expires = reply.get("access_token"), reply.get("expires_in")
    if not isinstance(token, str) or not token or not isinstance(expires, int) or expires <= 0:
        raise HTTPException(503, "分享检查暂时不可用，请稍后重试。")
    _access_tokens[app_id] = (token, time.monotonic() + max(0, expires - 120))
    return token


async def check_public_text(subject: str, text: str) -> None:
    """Screen each part of the chosen public snapshot before allowing publication."""
    app_id = _setting("WECHAT_APP_ID")
    async with _session() as db:
        open_id = await db.scalar(
            select(WechatIdentity.open_id).where(
                WechatIdentity.subject == subject, WechatIdentity.app_id == app_id
            )
        )
    if open_id is None:
        raise HTTPException(401, "请重新确认微信身份。")
    token = await _moderation_token(app_id)
    for at in range(0, len(text), 2000):
        reply = await _request_wx(
            "/wxa/msg_sec_check",
            query={"access_token": token},
            body={
                "openid": open_id,
                "scene": 3,
                "version": 2,
                "content": text[at : at + 2000],
            },
        )
        if reply.get("errcode") in (40001, 40014, 42001):
            _access_tokens.pop(app_id, None)
        verdict = reply.get("result")
        if reply.get("errcode") != 0 or not isinstance(verdict, dict):
            raise HTTPException(503, "分享检查暂时不可用，作品已保存在私稿中。")
        if verdict.get("suggest") != "pass":
            raise HTTPException(422, "这份作品暂时无法公开分享，仍可在我的作品中编辑。")
