"""API Contract Tests for Intervention Endpoint.

Tests POST /impetus/generate-intervention endpoint.
Validates request/response contract, idempotency, and error handling.

Constitutional Compliance:
- Article III (TDD): Tests written BEFORE implementation (RED phase)
- Article V (Documentation): Google-style docstrings for all test functions

Expected Initial State: All tests FAIL (endpoint not implemented yet)
"""

from collections.abc import Generator
from contextlib import ExitStack
from dataclasses import dataclass, field
from datetime import UTC, datetime
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from server.api.main import app
from server.api.routes import intervention as intervention_module
from server.domain.errors import LLMProviderError
from server.domain.models.anchor import AnchorPos, AnchorRange
from server.domain.models.intervention import InterventionResponse
from server.infrastructure.llm.provider_registry import (
    ProviderConfig,
    ProviderRegistry,
)
from tests.utils.mock_factories import CloseSpyProvider

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
    "X-Contract-Version": "2.0.0",
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
        "server.infrastructure.llm.debug_provider.DebugLLMProvider.generate_intervention",
        "server.infrastructure.llm.instructor_provider.InstructorLLMProvider.generate_intervention",
        "server.infrastructure.llm.anthropic_provider.AnthropicLLMProvider.generate_intervention",
        "server.infrastructure.llm.gemini_provider.GeminiLLMProvider.generate_intervention",
    ]

    with ExitStack() as stack:
        for mock_path in mock_paths:
            stack.enter_context(patch(mock_path, return_value=mock_response))
        yield


@dataclass
class SpyRegistryHarness:
    """Wires a ProviderRegistry to build CloseSpyProvider instances.

    Attributes:
        registry: Registry installed on app.state for the test.
        created: Every spy built by the patched instantiation, in order.
        fail_on_close: Make subsequently built spies raise on close().
        generate_error: Make subsequently built spies raise on generate.
    """

    registry: ProviderRegistry
    created: list[CloseSpyProvider] = field(default_factory=list)
    fail_on_close: bool = False
    generate_error: Exception | None = None


@pytest.fixture()
def spy_registry(monkeypatch: pytest.MonkeyPatch) -> Generator[SpyRegistryHarness, None, None]:
    """Install a registry whose built providers are close-spy fakes.

    The registry logic (caching, is_cached) stays real; only provider
    instantiation is replaced so tests can observe close() calls.
    """
    registry = ProviderRegistry()
    harness = SpyRegistryHarness(registry=registry)

    def fake_instantiate(config: ProviderConfig) -> CloseSpyProvider:
        spy = CloseSpyProvider(
            fail_on_close=harness.fail_on_close,
            generate_error=harness.generate_error,
        )
        harness.created.append(spy)
        return spy

    monkeypatch.setattr(registry, "_instantiate", fake_instantiate)
    app.state.provider_registry = registry
    yield harness
    app.state.provider_registry = ProviderRegistry()


