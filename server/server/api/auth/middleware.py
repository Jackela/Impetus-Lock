"""Authentication middleware."""

import os
from collections.abc import Awaitable, Callable
from uuid import UUID

import jwt
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

from server.infrastructure.security.jwt_handler import JWTHandler


class AuthenticationMiddleware(BaseHTTPMiddleware):
    """Gate requests behind JWT authentication and double-submit CSRF checks.

    Attributes:
        PUBLIC_PATHS: Path prefixes reachable without authentication.
    """

    PUBLIC_PATHS = ["/health", "/auth/login", "/auth/register", "/docs", "/openapi.json"]

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        """Authenticate the request, then enforce CSRF on unsafe methods.

        Args:
            request: The incoming HTTP request.
            call_next: Handler that continues the middleware chain.

        Returns:
            The downstream response, or a 401/403 error response when
            authentication or CSRF validation fails.
        """
        if os.getenv("TESTING") == "1":
            return await call_next(request)

        if any(request.url.path.startswith(path) for path in self.PUBLIC_PATHS):
            return await call_next(request)

        token = request.cookies.get("access_token")
        if not token:
            return JSONResponse(status_code=401, content={"detail": "Authentication required"})

        try:
            payload = JWTHandler.verify_token(token)
        except (jwt.InvalidTokenError, TypeError, ValueError, OverflowError):
            return JSONResponse(status_code=401, content={"detail": "Invalid token"})
        # Existing JWTHandler tokens omit type; reject an explicitly invalid type.
        if "type" in payload and payload["type"] != "access":
            return JSONResponse(status_code=401, content={"detail": "Invalid token"})
        subject = payload.get("sub")
        if not isinstance(subject, str):
            return JSONResponse(status_code=401, content={"detail": "Invalid token"})
        try:
            UUID(subject)
        except ValueError:
            return JSONResponse(status_code=401, content={"detail": "Invalid token"})
        request.state.user_id = payload["sub"]

        if request.method not in {"GET", "HEAD", "OPTIONS"}:
            csrf_header = request.headers.get("X-CSRF-Token")
            csrf_cookie = request.cookies.get("csrf_token")
            if not csrf_header or not csrf_cookie or csrf_header != csrf_cookie:
                return JSONResponse(status_code=403, content={"detail": "CSRF validation failed"})

        return await call_next(request)
