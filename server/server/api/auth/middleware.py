"""Authentication middleware."""

import os
from collections.abc import Awaitable, Callable

import jwt
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

from server.infrastructure.security.jwt_handler import JWTHandler


class AuthenticationMiddleware(BaseHTTPMiddleware):
    PUBLIC_PATHS = ["/health", "/auth/login", "/auth/register", "/docs", "/openapi.json"]

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if os.getenv("TESTING") == "1":
            return await call_next(request)

        if any(request.url.path.startswith(path) for path in self.PUBLIC_PATHS):
            return await call_next(request)

        token = request.cookies.get("access_token")
        if not token:
            return JSONResponse(status_code=401, content={"detail": "Authentication required"})

        try:
            payload = JWTHandler.verify_token(token)
            request.state.user_id = payload["sub"]
        except jwt.InvalidTokenError:
            return JSONResponse(status_code=401, content={"detail": "Invalid token"})

        if request.method != "GET":
            csrf_header = request.headers.get("X-CSRF-Token")
            csrf_cookie = request.cookies.get("csrf_token")
            if not csrf_header or not csrf_cookie or csrf_header != csrf_cookie:
                return JSONResponse(status_code=403, content={"detail": "CSRF validation failed"})

        return await call_next(request)
