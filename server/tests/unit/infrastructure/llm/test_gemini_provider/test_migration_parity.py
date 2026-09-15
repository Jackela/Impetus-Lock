"""Parity tests for the Gemini SDK migration (change: migrate-gemini-sdk).

These tests pin the externally observable contract of ``GeminiLLMProvider``
across the swap from the legacy ``google-generativeai`` SDK to ``google-genai``:

(a) response-shape failures (empty candidates / missing parts / no text) map
    to ``invalid_response`` / 502 and stay distinct from
(b) extracted-text JSON / Pydantic ``ValidationError`` failures, which must
    propagate out of the provider (``ValueError`` subclass) so
    ``routes/intervention.py`` returns its existing 422 response,
(c) BYOK request-local credentials with interleaved keys stay isolated,
(d) blocked output and API errors keep the 400/401/429/502/504 mapping,
(e) effective outbound retry attempts stay bounded (measured on the legacy
    SDK, mirrored explicitly on the new SDK),
(f) token counting returns the SDK count with the ``len(text) // 4`` fallback,
(g) health check keeps its boolean result,
(h) streaming keeps text chunks and mapped failure behavior.

Retry measurement record (2026-09-15, locked legacy stack: google-generativeai
0.8.6, google-ai-generativelanguage 0.6.15, google-api-core 2.25.2): with a
fake clock installed at the legacy GAPIC wrapped-RPC boundary
(``transport._wrapped_methods[...]._target``), a persistent
``ServiceUnavailable`` (the only exception type the legacy default predicate
retried) produced 5 trial totals of [123, 137, 136, 119, 134] outbound
attempts for ``generate_content``. The legacy bound was deadline-based (retry
deadline 600s, backoff initial=1s multiplier=1.3 max=10s plus jitter), not
attempt-based; ``count_tokens`` measured 18 attempts under its 60s deadline.

The google-genai provider therefore configures explicit retry options
(attempts=120 within the measured envelope for generation, attempts=18 for
token counting, retriable status codes restricted to 503, and the legacy
1s/1.3x/10s backoff parameters) so the new SDK never relies on its
version-dependent defaults (default attempts=5, retriable
408/429/500/502/503/504).
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any

import httpx
import pytest

from server.domain.errors import LLMProviderError
from server.infrastructure.llm.gemini_provider import GeminiLLMProvider

if TYPE_CHECKING:
    from collections.abc import Callable

# Effective legacy outbound attempts on persistent retryable failure.
LEGACY_GENERATE_ATTEMPTS_TRIALS = (123, 137, 136, 119, 134)
LEGACY_COUNT_TOKENS_ATTEMPTS_MEASURED = 18
# Configured new-SDK budgets mirroring the measured legacy envelope.
CONFIGURED_GENERATE_ATTEMPTS = 120
CONFIGURED_COUNT_TOKENS_ATTEMPTS = 18


def _ok_generate_body(text: str) -> dict[str, Any]:
    """Build a google-genai generateContent success body (wire format)."""
    return {
        "candidates": [
            {
                "content": {"role": "model", "parts": [{"text": text}]},
                "finishReason": "STOP",
                "index": 0,
            }
        ]
    }


def _http_503() -> httpx.Response:
    """Build a persistent upstream-unavailable HTTP response."""
    return httpx.Response(
        503,
        json={"error": {"code": 503, "message": "upstream unavailable", "status": "UNAVAILABLE"}},
    )


def _patch_outbound_send(
    provider: GeminiLLMProvider,
    *,
    tokens_client: bool,
    handler: Callable[[httpx.Request], httpx.Response],
) -> dict[str, Any]:
    """Replace the provider's outbound HTTP send boundary.

    ``handler`` stands in for exactly one outbound API attempt per invocation,
    at the same boundary (``httpx.Client.send``) the google-genai SDK uses for
    every wire request. Returns a state dict with the ``attempts`` counter and
    the recorded ``requests``.
    """
    client = provider._tokens_client if tokens_client else provider._client
    state: dict[str, Any] = {"attempts": 0, "requests": []}

    def counting_send(request: httpx.Request, **kwargs: Any) -> httpx.Response:
        state["attempts"] += 1
        state["requests"].append(request)
        return handler(request)

    client._api_client._httpx_client.send = counting_send  # type: ignore[method-assign]
    return state


@pytest.fixture
def fast_retries(monkeypatch: pytest.MonkeyPatch) -> None:
    """Make the google-genai (tenacity) retry backoff instantaneous.

    google-genai retries via tenacity, whose default sleep calls
    ``time.sleep`` through the ``time`` attribute of ``tenacity.nap``.
    """
    import types as types_module

    import tenacity.nap

    class _NoSleepTime(types_module.ModuleType):
        def sleep(self, seconds: float) -> None:
            return None

    monkeypatch.setattr(tenacity.nap, "time", _NoSleepTime("time"))


class TestResponseShapeFailures:
    """(a) Response-shape failures map to invalid_response / 502."""

    @pytest.fixture
    def provider(self) -> GeminiLLMProvider:
        """Provider with a fully stubbed client (no outbound call)."""
        from unittest.mock import MagicMock

        instance = GeminiLLMProvider(api_key="parity-key")
        instance._client = MagicMock()
        return instance

    def test_empty_candidates_maps_to_invalid_response_502(
        self, provider: GeminiLLMProvider
    ) -> None:
        """Empty candidates list is an invalid_response provider error."""
        from unittest.mock import MagicMock

        response = MagicMock()
        response.candidates = []
        response.prompt_feedback = MagicMock()
        response.prompt_feedback.block_reason = None
        provider._client.models.generate_content.return_value = response

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="sys", user_message="user")

        assert exc_info.value.code == "invalid_response"
        assert exc_info.value.status_code == 502
        assert exc_info.value.provider == "gemini"

    def test_missing_content_parts_maps_to_invalid_response_502(
        self, provider: GeminiLLMProvider
    ) -> None:
        """A candidate without content parts is an invalid_response error."""
        from unittest.mock import MagicMock

        response = MagicMock()
        response.candidates = [MagicMock()]
        response.candidates[0].content = None
        response.prompt_feedback = MagicMock()
        response.prompt_feedback.block_reason = None
        provider._client.models.generate_content.return_value = response

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="sys", user_message="user")

        assert exc_info.value.code == "invalid_response"
        assert exc_info.value.status_code == 502

    def test_missing_text_maps_to_invalid_response_502(self, provider: GeminiLLMProvider) -> None:
        """Parts without any text are an invalid_response error."""
        from unittest.mock import MagicMock

        response = MagicMock()
        response.candidates = [MagicMock()]
        response.candidates[0].content = MagicMock()
        response.candidates[0].content.parts = []
        response.candidates[0].finish_reason = None
        response.prompt_feedback = MagicMock()
        response.prompt_feedback.block_reason = None
        provider._client.models.generate_content.return_value = response

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="sys", user_message="user")

        assert exc_info.value.code == "invalid_response"
        assert exc_info.value.status_code == 502


class TestExtractedTextValidation:
    """(b) Extracted-text failures propagate as Pydantic ValidationError.

    routes/intervention.py catches ``ValueError`` (which ``ValidationError``
    subclasses) and returns its existing 422 response, so the provider must
    NOT wrap these failures in ``LLMProviderError``.
    """

    @pytest.fixture
    def provider(self) -> GeminiLLMProvider:
        """Provider with a fully stubbed client (no outbound call)."""
        from unittest.mock import MagicMock

        instance = GeminiLLMProvider(api_key="parity-key")
        instance._client = MagicMock()
        return instance

    def _respond_with_text(self, provider: GeminiLLMProvider, text: str) -> None:
        from unittest.mock import MagicMock

        response = MagicMock()
        response.candidates = [MagicMock()]
        response.candidates[0].content = MagicMock()
        response.candidates[0].content.parts = [MagicMock()]
        response.candidates[0].content.parts[0].text = text
        response.candidates[0].finish_reason = None
        response.prompt_feedback = MagicMock()
        response.prompt_feedback.block_reason = None
        provider._client.models.generate_content.return_value = response

    def test_malformed_json_raises_validation_error(self, provider: GeminiLLMProvider) -> None:
        """Malformed JSON text raises pydantic.ValidationError (not LLMProviderError)."""
        from pydantic import ValidationError

        self._respond_with_text(provider, "not valid json")

        with pytest.raises(ValidationError) as exc_info:
            provider._complete(system_prompt="sys", user_message="user")

        assert not isinstance(exc_info.value, LLMProviderError)
        assert isinstance(exc_info.value, ValueError)

    def test_schema_invalid_json_raises_validation_error(self, provider: GeminiLLMProvider) -> None:
        """Valid JSON with an unknown action fails LLMInterventionDraft validation."""
        from pydantic import ValidationError

        self._respond_with_text(provider, json.dumps({"action": "not-an-action"}))

        with pytest.raises(ValidationError):
            provider._complete(system_prompt="sys", user_message="user")


class TestByokCredentialIsolation:
    """(c) Interleaved BYOK credentials must not cross-talk.

    The legacy SDK leaked the latest ``genai.configure`` key into every
    provider (its client is process-global and resolved lazily); the
    google-genai provider keeps one client per credential, so each outbound
    request carries only its own key.
    """

    def test_provider_uses_only_its_own_key_after_other_provider_constructed(self) -> None:
        """A provider's outbound call carries its own key, not a later one's."""
        outbound_keys: list[str] = []

        def success_handler(request: httpx.Request) -> httpx.Response:
            outbound_keys.append(request.headers["x-goog-api-key"])
            return httpx.Response(200, json=_ok_generate_body(json.dumps({"action": "provoke"})))

        provider_one = GeminiLLMProvider(api_key="byok-key-one")
        _patch_outbound_send(provider_one, tokens_client=False, handler=success_handler)

        # Request B constructs its provider before request A's first call.
        provider_two = GeminiLLMProvider(api_key="byok-key-two")
        _patch_outbound_send(provider_two, tokens_client=False, handler=success_handler)

        draft = provider_one._complete(system_prompt="sys", user_message="user")

        assert draft.action == "provoke"
        assert outbound_keys == ["byok-key-one"]

    def test_interleaved_calls_keep_credentials_separate(self) -> None:
        """Interleaved executions each use their own resolved credential."""
        outbound: list[tuple[str, str]] = []

        def recorder_for(key: str) -> Callable[[httpx.Request], httpx.Response]:
            def handler(request: httpx.Request) -> httpx.Response:
                outbound.append((key, request.headers["x-goog-api-key"]))
                return httpx.Response(
                    200, json=_ok_generate_body(json.dumps({"action": "provoke"}))
                )

            return handler

        provider_one = GeminiLLMProvider(api_key="byok-key-one")
        provider_two = GeminiLLMProvider(api_key="byok-key-two")
        _patch_outbound_send(provider_one, tokens_client=False, handler=recorder_for("one"))
        _patch_outbound_send(provider_two, tokens_client=False, handler=recorder_for("two"))

        provider_one._complete(system_prompt="sys", user_message="user")
        provider_two._complete(system_prompt="sys", user_message="user")
        provider_one._complete(system_prompt="sys", user_message="user")

        assert outbound == [
            ("one", "byok-key-one"),
            ("two", "byok-key-two"),
            ("one", "byok-key-one"),
        ]


class TestBlockedAndErrorMapping:
    """(d) Blocked output and API errors keep the public status mapping."""

    @pytest.fixture
    def provider(self) -> GeminiLLMProvider:
        """Provider with a fully stubbed client (no outbound call)."""
        from unittest.mock import MagicMock

        instance = GeminiLLMProvider(api_key="parity-key")
        instance._client = MagicMock()
        return instance

    def _assert_mapping(
        self,
        provider: GeminiLLMProvider,
        exception: Exception,
        *,
        code: str,
        status_code: int,
    ) -> None:
        provider._client.models.generate_content.side_effect = exception
        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="sys", user_message="user")
        assert exc_info.value.code == code
        assert exc_info.value.status_code == status_code
        assert exc_info.value.provider == "gemini"

    def test_blocked_prompt_metadata_maps_to_400(self, provider: GeminiLLMProvider) -> None:
        """prompt_feedback.block_reason maps to content_blocked / 400."""
        from unittest.mock import MagicMock

        response = MagicMock()
        response.candidates = []
        response.prompt_feedback = MagicMock()
        response.prompt_feedback.block_reason = "SAFETY"
        provider._client.models.generate_content.return_value = response

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="sys", user_message="user")

        assert exc_info.value.code == "content_blocked"
        assert exc_info.value.status_code == 400
        assert exc_info.value.provider == "gemini"

    def test_stopped_candidate_metadata_maps_to_502(self, provider: GeminiLLMProvider) -> None:
        """A blocked finish_reason maps to generation_stopped / 502."""
        from unittest.mock import MagicMock

        from google.genai.types import FinishReason

        response = MagicMock()
        response.candidates = [MagicMock()]
        response.candidates[0].content = MagicMock()
        response.candidates[0].content.parts = []
        response.candidates[0].finish_reason = FinishReason.SAFETY
        response.prompt_feedback = MagicMock()
        response.prompt_feedback.block_reason = None
        provider._client.models.generate_content.return_value = response

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="sys", user_message="user")

        assert exc_info.value.code == "generation_stopped"
        assert exc_info.value.status_code == 502

    def test_invalid_key_client_error_400_maps_to_401(self, provider: GeminiLLMProvider) -> None:
        """ClientError(code=400) (invalid key) maps to invalid_api_key / 401."""
        from google.genai import errors

        self._assert_mapping(
            provider,
            errors.ClientError(
                code=400,
                response_json={"error": {"message": "API key not valid"}},
            ),
            code="invalid_api_key",
            status_code=401,
        )

    def test_permission_client_error_403_maps_to_401(self, provider: GeminiLLMProvider) -> None:
        """ClientError(code=403) maps to invalid_api_key / 401."""
        from google.genai import errors

        self._assert_mapping(
            provider,
            errors.ClientError(
                code=403,
                response_json={"error": {"message": "permission denied"}},
            ),
            code="invalid_api_key",
            status_code=401,
        )

    def test_quota_client_error_429_maps_to_429(self, provider: GeminiLLMProvider) -> None:
        """ClientError(code=429) maps to quota_exceeded / 429."""
        from google.genai import errors

        self._assert_mapping(
            provider,
            errors.ClientError(
                code=429,
                response_json={"error": {"message": "quota exceeded"}},
            ),
            code="quota_exceeded",
            status_code=429,
        )

    def test_server_error_504_maps_to_504(self, provider: GeminiLLMProvider) -> None:
        """ServerError(code=504) maps to timeout / 504."""
        from google.genai import errors

        self._assert_mapping(
            provider,
            errors.ServerError(
                code=504,
                response_json={"error": {"message": "deadline exceeded"}},
            ),
            code="timeout",
            status_code=504,
        )

    def test_httpx_timeout_maps_to_504(self, provider: GeminiLLMProvider) -> None:
        """Local client timeouts (httpx.TimeoutException) map to timeout / 504."""
        self._assert_mapping(
            provider,
            httpx.ReadTimeout("local timeout"),
            code="timeout",
            status_code=504,
        )

    def test_server_error_500_maps_to_502(self, provider: GeminiLLMProvider) -> None:
        """ServerError(code=500) maps to llm_api_error / 502."""
        from google.genai import errors

        self._assert_mapping(
            provider,
            errors.ServerError(code=500, response_json={"error": {"message": "boom"}}),
            code="llm_api_error",
            status_code=502,
        )

    def test_persistent_503_after_retries_maps_to_502(self, fast_retries: None) -> None:
        """Exhausted retries on a persistent 503 surface as llm_api_error / 502."""
        provider = GeminiLLMProvider(api_key="parity-key")
        _patch_outbound_send(provider, tokens_client=False, handler=lambda request: _http_503())

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="sys", user_message="user")

        assert exc_info.value.code == "llm_api_error"
        assert exc_info.value.status_code == 502


class TestEffectiveRetryBudget:
    """(e) Effective outbound attempts on persistent retryable failure."""

    def test_generate_content_attempts_match_configured_budget(self, fast_retries: None) -> None:
        """Persistent 503 yields exactly the configured attempt budget.

        The configured budget (120) sits within the legacy measured envelope
        of [119, 137] over 5 trials.
        """
        provider = GeminiLLMProvider(api_key="parity-key")
        state = _patch_outbound_send(
            provider, tokens_client=False, handler=lambda request: _http_503()
        )

        with pytest.raises(LLMProviderError):
            provider._complete(system_prompt="sys", user_message="user")

        assert state["attempts"] == CONFIGURED_GENERATE_ATTEMPTS
        low, high = min(LEGACY_GENERATE_ATTEMPTS_TRIALS), max(LEGACY_GENERATE_ATTEMPTS_TRIALS)
        assert low <= CONFIGURED_GENERATE_ATTEMPTS <= high

    def test_non_retryable_client_error_single_attempt(self, fast_retries: None) -> None:
        """A 400 response is not retried: exactly one outbound attempt."""
        provider = GeminiLLMProvider(api_key="parity-key")
        state = _patch_outbound_send(
            provider,
            tokens_client=False,
            handler=lambda request: httpx.Response(
                400,
                json={"error": {"code": 400, "message": "bad key", "status": "INVALID_ARGUMENT"}},
            ),
        )

        with pytest.raises(LLMProviderError):
            provider._complete(system_prompt="sys", user_message="user")

        assert state["attempts"] == 1

    def test_quota_429_not_retried(self, fast_retries: None) -> None:
        """A 429 response surfaces immediately (legacy did not retry quota)."""
        provider = GeminiLLMProvider(api_key="parity-key")
        state = _patch_outbound_send(
            provider,
            tokens_client=False,
            handler=lambda request: httpx.Response(
                429,
                json={"error": {"code": 429, "message": "quota", "status": "RESOURCE_EXHAUSTED"}},
            ),
        )

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="sys", user_message="user")

        assert exc_info.value.code == "quota_exceeded"
        assert state["attempts"] == 1

    def test_count_tokens_retried_within_budget_then_falls_back(self, fast_retries: None) -> None:
        """Persistent count_tokens failure retries its budgeted attempts, then falls back."""
        provider = GeminiLLMProvider(api_key="parity-key")
        state = _patch_outbound_send(
            provider, tokens_client=True, handler=lambda request: _http_503()
        )

        text = "some text to count tokens for"
        assert provider.count_tokens(text) == len(text) // 4
        assert state["attempts"] == CONFIGURED_COUNT_TOKENS_ATTEMPTS


class TestTokenCounting:
    """(f) Token counting returns the SDK count."""

    def test_count_tokens_returns_sdk_total(self) -> None:
        """count_tokens returns the SDK's total_tokens."""
        provider = GeminiLLMProvider(api_key="parity-key")
        state = _patch_outbound_send(
            provider,
            tokens_client=True,
            handler=lambda request: httpx.Response(200, json={"totalTokens": 42}),
        )

        assert provider.count_tokens("Hello, world!") == 42
        assert state["attempts"] == 1

    def test_count_tokens_fallback_estimate(self) -> None:
        """On failure the estimate len(text) // 4 is returned."""
        provider = GeminiLLMProvider(api_key="parity-key")
        _patch_outbound_send(
            provider,
            tokens_client=True,
            handler=lambda request: httpx.Response(
                400,
                json={"error": {"code": 400, "message": "bad request"}},
            ),
        )

        text = "Hello, world! This is a test."
        assert provider.count_tokens(text) == len(text) // 4


