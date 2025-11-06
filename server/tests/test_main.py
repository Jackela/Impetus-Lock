"""
Tests for main FastAPI application.

Article III (TDD): These tests drive the implementation of health endpoint.
"""

from fastapi.testclient import TestClient

from server.api.main import app

client = TestClient(app)


def test_health_endpoint_returns_200() -> None:
    """Test that health endpoint returns successful status code."""
    response = client.get("/health")
    assert response.status_code == 200


def test_health_endpoint_returns_correct_structure() -> None:
    """Test that health endpoint returns expected JSON structure."""
    response = client.get("/health")
    body = response.json()

    assert "status" in body
    assert "service" in body
    assert "version" in body


def test_health_endpoint_returns_correct_values() -> None:
    """Test that health endpoint returns expected values."""
    response = client.get("/health")
    body = response.json()

    assert body["status"] == "ok"
    assert body["service"] == "impetus-lock"
    assert body["version"] == "0.1.0"
