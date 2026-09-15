"""Real-Redis integration tests for pub/sub collaboration and rate limiting.

These tests talk to an actual Redis server. They probe reachability once per
test via the ``real_redis`` fixture and skip cleanly when no server listens
at ``REDIS_URL`` (default ``redis://localhost:6379/0``). CI provides a Redis
service container, so the tests execute there.

Class names intentionally avoid the substrings "RedisIntegration" and
"redis_pubsub" so historical ``-k`` exclusion filters never match them.
"""

from __future__ import annotations

import asyncio
import json
import os
from collections.abc import AsyncGenerator
from typing import Any
from uuid import uuid4

import pytest
import pytest_asyncio
import redis.asyncio as redis_asyncio

from server.infrastructure.rate_limiting import RateLimiter
from server.infrastructure.websocket.redis_pubsub import RedisPubSubManager

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")


@pytest_asyncio.fixture
async def real_redis() -> AsyncGenerator[redis_asyncio.Redis, None]:
    """Provide a live Redis client, skipping tests when Redis is unreachable.

    Probes the server with a short PING so environments without Redis
    (e.g. local machines) skip these tests instead of hanging.

    Yields:
        Connected ``redis.asyncio.Redis`` client.
    """
    client = redis_asyncio.from_url(
        REDIS_URL,
        socket_connect_timeout=2.0,
        socket_timeout=2.0,
    )
    try:
        await asyncio.wait_for(client.ping(), timeout=2.0)
    except Exception as exc:
        await client.aclose()
        pytest.skip(f"Redis not reachable at {REDIS_URL}: {exc}")

    yield client
    await client.aclose()


class TestRealRedisCollaboration:
    """Cross-server pub/sub behavior against a real Redis server."""

    @pytest.mark.asyncio
    async def test_pubsub_roundtrip_delivers_published_message(
        self,
        real_redis: redis_asyncio.Redis,
    ) -> None:
        """Publishing JSON from another client reaches subscribed handlers."""
        channel = f"test:collab:{uuid4().hex}"
        manager = RedisPubSubManager(redis_url=REDIS_URL)

        received = asyncio.Event()
        received_data: dict[str, Any] = {}

        async def handler(data: dict[str, Any]) -> None:
            """Record the message payload delivered by the listener."""
            received_data.update(data)
            received.set()

        await manager.connect()
        await manager.subscribe(channel, handler)
        await manager.start_listening()
        try:
            message = {
                "type": "update",
                "room_id": "room_1",
                "content": "hello from another server",
            }
            subscribers = await real_redis.publish(channel, json.dumps(message))
            assert subscribers >= 1, "publish should deliver to our subscription"

            await asyncio.wait_for(received.wait(), timeout=5.0)
            assert received_data == message
        finally:
            await manager.disconnect()

        assert manager._running is False
        assert manager._redis is None


class TestRealRedisRateLimit:
    """Fixed-window rate limiting semantics against a real Redis server."""

    @pytest.mark.asyncio
    async def test_window_allows_up_to_limit_then_rejects(
        self,
        real_redis: redis_asyncio.Redis,
    ) -> None:
        """Requests within the limit pass; the next one is rejected."""
        key = f"test:ratelimit:{uuid4().hex}"
        limiter = RateLimiter(redis_url=REDIS_URL)

        # First 3 requests inside a "3/minute" window are allowed.
        for _ in range(3):
            assert await limiter.is_allowed(key, "3/minute") is True

        # The 4th request in the same window is rejected.
        assert await limiter.is_allowed(key, "3/minute") is False

        # The counter key carries a TTL matching the 60s window.
        ttl = await real_redis.ttl(key)
        assert 0 < ttl <= 60
