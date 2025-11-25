"""Tests for HTTP request logging middleware."""

from __future__ import annotations

from typing import Any, cast

from _pytest.logging import LogCaptureFixture
from fastapi.testclient import TestClient

from server.api.main import app


def test_http_request_logging_includes_basic_fields(caplog: LogCaptureFixture) -> None:
    client = TestClient(app)
    caplog.set_level("INFO")

    response = client.get("/health")
    assert response.status_code == 200

    record = next((rec for rec in caplog.records if rec.getMessage() == "http_request"), None)
    assert record is not None
    log_record = cast(Any, record)
    assert log_record.path == "/health"
    assert log_record.status_code == 200
    assert log_record.method == "GET"
    assert log_record.duration_ms >= 0


def test_http_exception_logs_real_status(caplog: LogCaptureFixture) -> None:
    client = TestClient(app)
    caplog.set_level("INFO")

    response = client.post("/api/v1/impetus/generate-intervention", json={})
    assert response.status_code == 422

    record = next(
        (
            rec
            for rec in caplog.records
            if rec.getMessage() == "http_request"
            and getattr(rec, "path", None) == "/api/v1/impetus/generate-intervention"
        ),
        None,
    )
    assert record is not None
    log_record = cast(Any, record)
    assert log_record.status_code == 422
