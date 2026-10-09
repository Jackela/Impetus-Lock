"""Unit tests for AsyncIdempotencyCache.

Validates async-safe TTL behavior, expiration, and concurrent access
without blocking the event loop.
"""

from __future__ import annotations

import asyncio

import pytest

from server.infrastructure.cache.idempotency_cache import AsyncIdempotencyCache

pytestmark = pytest.mark.anyio


async def test_set_and_get_basic() -> None:
    cache = AsyncIdempotencyCache(ttl=1)
    key = "test_key_001"
    payload = {"action": "provoke"}

    await cache.set(key, payload)
    assert await cache.get(key) == payload


async def test_get_expired_entry_returns_none() -> None:
    cache = AsyncIdempotencyCache(ttl=1)
    await cache.set("expire_test", {"data": "value"})
    await asyncio.sleep(1.1)

    assert await cache.get("expire_test") is None


async def test_set_removes_unvisited_expired_entries(monkeypatch: pytest.MonkeyPatch) -> None:
    """Writing a fresh key reclaims expired entries while preserving live responses."""
    now = 1000.0
    monkeypatch.setattr("server.infrastructure.cache.idempotency_cache.time.time", lambda: now)
    cache = AsyncIdempotencyCache(ttl=15)
    await cache.set("unvisited", {"action": "provoke"})

    now = 1005.0
    await cache.set("live", {"action": "rewrite"})

    now = 1016.0
    await cache.set("fresh", {"action": "delete"})

    assert await cache.get("live") == {"action": "rewrite"}
    assert await cache.get("fresh") == {"action": "delete"}
    # Do not read the expired key: get() would hide a missing automatic cleanup.
    assert await cache.cleanup_expired() == 0


async def test_clear_removes_all_entries() -> None:
    cache = AsyncIdempotencyCache(ttl=2)
    await cache.set("k1", {"a": 1})
    await cache.set("k2", {"b": 2})

    await cache.clear()

    assert await cache.get("k1") is None
    assert await cache.get("k2") is None


async def test_cleanup_expired_counts_removed(monkeypatch: pytest.MonkeyPatch) -> None:
    now = 1000.0
    monkeypatch.setattr("server.infrastructure.cache.idempotency_cache.time.time", lambda: now)
    cache = AsyncIdempotencyCache(ttl=1)
    await cache.set("k1", 1)
    await cache.set("k2", 2)
    now = 1000.5
    await cache.set("fresh", 3)
    now = 1001.1

    removed = await cache.cleanup_expired()

    assert removed == 2
    assert await cache.get("fresh") == 3
    assert await cache.get("k1") is None


async def test_set_preserves_replacement_until_after_ttl_boundary(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Replacement renews TTL; get, set, and cleanup retain entries at exact expiry."""
    now = 1000.0
    monkeypatch.setattr("server.infrastructure.cache.idempotency_cache.time.time", lambda: now)
    cache = AsyncIdempotencyCache(ttl=15)
    await cache.set("replaced", {"version": 1})

    now = 1005.0
    await cache.set("replaced", {"version": 2})
    now = 1016.0
    await cache.set("fresh", {})
    assert await cache.get("replaced") == {"version": 2}

    now = 1020.0
    await cache.set("boundary", {})
    assert await cache.cleanup_expired() == 0
    assert await cache.get("replaced") == {"version": 2}

    now = 1020.1
    await cache.set("after_boundary", {})
    assert await cache.cleanup_expired() == 0
    assert await cache.get("replaced") is None


async def test_concurrent_access_is_safe() -> None:
    cache = AsyncIdempotencyCache(ttl=2)
    await cache.set("shared", {"v": 1})

    async def reader() -> dict[str, int] | None:
        return await cache.get("shared")

    async def writer() -> dict[str, int] | None:
        await cache.set("shared", {"v": 2})
        return await cache.get("shared")

    results = await asyncio.gather(*(reader() for _ in range(5)), writer())

    assert any(r == {"v": 2} for r in results)
    assert all(r in ({"v": 1}, {"v": 2}) for r in results)


async def test_large_payload_round_trip() -> None:
    cache = AsyncIdempotencyCache(ttl=2)
    payload = {"content": "x" * 5000, "meta": list(range(100))}
    await cache.set("large", payload)

    assert await cache.get("large") == payload
