"""Verify rate-limit middleware returns a client error rather than a server error."""

from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from server.api.middleware.rate_limit import RateLimitMiddleware
from server.infrastructure.rate_limiting import limiter


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
