"""Loopback-only test host for the mini-program transport; never part of the app package."""
import asyncio
import os
import secrets
import socket
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

import uvicorn
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from server.api.errors import app_error_handler, validation_error_handler
from fastapi.exceptions import RequestValidationError
from server.api.routes import wechat
from server.domain.errors import AppError
from server.infrastructure.persistence.models import Base
from server.infrastructure.security import wechat_identity


async def model_turn(state, source, text):
    deferred = state.get("deferred_generation", False)
    if deferred:
        return {
            "paragraph": "",
            "choices": ["去公园", "喝杯热茶"],
            "lock_sentence": (
                f"门外的人敲了{state['turns'] + 1}下门。"
                if state["pending_intervention"] and state["mode"] != "custom"
                else None
            ),
            "facts": [],
            "eligible": ["returning", "interpret"],
            "consequence": None,
            "choice_context": [
                {"requires_original": False, "follows_letter": False} for _ in range(2)
            ],
        }
    return {
        "paragraph": "我把信封转向窗前。" if source == "choice" else "",
        "choices": ["看看笔迹", "把信收好"], "lock_sentence": "邮戳上的日期，却是明天。",
        "facts": [], "eligible": ["returning", "interpret"], "consequence": None,
    }


async def platform(path, *, query=None, body=None):
    if path == "/sns/jscode2session":
        return {"openid": "test-" + query["js_code"].split(".")[0]}
    raise AssertionError("Unexpected external request in isolated test")


async def serve():
    with TemporaryDirectory() as folder:
        engine = create_async_engine("sqlite+aiosqlite:///" + str(Path(folder) / "isolated.db"))
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            tables = [t for t in Base.metadata.tables.values() if t.name.startswith("wechat_")]
            await conn.run_sync(lambda sync: Base.metadata.create_all(sync, tables=tables))

        async def db():
            async with sessions() as session:
                yield session

        app = FastAPI()
        app.add_exception_handler(AppError, app_error_handler)
        app.add_exception_handler(RequestValidationError, validation_error_handler)
        app.include_router(wechat.router)
        app.dependency_overrides[wechat.get_session] = db
        os.environ.update(WECHAT_APP_ID="test-app", WECHAT_APP_SECRET=secrets.token_hex(24),
                          WECHAT_SESSION_SECRET=secrets.token_hex(32))
        with (patch.object(wechat_identity, "_request_wx", platform),
              patch.object(wechat_identity, "_session", sessions),
              patch.object(wechat, "generate_turn", model_turn),
              patch.object(wechat, "check_public_text", AsyncMock(return_value=None)),
              socket.socket() as listener):
            listener.bind(("127.0.0.1", 0))
            listener.listen()
            config = uvicorn.Config(app, log_level="error", access_log=False, lifespan="off")
            server = uvicorn.Server(config)
            task = asyncio.create_task(server.serve(sockets=[listener]))
            while not server.started:
                if task.done():
                    await task
                await asyncio.sleep(0.01)
            print("READY " + str(listener.getsockname()[1]), flush=True)
            await task
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(serve())
