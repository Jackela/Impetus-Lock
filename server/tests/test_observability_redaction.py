"""Ensure sensitive headers never appear in request logs."""

from __future__ import annotations

import logging
from uuid import uuid4

from _pytest.logging import LogCaptureFixture
from _pytest.monkeypatch import MonkeyPatch


def test_byok_headers_never_logged(monkeypatch: MonkeyPatch, caplog: LogCaptureFixture) -> None:
    """Test that sensitive API keys don't appear in logs."""
    from fastapi.testclient import TestClient

    from server.api.main import app
    from server.infrastructure.cache.idempotency_cache import AsyncIdempotencyCache
    from server.infrastructure.llm.provider_registry import ProviderRegistry
    from server.infrastructure.persistence.database import get_session_optional

    for variable in ("OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY"):
        monkeypatch.delenv(variable, raising=False)
    monkeypatch.setenv("LLM_ALLOW_DEBUG_PROVIDER", "1")
    monkeypatch.setenv("LLM_DEFAULT_PROVIDER", "debug")
    # A no-task intervention can run without a database. Keep the actual
    # middleware, dependency chain, logging and provider resolution active.
    monkeypatch.setitem(app.dependency_overrides, get_session_optional, lambda: None)
    monkeypatch.setattr(app.state, "provider_registry", ProviderRegistry(), raising=False)
    monkeypatch.setattr(
        app.state, "idempotency_cache", AsyncIdempotencyCache(ttl=15), raising=False
    )

    root = logging.getLogger()
    # Importing the real app configures root logging and can replace pytest's
    # handler when this test is run alone or first on an xdist worker.
    if caplog.handler not in root.handlers:
        monkeypatch.setattr(root, "handlers", [*root.handlers, caplog.handler])
    caplog.set_level(logging.DEBUG)

    secret = f"byok-redaction-fixture-{uuid4()}"
    client = TestClient(app)
    response = client.post(
        "/impetus/generate-intervention",
        headers={
            "Idempotency-Key": "test",
            "X-Contract-Version": "2.0.0",
            "Content-Type": "application/json",
            "X-LLM-Provider": "debug",
            "X-LLM-Api-Key": secret,
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
    assert any(record.getMessage() == "Resolved LLM provider" for record in caplog.records)
    assert any(
        record.getMessage() == "http_request"
        and record.__dict__.get("llm_provider") == "debug"
        and record.__dict__.get("llm_override") is True
        and record.__dict__.get("path") == "/impetus/generate-intervention"
        for record in caplog.records
    )

    recorded = "".join(record.getMessage() + str(record.__dict__) for record in caplog.records)
    assert secret not in recorded
