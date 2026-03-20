"""Authentication middleware."""

import os

import jwt
from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware

from server.infrastructure.security.jwt_handler import JWTHandler


class AuthenticationMiddleware(BaseHTTPMiddleware):
    PUBLIC_PATHS = ["/health", "/auth/login", "/auth/register", "/docs", "/openapi.json"]

    async def dispatch(self, request: Request, call_next):
        if os.getenv("TESTING"):
            return await call_next(request)

        if any(request.url.path.startswith(path) for path in self.PUBLIC_PATHS):
            return await call_next(request)

        token = request.cookies.get("access_token")
        if not token:
            raise HTTPException(status_code=401, detail="Authentication required")

        try:
            payload = JWTHandler.verify_token(token)
            request.state.user_id = payload["sub"]
        except jwt.InvalidTokenError as err:
            raise HTTPException(status_code=401, detail="Invalid token") from err

        if request.method != "GET":
            csrf_header = request.headers.get("X-CSRF-Token")
            csrf_cookie = request.cookies.get("csrf_token")
            if csrf_header != csrf_cookie:
                raise HTTPException(status_code=403, detail="CSRF validation failed")

        return await call_next(request)