class TestInterventionAPIContract:
    """Test suite for intervention API contract compliance."""

    def test_muse_mode_returns_provoke_with_lock_id(self) -> None:
        """Test that Muse mode request returns provoke action with lock_id.

        Muse mode should ONLY return provoke actions (no delete).
        Response must include content and lock_id fields.

        Expected (RED): 404 Not Found (endpoint not implemented)
        """
        response = client.post(
            "/impetus/generate-intervention",
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
            "/impetus/generate-intervention",
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
        headers = {"Idempotency-Key": idempotency_key, "X-Contract-Version": "2.0.0"}

        # First request
        response1 = client.post(
            "/impetus/generate-intervention", json=VALID_MUSE_REQUEST, headers=headers
        )

        assert response1.status_code == 200
        data1 = response1.json()

        # Second request with same key (within 15s)
        response2 = client.post(
            "/impetus/generate-intervention", json=VALID_MUSE_REQUEST, headers=headers
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
            "/impetus/generate-intervention", json=invalid_request, headers=REQUIRED_HEADERS
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
            "X-Contract-Version": "2.0.0"
            # Missing Idempotency-Key
        }

        response = client.post(
            "/impetus/generate-intervention", json=VALID_MUSE_REQUEST, headers=headers
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
        # Patch debug provider since LLM_DEFAULT_PROVIDER=debug in conftest
        mock_path = (
            "server.infrastructure.llm.debug_provider.DebugLLMProvider.generate_intervention"
        )

        headers = {
            "Idempotency-Key": "rewrite-key-12345",
            "X-Contract-Version": "2.0.0",
        }

        with patch(mock_path, return_value=rewrite_response):
            response = client.post(
                "/impetus/generate-intervention",
                json=VALID_MUSE_REQUEST,
                headers=headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "rewrite"
        assert isinstance(data["content"], str)
        assert data["lock_id"].startswith("lock")
        assert data["source"] == "muse"

    def test_missing_contract_version_rejected(self) -> None:
        """Missing X-Contract-Version should be rejected."""

        headers = {
            "Idempotency-Key": "550e8400-e29b-41d4-a716-446655440000",
        }

        response = client.post(
            "/impetus/generate-intervention", json=VALID_MUSE_REQUEST, headers=headers
        )

        assert response.status_code == 422
        assert response.json()["detail"]["error"] == "ContractVersionMismatch"

    def test_contract_version_mismatch_rejected(self) -> None:
        """Any mismatch should return 422."""

        headers = {
            "Idempotency-Key": "550e8400-e29b-41d4-a716-446655440000",
            "X-Contract-Version": "1.0.1",
        }

        response = client.post(
            "/impetus/generate-intervention", json=VALID_MUSE_REQUEST, headers=headers
        )

        assert response.status_code == 422
        assert response.json()["detail"]["error"] == "ContractVersionMismatch"

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
            "/impetus/generate-intervention", json=invalid_request, headers=REQUIRED_HEADERS
        )

        assert response.status_code == 422

    def test_missing_llm_key_returns_503(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """API should raise 503 when no server key and no BYOK override."""

        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        monkeypatch.delenv("LLM_DEFAULT_PROVIDER", raising=False)
        monkeypatch.delenv("LLM_ALLOW_DEBUG_PROVIDER", raising=False)
        app.state.provider_registry = ProviderRegistry()

        headers = {
            **REQUIRED_HEADERS,
            "Idempotency-Key": "missing-llm-key",
        }

        response = client.post(
            "/impetus/generate-intervention",
            json=VALID_MUSE_REQUEST,
            headers=headers,
        )

        assert response.status_code == 503
        assert response.json()["code"] == "llm_not_configured"

        monkeypatch.setenv("OPENAI_API_KEY", "test-key-for-unit-tests")
        app.state.provider_registry = ProviderRegistry()

    def test_byok_override_invokes_endpoint(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """User supplied headers should enable Anthropic without server env."""

        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        app.state.provider_registry = ProviderRegistry()

        headers = {
            **REQUIRED_HEADERS,
            "Idempotency-Key": "anthropic-byok",
            "X-LLM-Provider": "anthropic",
            "X-LLM-Api-Key": "sk-ant-test",
            "X-LLM-Model": "claude-3-5-haiku-latest",
        }

        response = client.post(
            "/impetus/generate-intervention",
            json=VALID_MUSE_REQUEST,
            headers=headers,
        )

        assert response.status_code == 200
        assert response.json()["source"] == "muse"

        monkeypatch.setenv("OPENAI_API_KEY", "test-key-for-unit-tests")
        app.state.provider_registry = ProviderRegistry()

    def test_persists_action_when_repository_available(self) -> None:
        """Intervention responses should be persisted when repo is available."""

        from server.infrastructure.persistence.in_memory_task_repository import (
            InMemoryTaskRepository,
        )

        captured_repo = InMemoryTaskRepository()

        async def override_repo() -> InMemoryTaskRepository:
            return captured_repo

        app.dependency_overrides[intervention_module.get_task_repository] = override_repo

        headers = {
            **REQUIRED_HEADERS,
            "X-Task-Id": "550e8400-e29b-41d4-a716-446655440000",
            "Idempotency-Key": "task-persistence-unique",
        }

        response = client.post(
            "/impetus/generate-intervention",
            json=VALID_MUSE_REQUEST,
            headers=headers,
        )

        assert response.status_code == 200

        actions = captured_repo._actions  # noqa: SLF001
        assert len(actions) == 1
        stored_actions = list(actions.values())[0]
        assert len(stored_actions) == 1
        assert stored_actions[0].task_id.hex == "550e8400e29b41d4a716446655440000"

        app.dependency_overrides.pop(intervention_module.get_task_repository, None)


class TestProviderTeardown:
    """Covers per-request release of non-cached (BYOK) providers."""

    def test_byok_provider_closed_exactly_once(self, spy_registry: SpyRegistryHarness) -> None:
        """A BYOK (api_key override) provider must be closed exactly once."""

        headers = {
            **REQUIRED_HEADERS,
            "Idempotency-Key": "byok-close-once",
            "X-LLM-Provider": "anthropic",
            "X-LLM-Api-Key": "sk-ant-test",
        }

        response = client.post(
            "/impetus/generate-intervention",
            json=VALID_MUSE_REQUEST,
            headers=headers,
        )

        assert response.status_code == 200
        # First spy = cached default provider (dependency resolution),
        # second spy = per-request BYOK provider built inside the endpoint.
        assert len(spy_registry.created) == 2
        default_spy, byok_spy = spy_registry.created
        assert byok_spy.close_calls == 1
        assert default_spy.close_calls == 0

    def test_cached_provider_not_closed(self, spy_registry: SpyRegistryHarness) -> None:
        """A request without overrides reuses the shared cached provider, never closing it."""

        headers = {
            **REQUIRED_HEADERS,
            "Idempotency-Key": "cached-provider-no-close",
        }

        response = client.post(
            "/impetus/generate-intervention",
            json=VALID_MUSE_REQUEST,
            headers=headers,
        )

        assert response.status_code == 200
        assert len(spy_registry.created) == 1
        assert spy_registry.created[0].close_calls == 0

    def test_byok_close_failure_does_not_affect_response(
        self,
        spy_registry: SpyRegistryHarness,
    ) -> None:
        """A provider close() failure must be suppressed and not break the response."""

        spy_registry.fail_on_close = True
        headers = {
            **REQUIRED_HEADERS,
            "Idempotency-Key": "byok-close-failure",
            "X-LLM-Provider": "anthropic",
            "X-LLM-Api-Key": "sk-ant-test",
        }

        response = client.post(
            "/impetus/generate-intervention",
            json=VALID_MUSE_REQUEST,
            headers=headers,
        )

        assert response.status_code == 200
        assert response.json()["source"] == "muse"
        byok_spy = spy_registry.created[-1]
        assert byok_spy.close_calls == 1

    def test_byok_provider_closed_on_error_exit(
        self,
        spy_registry: SpyRegistryHarness,
    ) -> None:
        """The per-request BYOK provider must also be closed when generation fails."""

        spy_registry.generate_error = LLMProviderError(
            code="llm_api_error",
            message="boom",
            status_code=502,
            provider="anthropic",
        )
        headers = {
            **REQUIRED_HEADERS,
            "Idempotency-Key": "byok-error-exit-close",
            "X-LLM-Provider": "anthropic",
            "X-LLM-Api-Key": "sk-ant-test",
        }

        response = client.post(
            "/impetus/generate-intervention",
            json=VALID_MUSE_REQUEST,
            headers=headers,
        )

        assert response.status_code == 502
        byok_spy = spy_registry.created[-1]
        assert byok_spy.close_calls == 1
