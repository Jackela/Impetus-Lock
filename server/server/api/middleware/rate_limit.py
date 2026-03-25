"""Rate limiting middleware for FastAPI."""

import os
from collections.abc import Awaitable, Callable

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from server.infrastructure.rate_limiting import limiter


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Apply rate limiting to all incoming requests.

    Uses the global rate limiter instance to check request limits
    based on endpoint and client identifier.

    Skips rate limiting for health check endpoints.
    """

    EXCLUDED_PATHS = {"/health", "/health/db", "/docs", "/openapi.json", "/redoc"}

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        """Process request with rate limiting.

        Args:
            request: Incoming request.
            call_next: Next middleware/handler in chain.

        Returns:
            Response from next handler.
        """
        # Skip rate limiting during tests
        if os.getenv("TESTING") == "1":
            return await call_next(request)

        path = request.url.path

        if any(path.startswith(excluded) for excluded in self.EXCLUDED_PATHS):
            return await call_next(request)

        await limiter.check_rate_limit(request)

        return await call_next(request)
