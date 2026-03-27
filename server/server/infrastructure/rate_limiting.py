"""API Rate limiting implementation with Redis backend."""

from __future__ import annotations

import os

from fastapi import HTTPException, Request

try:
    import redis.asyncio as redis
    from redis.asyncio import Redis as RedisClient

    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    redis = None
    RedisClient = None


class RateLimiter:
    """Rate limiter with optional Redis backend.

    Falls back to allowing all requests if Redis is not configured.
    Uses per-endpoint limits defined in ENDPOINT_LIMITS.

    Attributes:
        ENDPOINT_LIMITS: Mapping of path patterns to rate limit strings.
    """

    ENDPOINT_LIMITS = {
        "/intervention": "10/minute",
        "/style/analyze": "5/minute",
        "/auth/login": "5/minute",
        "/auth/register": "3/minute",
    }

    DEFAULT_LIMIT = "100/minute"

    def __init__(self, redis_url: str | None = None) -> None:
        """Initialize rate limiter with optional Redis connection.

        Args:
            redis_url: Redis connection URL. If None, uses REDIS_URL env var.
        """
        self._redis: RedisClient | None = None

        if not REDIS_AVAILABLE:
            return

        url = redis_url or os.getenv("REDIS_URL")
        if url:
            try:
                self._redis = redis.from_url(url)
            except Exception:
                # Redis connection failed - fall back to allowing all
                self._redis = None

    async def is_allowed(self, key: str, limit: str) -> bool:
        """Check if request is within rate limit.

        Args:
            key: Unique identifier for the rate limit bucket.
            limit: Rate limit string (e.g., "10/minute").

        Returns:
            bool: True if request is allowed, False if rate limited.
        """
        if not self._redis:
            # Allow all if Redis not configured
            return True

        count, window = self._parse_limit(limit)

        try:
            current: int = await self._redis.incr(key)

            if current == 1:
                await self._redis.expire(key, window)

            return current <= count
        except Exception:
            # Redis error - allow request to avoid blocking users
            return True

    def _parse_limit(self, limit: str) -> tuple[int, int]:
        """Parse limit string like '10/minute' to (count, seconds).

        Args:
            limit: Rate limit string in format "count/unit".

        Returns:
            tuple[int, int]: (count, window_seconds)
        """
        parts = limit.split("/")
        count = int(parts[0])

        units = {
            "second": 1,
            "seconds": 1,
            "minute": 60,
            "minutes": 60,
            "hour": 3600,
            "hours": 3600,
            "day": 86400,
            "days": 86400,
        }

        unit = parts[1] if len(parts) > 1 else "minute"
        window = units.get(unit, 60)  # default to minute
        return count, window

    def _get_client_id(self, request: Request) -> str:
        """Extract client identifier from request.

        Uses user_id if authenticated, otherwise falls back to IP address.

        Args:
            request: FastAPI request object.

        Returns:
            str: Client identifier for rate limiting.
        """
        # Use user ID if authenticated
        user_id = getattr(request.state, "user_id", None)
        if user_id:
            return str(user_id)

        # Fall back to IP address
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return str(forwarded.split(",")[0].strip())

        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return str(real_ip)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()

        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        return request.client.host if request.client else "unknown"

    async def check_rate_limit(self, request: Request) -> None:
        """Check rate limit for request and raise if exceeded.

        Args:
            request: FastAPI request object.

        Raises:
            HTTPException: 429 if rate limit exceeded.
        """
        path = request.url.path

        # Find matching limit pattern
        limit = self.DEFAULT_LIMIT
        for pattern, limit_value in self.ENDPOINT_LIMITS.items():
            if pattern in path:
                limit = limit_value
                break

        client_id = self._get_client_id(request)
        key = f"rate_limit:{path}:{client_id}"

        if not await self.is_allowed(key, limit):
            count, window = self._parse_limit(limit)
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded. Please try again later.",
                headers={"Retry-After": str(window)},
            )


# Global limiter instance
limiter = RateLimiter()
