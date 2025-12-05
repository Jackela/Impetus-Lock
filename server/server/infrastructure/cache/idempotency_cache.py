"""Async-safe idempotency cache for preventing duplicate interventions.

Implements 15-second TTL in-memory cache for Idempotency-Key deduplication.
Prevents duplicate AI interventions when client retries due to network errors.

Constitutional Compliance:
- Article I (Simplicity): In-memory cache for P1 (no Redis/external dependency)
- Article V (Documentation): Complete Google-style docstrings
"""

from __future__ import annotations

import asyncio
import time
from typing import Any


class AsyncIdempotencyCache:
    """Async-friendly in-memory cache for idempotency key deduplication.

    Stores intervention responses keyed by Idempotency-Key header (UUID).
    Entries expire after 15 seconds (configurable TTL).
    Uses asyncio locks to avoid blocking the event loop.
    """

    def __init__(self, ttl: int = 15):
        self.ttl = ttl
        self._cache: dict[str, tuple[Any, float]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Any | None:
        """Retrieve cached response if not expired."""

        async with self._lock:
            entry = self._cache.get(key)
            if entry is None:
                return None

            response, expiry = entry
            if time.time() > expiry:
                self._cache.pop(key, None)
                return None

            return response

    async def set(self, key: str, response: Any) -> None:
        """Store response in cache with TTL expiry."""

        async with self._lock:
            expiry = time.time() + self.ttl
            self._cache[key] = (response, expiry)

    async def clear(self) -> None:
        """Clear all cached entries (useful for testing)."""

        async with self._lock:
            self._cache.clear()

    async def cleanup_expired(self) -> int:
        """Remove all expired entries from cache."""

        async with self._lock:
            current_time = time.time()
            expired_keys = [
                key for key, (_, expiry) in self._cache.items() if current_time > expiry
            ]
            for key in expired_keys:
                self._cache.pop(key, None)
            return len(expired_keys)
