"""API Contract Tests for Intervention Endpoint.

Tests POST /api/v1/impetus/generate-intervention endpoint.
Validates request/response contract, idempotency, and error handling.

Constitutional Compliance:
- Article III (TDD): Tests written BEFORE implementation (RED phase)
- Article V (Documentation): Google-style docstrings for all test functions

Expected Initial State: All tests FAIL (endpoint not implemented yet)
"""

from collections.abc import Generator
from contextlib import ExitStack
from datetime import UTC, datetime
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from server.api.main import app
from server.api.routes import intervention as intervention_module
from server.domain.models.anchor import AnchorPos, AnchorRange
from server.domain.models.intervention import InterventionResponse

client = TestClient(app)

# Test fixtures
VALID_MUSE_REQUEST = {
    "context": "他打开门，犹豫着要不要进去。",
    "mode": "muse",
    "client_meta": {"doc_version": 42, "selection_from": 1234, "selection_to": 1234},
}

VALID_LOKI_REQUEST = {
    "context": "他打开门，犹豫着要不要进去。突然，门后传来脚步声。",
    "mode": "loki",
    "client_meta": {"doc_version": 43, "selection_from": 1310, "selection_to": 1310},
}

REQUIRED_HEADERS = {
    "Idempotency-Key": "550e8400-e29b-41d4-a716-446655440000",
    "X-Contract-Version": "1.0.1",
}


@pytest.fixture(autouse=True)
def mock_llm_provider() -> Generator[None, None, None]:
    """Mock the LLM provider to avoid real API calls in tests.

    Returns a mock InterventionResponse for Muse mode requests.
    Auto-used for all tests in this module.
    """
    mock_response = InterventionResponse(
        action="provoke",
        content="他打开门，看到...",
        lock_id="lock_test_001",
        anchor=AnchorPos(from_=1234),
        action_id="act_test_001",
        issued_at=datetime.now(UTC),
        source="muse",
    )

    mock_paths = [
        "server.infrastructure.llm.instructor_provider.InstructorLLMProvider.generate_intervention",
        "server.infrastructure.llm.anthropic_provider.AnthropicLLMProvider.generate_intervention",
        "server.infrastructure.llm.gemini_provider.GeminiLLMProvider.generate_intervention",
    ]

    with ExitStack() as stack:
        for mock_path in mock_paths:
            stack.enter_context(patch(mock_path, return_value=mock_response))
        yield


