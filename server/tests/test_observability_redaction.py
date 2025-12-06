"""Ensure sensitive headers never appear in logs/metrics."""

from __future__ import annotations

from _pytest.logging import LogCaptureFixture
from _pytest.monkeypatch import MonkeyPatch
from fastapi.testclient import TestClient

from server.api.main import app
from server.infrastructure.cache.idempotency_cache import AsyncIdempotencyCache
from server.infrastructure.llm.provider_registry import ProviderRegistry


def test_byok_headers_never_logged(monkeypatch: MonkeyPatch, caplog: LogCaptureFixture) -> None:
    monkeypatch.setenv("LLM_ALLOW_DEBUG_PROVIDER", "1")
    monkeypatch.setenv("LLM_DEFAULT_PROVIDER", "debug")

    app.state.provider_registry = ProviderRegistry()
    app.state.provider_registry._allow_debug = True  # test hook
    app.state.idempotency_cache = AsyncIdempotencyCache(ttl=15)

    client = TestClient(app)
    caplog.set_level("DEBUG")

    response = client.post(
        "/impetus/generate-intervention",
        headers={
            "Idempotency-Key": "test",
            "X-Contract-Version": "2.0.0",
            "Content-Type": "application/json",
            "X-LLM-Provider": "debug",
            "X-LLM-Api-Key": "sk-secret",
        },
        json={
            "context": "他打开门，犹豫着要不要进去。",
            "mode": "muse",
            "client_meta": {
                "doc_version": 1,
                "selection_from": 0,
                "selection_to": 0,
            },
        },
    )

    assert response.status_code == 200

    recorded = "".join(record.getMessage() + str(record.__dict__) for record in caplog.records)
    assert "sk-secret" not in recorded
