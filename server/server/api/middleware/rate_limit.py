"""Rate limiting middleware for FastAPI."""

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from server.infrastructure.rate_limiting import limiter


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Apply rate limiting to all incoming requests.

    Uses the global rate limiter instance to check request limits
    based on endpoint and client identifier.

    Skips rate limiting for health check endpoints.
    """

    # Paths that should not be rate limited
    EXCLUDED_PATHS = {"/health", "/health/db", "/docs", "/openapi.json", "/redoc"}

    async def dispatch(self, request: Request, call_next):
        """Process request with rate limiting.

        Args:
            request: Incoming request.
            call_next: Next middleware/handler in chain.

        Returns:
            Response from next handler.
        """
        path = request.url.path

        # Skip rate limiting for excluded paths
        if any(path.startswith(excluded) for excluded in self.EXCLUDED_PATHS):
            return await call_next(request)

        # Check rate limit
        await limiter.check_rate_limit(request)

        return await call_next(request)
