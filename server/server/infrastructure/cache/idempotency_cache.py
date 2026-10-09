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
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any


class AsyncIdempotencyCache:
    """Async-friendly in-memory cache for idempotency key deduplication.

    Stores intervention responses keyed by the caller's scoped request identity.
    Entries expire after 15 seconds (configurable TTL).
    Entries remain valid at exact expiry and expire once time exceeds it.
    Writes reclaim all expired entries, including keys never read again.
    Uses asyncio locks to avoid blocking the event loop.
    """

    def __init__(self, ttl: int = 15):
        """Initialize the cache with a per-entry TTL.

        Args:
            ttl: Seconds until a cached entry expires.
        """
        self.ttl = ttl
        self._cache: dict[str, tuple[Any, float]] = {}
        self._lock = asyncio.Lock()
        self._flights: dict[str, tuple[asyncio.Lock, int]] = {}

    @asynccontextmanager
    async def serialize(self, key: str) -> AsyncIterator[None]:
        """Serialize work for one key within this process, releasing on every exit.

        Count holders and waiters so cancellation cannot orphan a lock or let a
        new caller bypass existing waiters. Idle locks are immediately reclaimed.
        """
        lock, users = self._flights.get(key, (asyncio.Lock(), 0))
        self._flights[key] = (lock, users + 1)
        try:
            async with lock:
                yield
        finally:
            _, users = self._flights[key]
            if users == 1:
                del self._flights[key]
            else:
                self._flights[key] = (lock, users - 1)

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
        """Remove expired entries and store response with a fresh TTL."""
        async with self._lock:
            current_time = time.time()
            expired_keys = [
                key for key, (_, expiry) in self._cache.items() if current_time > expiry
            ]
            for expired_key in expired_keys:
                self._cache.pop(expired_key, None)
            expiry = current_time + self.ttl
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
