"""Ensure Prometheus metrics endpoint works."""

from __future__ import annotations

from _pytest.monkeypatch import MonkeyPatch
from fastapi.testclient import TestClient

from server.api.main import app
from server.infrastructure.observability import metrics as metrics_module


def test_metrics_endpoint_returns_payload(monkeypatch: MonkeyPatch) -> None:
    # Enable metrics for the test explicitly
    monkeypatch.setattr(metrics_module, "ENABLE_PROM_METRICS", True)
    client = TestClient(app)

    response = client.get("/metrics")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")
    assert b"# HELP" in response.content