class TestHealthCheck:
    """(g) Health check keeps its boolean result."""

    def test_health_check_true_when_api_reachable(self) -> None:
        """Successful count_tokens makes the health check True."""
        provider = GeminiLLMProvider(api_key="parity-key")
        _patch_outbound_send(
            provider,
            tokens_client=True,
            handler=lambda request: httpx.Response(200, json={"totalTokens": 1}),
        )

        assert provider.health_check() is True

    def test_health_check_false_when_api_fails(self, fast_retries: None) -> None:
        """Persistent failures make the health check False."""
        provider = GeminiLLMProvider(api_key="parity-key")
        _patch_outbound_send(provider, tokens_client=True, handler=lambda request: _http_503())

        assert provider.health_check() is False


class TestStreaming:
    """(h) Streaming keeps text chunks and mapped failure behavior."""

    @pytest.fixture
    def provider(self) -> GeminiLLMProvider:
        """Provider with a fully stubbed client (no outbound call)."""
        from unittest.mock import MagicMock

        instance = GeminiLLMProvider(api_key="parity-key")
        instance._client = MagicMock()
        return instance

    def test_stream_yields_text_chunks_in_order(self, provider: GeminiLLMProvider) -> None:
        """Chunks are yielded in arrival order and empty ones skipped."""
        from unittest.mock import MagicMock

        chunks = [
            MagicMock(text='{"action":'),
            MagicMock(text=None),
            MagicMock(text=' "provoke"}'),
        ]
        provider._client.models.generate_content_stream.return_value = iter(chunks)

        result = list(provider.stream_intervention("Context", "muse"))

        assert result == ['{"action":', ' "provoke"}']

    def test_stream_error_maps_to_502(self, provider: GeminiLLMProvider) -> None:
        """Generic streaming failures map to llm_api_error / 502."""
        provider._client.models.generate_content_stream.side_effect = RuntimeError("stream broke")

        with pytest.raises(LLMProviderError) as exc_info:
            list(provider.stream_intervention("Context", "muse"))

        assert exc_info.value.code == "llm_api_error"
        assert exc_info.value.status_code == 502

    def test_stream_timeout_maps_to_504(self, provider: GeminiLLMProvider) -> None:
        """httpx timeouts during streaming map to timeout / 504."""
        provider._client.models.generate_content_stream.side_effect = httpx.ReadTimeout("timeout")

        with pytest.raises(LLMProviderError) as exc_info:
            list(provider.stream_intervention("Context", "muse"))

        assert exc_info.value.code == "timeout"
        assert exc_info.value.status_code == 504
