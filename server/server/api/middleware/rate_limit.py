"""Rate limiting middleware for API endpoints.

Implements simple in-memory rate limiting based on configuration in .env:
- RATE_LIMIT_DEFAULT: Default rate limit for all endpoints (e.g., "100/minute")
- RATE_LIMIT_INTERVENTION: Specific rate limit for /impetus/* endpoints (e.g., "10/minute")

For production with multiple instances, replace with Redis-based rate limiting.
"""

import logging
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from threading import Lock

from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("server.api.middleware.rate_limit")


@dataclass
class RateLimitConfig:
    """Rate limit configuration parsed from .env."""

    requests: int
    window_seconds: int

    @classmethod
    def from_string(cls, value: str) -> "RateLimitConfig":
        """Parse rate limit string like '100/minute' or '10/second'."""
        parts = value.split("/")
        if len(parts) != 2:
            raise ValueError(f"Invalid rate limit format: {value}")
        requests = int(parts[0])
        unit = parts[1].lower()
        if unit == "second":
            window = 1
        elif unit == "minute":
            window = 60
        elif unit == "hour":
            window = 3600
        else:
            raise ValueError(f"Unknown time unit: {unit}")
        return cls(requests=requests, window_seconds=window)


@dataclass
class RateLimitEntry:
    """Tracks request timestamps for a single client."""

    timestamps: list[float]


class InMemoryRateLimiter:
    """Thread-safe in-memory rate limiter using sliding window."""

    def __init__(self, config: RateLimitConfig):
        self.config = config
        self._clients: dict[str, RateLimitEntry] = {}
        self._lock = Lock()

    def is_allowed(self, client_id: str) -> bool:
        """Check if request is allowed for given client."""
        now = time.time()
        window_start = now - self.config.window_seconds

        with self._lock:
            entry = self._clients.get(client_id)
            if entry is None:
                entry = RateLimitEntry(timestamps=[])
                self._clients[client_id] = entry

            entry.timestamps = [ts for ts in entry.timestamps if ts > window_start]

            if len(entry.timestamps) >= self.config.requests:
                return False

            entry.timestamps.append(now)
            return True

    def get_retry_after(self, client_id: str) -> int:
        """Get seconds until client can retry."""
        with self._lock:
            entry = self._clients.get(client_id)
            if entry is None or not entry.timestamps:
                return 0
            oldest = min(entry.timestamps)
            window_end = oldest + self.config.window_seconds
            return max(1, int(window_end - time.time()))


def get_client_id(request: Request) -> str:
    """Extract client identifier from request."""
    forwarded: str | None = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware for rate limiting."""

    def __init__(
        self,
        app: FastAPI,
        default_limit: RateLimitConfig,
        intervention_limit: RateLimitConfig | None = None,
    ):
        super().__init__(app)
        self.default_limiter = InMemoryRateLimiter(default_limit)
        self.intervention_limiter = (
            InMemoryRateLimiter(intervention_limit) if intervention_limit else None
        )

    def _get_limiter(self, request: Request) -> InMemoryRateLimiter:
        """Get appropriate limiter based on endpoint."""
        if self.intervention_limiter and request.url.path.startswith("/impetus"):
            return self.intervention_limiter
        return self.default_limiter

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        """Process request with rate limiting."""
        if request.url.path in ["/health", "/metrics"]:
            return await call_next(request)

        limiter = self._get_limiter(request)
        client_id = get_client_id(request)

        if not limiter.is_allowed(client_id):
            retry_after = limiter.get_retry_after(client_id)
            logger.warning(f"Rate limit exceeded for client {client_id}")
            return Response(
                content='{"error":"Rate limit exceeded"}',
                status_code=429,
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(limiter.config.requests),
                    "X-RateLimit-Remaining": "0",
                },
                media_type="application/json",
            )

        response = await call_next(request)

        with limiter._lock:
            entry = limiter._clients.get(client_id)
            current_count = len(entry.timestamps) if entry else 0

        remaining = limiter.config.requests - current_count
        response.headers["X-RateLimit-Limit"] = str(limiter.config.requests)
        response.headers["X-RateLimit-Remaining"] = str(max(0, remaining))

        return response


def create_rate_limit_middleware() -> (
    tuple[type[RateLimitMiddleware], RateLimitConfig, RateLimitConfig] | None
):
    """Create rate limit middleware config from environment.

    Returns tuple of (middleware_class, default_config, intervention_config)
    for use with app.add_middleware().
    """
    import os

    default_str = os.getenv("RATE_LIMIT_DEFAULT", "100/minute")
    intervention_str = os.getenv("RATE_LIMIT_INTERVENTION", "10/minute")

    try:
        default_config = RateLimitConfig.from_string(default_str)
        intervention_config = RateLimitConfig.from_string(intervention_str)
    except ValueError as e:
        logger.warning(f"Invalid rate limit config: {e}. Rate limiting disabled.")
        return None

    logger.info(f"Rate limiting enabled: default={default_str}, intervention={intervention_str}")
    return RateLimitMiddleware, default_config, intervention_config
