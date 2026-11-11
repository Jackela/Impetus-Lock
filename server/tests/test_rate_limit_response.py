"""Rate-limit middleware behaviour: 429 contract, per-endpoint buckets, fail-open.

The 429 contract is asserted end-to-end through the middleware, plus the
fail-open warning that must be emitted when Redis is not configured or
unreachable.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from server.api.middleware.rate_limit import RateLimitMiddleware
from server.infrastructure import rate_limiting
from server.infrastructure.rate_limiting import RateLimiter, limiter

INTERVENTION_PATH = "/impetus/generate-intervention"
LOGGER_NAME = "server.infrastructure.rate_limiting"


class CountingRedis:
    """Minimal Redis double that counts increments per key."""

    def __init__(self) -> None:
        """Start with empty counters."""
        self.counters: dict[str, int] = {}

    async def incr(self, key: str) -> int:
        """Increment and return the counter for ``key``."""
        self.counters[key] = self.counters.get(key, 0) + 1
        return self.counters[key]

    async def expire(self, key: str, window: int) -> bool:
        """Pretend the window was applied."""
        return True


@pytest.fixture
def counting_redis(monkeypatch: pytest.MonkeyPatch) -> CountingRedis:
    """Give the global limiter a counting backend and enable enforcement."""
    monkeypatch.delenv("TESTING", raising=False)
    backend = CountingRedis()
    monkeypatch.setattr(limiter, "_redis", backend)
    return backend


@pytest.fixture
def client() -> Iterator[TestClient]:
    """App exposing the real intervention path plus an unlisted path."""
    app = FastAPI()
    app.add_middleware(RateLimitMiddleware)

    @app.post(INTERVENTION_PATH)
    def generate_intervention() -> dict[str, bool]:
        return {"ok": True}

    @app.post("/tasks/")
    def create_task() -> dict[str, bool]:
        return {"ok": True}

    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


def test_limit_response_preserves_status_and_retry_header(monkeypatch: pytest.MonkeyPatch) -> None:
    """An exhausted bucket responds with 429 and the retry policy."""
    monkeypatch.delenv("TESTING", raising=False)
    monkeypatch.setattr(
        limiter,
        "check_rate_limit",
        AsyncMock(
            side_effect=HTTPException(429, "Rate limit exceeded", headers={"Retry-After": "60"})
        ),
    )
    app = FastAPI()
    app.add_middleware(RateLimitMiddleware)
    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/limited")
    assert response.status_code == 429
    assert response.headers["Retry-After"] == "60"
    assert response.json() == {"detail": "Rate limit exceeded"}


def test_intervention_path_is_limited_after_ten_requests(
    client: TestClient, counting_redis: CountingRedis
) -> None:
    """The 11th request to /impetus/generate-intervention returns 429 + Retry-After."""
    for attempt in range(1, 11):
        allowed = client.post(INTERVENTION_PATH)
        assert allowed.status_code == 200, attempt

    limited = client.post(INTERVENTION_PATH)

    assert limited.status_code == 429
    assert limited.headers["Retry-After"] == "60"
    assert limited.json() == {"detail": "Rate limit exceeded. Please try again later."}
    assert counting_redis.counters == {f"rate_limit:{INTERVENTION_PATH}:testclient": 11}


def test_other_paths_keep_the_default_bucket(
    client: TestClient, counting_redis: CountingRedis
) -> None:
    """The intervention limit does not leak onto other endpoints."""
    for _ in range(10):
        assert client.post(INTERVENTION_PATH).status_code == 200

    for _ in range(11):
        assert client.post("/tasks/").status_code == 200

    assert counting_redis.counters[f"rate_limit:{INTERVENTION_PATH}:testclient"] == 10
    assert counting_redis.counters["rate_limit:/tasks/:testclient"] == 11


def test_mounted_intervention_route_matches_configured_limit() -> None:
    """The configured limit pattern is a real mounted route path."""
    from server.api.main import app as main_app

    mounted = set(main_app.openapi()["paths"])

    assert INTERVENTION_PATH in mounted
    assert INTERVENTION_PATH in RateLimiter.ENDPOINT_LIMITS


def test_missing_redis_url_warns_rate_limiting_is_fail_open(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    """No REDIS_URL keeps fail-open behaviour and logs the warning."""
    monkeypatch.delenv("REDIS_URL", raising=False)

    with caplog.at_level(logging.WARNING, logger=LOGGER_NAME):
        rate_limiter = RateLimiter(redis_url=None)

    warnings = [record.getMessage() for record in caplog.records]
    assert any("Rate limiting disabled / fail-open" in message for message in warnings), warnings
    assert rate_limiter._redis is None


@pytest.mark.asyncio
async def test_missing_redis_url_still_allows_requests(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    """The fail-open path keeps allowing every request."""
    monkeypatch.delenv("REDIS_URL", raising=False)

    with caplog.at_level(logging.WARNING, logger=LOGGER_NAME):
        rate_limiter = RateLimiter(redis_url=None)

    assert await rate_limiter.is_allowed("rate_limit:test", "10/minute") is True
    assert any("fail-open" in record.getMessage() for record in caplog.records)


@pytest.mark.skipif(
    not rate_limiting.REDIS_AVAILABLE, reason="redis client library is not installed"
)
def test_unreachable_redis_warns_rate_limiting_is_fail_open(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    """A failing Redis connection keeps fail-open behaviour and logs the warning."""

    def raise_connection_error(url: str) -> None:
        raise ConnectionError(f"cannot reach {url}")

    assert rate_limiting.redis is not None
    monkeypatch.setattr(rate_limiting.redis, "from_url", raise_connection_error)

    with caplog.at_level(logging.WARNING, logger=LOGGER_NAME):
        rate_limiter = RateLimiter(redis_url="redis://127.0.0.1:6390/0")

    messages = [record.getMessage() for record in caplog.records]
    assert rate_limiter._redis is None
    assert any("Rate limiting disabled / fail-open" in message for message in messages), messages
    assert any("cannot reach redis://127.0.0.1:6390/0" in message for message in messages), messages