class TestInterventionAPIContract:
    """Test suite for intervention API contract compliance."""

    def test_muse_mode_returns_provoke_with_lock_id(self) -> None:
        """Test that Muse mode request returns provoke action with lock_id.

        Muse mode should ONLY return provoke actions (no delete).
        Response must include content and lock_id fields.

        Expected (RED): 404 Not Found (endpoint not implemented)
        """
        response = client.post(
            "/api/v1/impetus/generate-intervention",
            json=VALID_MUSE_REQUEST,
            headers=REQUIRED_HEADERS,
        )

        assert response.status_code == 200
        data = response.json()

        # Validate response structure
        assert data["action"] == "provoke"
        assert "content" in data
        assert isinstance(data["content"], str)
        assert len(data["content"]) > 0
        assert "lock_id" in data
        assert data["lock_id"].startswith("lock_")
        assert "anchor" in data
        assert "action_id" in data
        assert data["action_id"].startswith("act_")
        assert "issued_at" in data
        assert data["source"] == "muse"

    def test_loki_mode_returns_provoke_or_delete(self) -> None:
        """Test that Loki mode request returns provoke/delete/rewrite action.

        Loki mode can return:
        - provoke: with content + lock_id
        - rewrite: with content + lock_id
        - delete: with anchor (no content/lock_id)

        Expected (RED): 404 Not Found (endpoint not implemented)
        """
        response = client.post(
            "/api/v1/impetus/generate-intervention",
            json=VALID_LOKI_REQUEST,
            headers=REQUIRED_HEADERS,
        )

        assert response.status_code == 200
        data = response.json()

        # Validate action is one of the allowed values
        assert data["action"] in ["provoke", "delete", "rewrite"]

        if data["action"] in ["provoke", "rewrite"]:
            assert "content" in data
            assert "lock_id" in data
        elif data["action"] == "delete":
            assert "anchor" in data
            # content and lock_id should be null for delete
            assert data.get("content") is None
            assert data.get("lock_id") is None

        assert "action_id" in data
        assert "issued_at" in data
        assert data["source"] in ["muse", "loki"]

    def test_idempotency_same_key_returns_cached_response(self) -> None:
        """Test that requests with same Idempotency-Key return cached response.

        Within 15s window, duplicate requests should return identical response.

        Expected (RED): 404 Not Found (endpoint not implemented)
        """
        idempotency_key = "test-key-12345"
        headers = {"Idempotency-Key": idempotency_key, "X-Contract-Version": "1.0.1"}

        # First request
        response1 = client.post(
            "/api/v1/impetus/generate-intervention", json=VALID_MUSE_REQUEST, headers=headers
        )

        assert response1.status_code == 200
        data1 = response1.json()

        # Second request with same key (within 15s)
        response2 = client.post(
            "/api/v1/impetus/generate-intervention", json=VALID_MUSE_REQUEST, headers=headers
        )

        assert response2.status_code == 200
        data2 = response2.json()

        # Responses should be identical (cached)
        assert data1["action_id"] == data2["action_id"]
        assert data1["action"] == data2["action"]
        assert data1["source"] == data2["source"]
        if data1["action"] == "provoke":
            assert data1["lock_id"] == data2["lock_id"]

    def test_invalid_mode_returns_422(self) -> None:
        """Test that invalid mode value returns 422 Unprocessable Entity.

        Mode must be 'muse' or 'loki' only.

        Expected (RED): 404 Not Found (endpoint not implemented)
        """
        invalid_request = {
            **VALID_MUSE_REQUEST,
            "mode": "chaos",  # Invalid mode
        }

        response = client.post(
            "/api/v1/impetus/generate-intervention", json=invalid_request, headers=REQUIRED_HEADERS
        )

        assert response.status_code == 422
        data = response.json()
        assert "error" in data or "detail" in data

    def test_missing_idempotency_key_returns_422(self) -> None:
        """Test that missing Idempotency-Key header returns 422.

        Idempotency-Key is required per OpenAPI contract.

        Expected (RED): 404 Not Found (endpoint not implemented)
        """
        headers = {
            "X-Contract-Version": "1.0.1"
            # Missing Idempotency-Key
        }

        response = client.post(
            "/api/v1/impetus/generate-intervention", json=VALID_MUSE_REQUEST, headers=headers
        )

        assert response.status_code == 422

    def test_rewrite_action_contract(self) -> None:
        """Ensure rewrite responses include content + lock id."""
        rewrite_response = InterventionResponse(
            action="rewrite",
            content="改写后的句子",
            lock_id="lock_rewrite",
            anchor=AnchorRange(from_=180, to=210),
            action_id="act_rewrite_case",
            issued_at=datetime.now(UTC),
            source="muse",
        )
        mock_path = (
            "server.infrastructure.llm.instructor_provider."
            "InstructorLLMProvider.generate_intervention"
        )

        headers = {
            "Idempotency-Key": "rewrite-key-12345",
            "X-Contract-Version": "1.0.1",
        }

        with patch(mock_path, return_value=rewrite_response):
            response = client.post(
                "/api/v1/impetus/generate-intervention",
                json=VALID_MUSE_REQUEST,
                headers=headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "rewrite"
        assert isinstance(data["content"], str)
        assert data["lock_id"].startswith("lock")
        assert data["source"] == "muse"

    def test_missing_contract_version_returns_422(self) -> None:
        """Test that missing X-Contract-Version header returns 422.

        X-Contract-Version is required per OpenAPI contract.

        Expected (RED): 404 Not Found (endpoint not implemented)
        """
        headers = {
            "Idempotency-Key": "550e8400-e29b-41d4-a716-446655440000"
            # Missing X-Contract-Version
        }

        response = client.post(
            "/api/v1/impetus/generate-intervention", json=VALID_MUSE_REQUEST, headers=headers
        )

        assert response.status_code == 422

    def test_empty_context_returns_422(self) -> None:
        """Test that empty context returns 422.

        Context must be non-empty per schema validation.

        Expected (RED): 404 Not Found (endpoint not implemented)
        """
        invalid_request = {
            **VALID_MUSE_REQUEST,
            "context": "",  # Empty context
        }

        response = client.post(
            "/api/v1/impetus/generate-intervention", json=invalid_request, headers=REQUIRED_HEADERS
        )

        assert response.status_code == 422

    def test_missing_llm_key_returns_503(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """API should raise 503 when no server key and no BYOK override."""

        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        intervention_module._provider_registry.reload()
        intervention_module._intervention_service = None

        headers = {
            **REQUIRED_HEADERS,
            "Idempotency-Key": "missing-llm-key",
        }

        response = client.post(
            "/api/v1/impetus/generate-intervention",
            json=VALID_MUSE_REQUEST,
            headers=headers,
        )

        assert response.status_code == 503
        assert response.json()["code"] == "llm_not_configured"

        monkeypatch.setenv("OPENAI_API_KEY", "test-key-for-unit-tests")
        intervention_module._provider_registry.reload()
        intervention_module._intervention_service = None

    def test_byok_override_invokes_endpoint(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """User supplied headers should enable Anthropic without server env."""

        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        intervention_module._provider_registry.reload()
        intervention_module._intervention_service = None

        headers = {
            **REQUIRED_HEADERS,
            "Idempotency-Key": "anthropic-byok",
            "X-LLM-Provider": "anthropic",
            "X-LLM-Api-Key": "sk-ant-test",
            "X-LLM-Model": "claude-3-5-haiku-latest",
        }

        response = client.post(
            "/api/v1/impetus/generate-intervention",
            json=VALID_MUSE_REQUEST,
            headers=headers,
        )

        assert response.status_code == 200
        assert response.json()["source"] == "muse"

        monkeypatch.setenv("OPENAI_API_KEY", "test-key-for-unit-tests")
        intervention_module._provider_registry.reload()
        intervention_module._intervention_service = None
