"""Unit tests for GeminiLLMProvider.

This module tests the Gemini LLM provider implementation, including:
- Successful intervention generation in both Muse and Loki modes
- Error handling for API failures, rate limits, and auth errors
- Token counting functionality
- Health check functionality
- Safety settings configuration

Test Strategy:
    - All API calls are mocked to avoid real network requests
    - Tests cover both success and failure scenarios
    - Each error type from the Gemini SDK is tested
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING
from unittest.mock import MagicMock

import pytest

from server.domain.errors import LLMProviderError
from server.infrastructure.llm.gemini_provider import GeminiLLMProvider

if TYPE_CHECKING:
    pass


@pytest.fixture
def mock_response() -> MagicMock:
    """Create a mock Gemini response with successful completion."""
    response = MagicMock()
    response.candidates = [MagicMock()]
    response.candidates[0].content = MagicMock()
    response.candidates[0].content.parts = [MagicMock()]
    response.candidates[0].content.parts[0].text = json.dumps(
        {"action": "provoke", "content": "Test intervention content"}
    )
    response.candidates[0].finish_reason = None
    response.prompt_feedback = MagicMock()
    response.prompt_feedback.block_reason = None
    return response


@pytest.fixture
def stubbed_provider() -> GeminiLLMProvider:
    """Create a provider whose SDK clients are MagicMocks (no outbound call)."""
    instance = GeminiLLMProvider(api_key="test-key")
    instance._client = MagicMock()
    instance._tokens_client = MagicMock()
    return instance


class TestGeminiProviderInitialization:
    """Test Gemini provider initialization and configuration."""

    def test_init_with_default_model(self) -> None:
        """Provider initializes with default model."""
        provider = GeminiLLMProvider(api_key="test-key")

        assert provider.provider_name == "gemini"
        assert provider.model == "gemini-1.5-flash"
        assert provider.temperature == 0.7
        assert provider.api_key == "test-key"

    def test_init_with_custom_model(self) -> None:
        """Provider initializes with custom model."""
        provider = GeminiLLMProvider(api_key="test-key", model="gemini-1.5-pro", temperature=0.9)

        assert provider.model == "gemini-1.5-pro"
        assert provider.temperature == 0.9

    def test_init_with_custom_safety_settings(self) -> None:
        """Provider initializes with custom safety settings."""
        custom_settings = [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_ONLY_HIGH"},
        ]

        provider = GeminiLLMProvider(api_key="test-key", safety_settings=custom_settings)

        assert provider.safety_settings == custom_settings


class TestGeminiProviderModes:
    """Test intervention generation in Muse and Loki modes."""

    @pytest.fixture
    def provider(self) -> GeminiLLMProvider:
        """Create a provider instance with stubbed SDK clients."""
        instance = GeminiLLMProvider(api_key="test-key")
        instance._client = MagicMock()
        instance._tokens_client = MagicMock()
        return instance

    def test_muse_mode_generate_intervention(
        self, provider: GeminiLLMProvider, mock_response: MagicMock
    ) -> None:
        """Muse mode generates intervention with provoke action."""
        provider._client.models.generate_content.return_value = mock_response

        response = provider.generate_intervention(context="He opened the door.", mode="muse")

        assert response.action == "provoke"
        assert response.content == "Test intervention content"
        assert response.source == "muse"
        assert response.lock_id is not None
        assert response.action_id is not None

    def test_loki_mode_generate_intervention(
        self, provider: GeminiLLMProvider, mock_response: MagicMock
    ) -> None:
        """Loki mode generates intervention with appropriate action."""
        mock_response.candidates[0].content.parts[0].text = json.dumps({"action": "delete"})
        provider._client.models.generate_content.return_value = mock_response

        response = provider.generate_intervention(
            context="He opened the door and stepped inside.", mode="loki"
        )

        assert response.action == "delete"
        assert response.content is None
        assert response.lock_id is None
        assert response.source == "loki"

    def test_rewrite_action(self, provider: GeminiLLMProvider, mock_response: MagicMock) -> None:
        """Provider handles rewrite action correctly."""
        mock_response.candidates[0].content.parts[0].text = json.dumps(
            {"action": "rewrite", "content": "He smashed the door open."}
        )
        provider._client.models.generate_content.return_value = mock_response

        response = provider.generate_intervention(context="He opened the door.", mode="muse")

        assert response.action == "rewrite"
        assert response.content == "He smashed the door open."
        assert response.lock_id is not None

    def test_empty_context_raises_error(self, provider: GeminiLLMProvider) -> None:
        """Empty context raises ValueError."""
        with pytest.raises(ValueError, match="Context cannot be empty"):
            provider.generate_intervention(context="", mode="muse")

    def test_invalid_mode_raises_error(self, provider: GeminiLLMProvider) -> None:
        """Invalid mode raises ValueError."""
        with pytest.raises(ValueError, match="Invalid mode"):
            provider.generate_intervention(
                context="Some context",
                mode="invalid",  # type: ignore[arg-type]
            )


class TestGeminiProviderErrors:
    """Test error handling for various Gemini API failures."""

    @pytest.fixture
    def provider(self) -> GeminiLLMProvider:
        """Create a provider instance with stubbed SDK clients."""
        instance = GeminiLLMProvider(api_key="test-key")
        instance._client = MagicMock()
        instance._tokens_client = MagicMock()
        return instance

    def test_invalid_api_key_error(self, provider: GeminiLLMProvider) -> None:
        """ClientError(400) (invalid key signal) maps to invalid_api_key / 401."""
        from google.genai import errors

        provider._client.models.generate_content.side_effect = errors.ClientError(
            code=400,
            response_json={"error": {"message": "API key not valid", "status": "INVALID_ARGUMENT"}},
        )

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="System prompt", user_message="User message")

        assert exc_info.value.code == "invalid_api_key"
        assert exc_info.value.status_code == 401
        assert exc_info.value.provider == "gemini"

    def test_quota_exceeded_error(self, provider: GeminiLLMProvider) -> None:
        """ClientError(429) maps to quota_exceeded error."""
        from google.genai import errors

        provider._client.models.generate_content.side_effect = errors.ClientError(
            code=429,
            response_json={"error": {"message": "Quota exceeded", "status": "RESOURCE_EXHAUSTED"}},
        )

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="System prompt", user_message="User message")

        assert exc_info.value.code == "quota_exceeded"
        assert exc_info.value.status_code == 429
        assert exc_info.value.provider == "gemini"

    def test_blocked_prompt_error(self, provider: GeminiLLMProvider) -> None:
        """prompt_feedback.block_reason maps to content_blocked / 400."""
        mock_response = MagicMock()
        mock_response.candidates = []
        mock_response.prompt_feedback = MagicMock()
        mock_response.prompt_feedback.block_reason = "SAFETY"
        provider._client.models.generate_content.return_value = mock_response

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="System prompt", user_message="User message")

        assert exc_info.value.code == "content_blocked"
        assert exc_info.value.status_code == 400
        assert exc_info.value.provider == "gemini"

    def test_server_timeout_error(self, provider: GeminiLLMProvider) -> None:
        """ServerError(504) maps to timeout / 504."""
        from google.genai import errors

        provider._client.models.generate_content.side_effect = errors.ServerError(
            code=504,
            response_json={"error": {"message": "deadline exceeded", "status": "EXCEEDED"}},
        )

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="System prompt", user_message="User message")

        assert exc_info.value.code == "timeout"
        assert exc_info.value.status_code == 504

    def test_empty_candidates_error(self, provider: GeminiLLMProvider) -> None:
        """Empty candidates list raises invalid_response error."""
        mock_response = MagicMock()
        mock_response.candidates = []
        mock_response.prompt_feedback = MagicMock()
        mock_response.prompt_feedback.block_reason = None
        provider._client.models.generate_content.return_value = mock_response

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="System prompt", user_message="User message")

        assert exc_info.value.code == "invalid_response"
        assert "empty candidates" in exc_info.value.message.lower()

    def test_no_content_parts_error(self, provider: GeminiLLMProvider) -> None:
        """Missing content parts raises invalid_response error."""
        mock_response = MagicMock()
        mock_response.candidates = [MagicMock()]
        mock_response.candidates[0].content = None
        mock_response.prompt_feedback = MagicMock()
        mock_response.prompt_feedback.block_reason = None
        provider._client.models.generate_content.return_value = mock_response

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="System prompt", user_message="User message")

        assert exc_info.value.code == "invalid_response"

    def test_no_text_content_error(self, provider: GeminiLLMProvider) -> None:
        """No text content raises invalid_response error."""
        mock_response = MagicMock()
        mock_response.candidates = [MagicMock()]
        mock_response.candidates[0].content = MagicMock()
        mock_response.candidates[0].content.parts = []
        mock_response.candidates[0].finish_reason = None
        mock_response.prompt_feedback = MagicMock()
        mock_response.prompt_feedback.block_reason = None
        provider._client.models.generate_content.return_value = mock_response

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="System prompt", user_message="User message")

        assert exc_info.value.code == "invalid_response"

    def test_invalid_json_response(self, provider: GeminiLLMProvider) -> None:
        """Invalid JSON in response raises validation error."""
        mock_response = MagicMock()
        mock_response.candidates = [MagicMock()]
        mock_response.candidates[0].content = MagicMock()
        mock_response.candidates[0].content.parts = [MagicMock()]
        mock_response.candidates[0].content.parts[0].text = "not valid json"
        mock_response.candidates[0].finish_reason = None
        mock_response.prompt_feedback = MagicMock()
        mock_response.prompt_feedback.block_reason = None
        provider._client.models.generate_content.return_value = mock_response

        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            provider._complete(system_prompt="System prompt", user_message="User message")


class TestGeminiProviderUtilities:
    """Test utility methods like token counting and health checks."""

    @pytest.fixture
    def provider(self) -> GeminiLLMProvider:
        """Create a provider instance with stubbed SDK clients."""
        instance = GeminiLLMProvider(api_key="test-key")
        instance._client = MagicMock()
        instance._tokens_client = MagicMock()
        return instance

    def test_count_tokens_success(self, provider: GeminiLLMProvider) -> None:
        """Token counting returns correct value."""
        mock_result = MagicMock()
        mock_result.total_tokens = 42
        provider._tokens_client.models.count_tokens.return_value = mock_result

        count = provider.count_tokens("Hello, world!")

        assert count == 42
        provider._tokens_client.models.count_tokens.assert_called_once_with(
            model=provider.model,
            contents="Hello, world!",
        )

    def test_count_tokens_fallback_on_error(self, provider: GeminiLLMProvider) -> None:
        """Token counting falls back to estimate on error."""
        provider._tokens_client.models.count_tokens.side_effect = RuntimeError("API error")

        text = "Hello, world! This is a test."
        count = provider.count_tokens(text)

        expected = len(text) // 4
        assert count == expected

    def test_health_check_success(self, provider: GeminiLLMProvider) -> None:
        """Health check returns True when API is accessible."""
        mock_result = MagicMock()
        mock_result.total_tokens = 1
        provider._tokens_client.models.count_tokens.return_value = mock_result

        assert provider.health_check() is True

    def test_health_check_failure(self, provider: GeminiLLMProvider) -> None:
        """Health check returns False when API is not accessible."""
        provider._tokens_client.models.count_tokens.side_effect = RuntimeError("API error")

        assert provider.health_check() is False


class TestGeminiProviderStreaming:
    """Test streaming intervention generation."""

    @pytest.fixture
    def provider(self) -> GeminiLLMProvider:
        """Create a provider instance with stubbed SDK clients."""
        instance = GeminiLLMProvider(api_key="test-key")
        instance._client = MagicMock()
        instance._tokens_client = MagicMock()
        return instance

    def test_stream_intervention_muse_mode(self, provider: GeminiLLMProvider) -> None:
        """Streaming works in Muse mode."""
        chunks = [
            MagicMock(text='{"action": "'),
            MagicMock(text='provoke", "'),
            MagicMock(text='content": "'),
            MagicMock(text='Test"}'),
        ]
        provider._client.models.generate_content_stream.return_value = iter(chunks)

        result = list(provider.stream_intervention("Context", "muse"))

        assert result == ['{"action": "', 'provoke", "', 'content": "', 'Test"}']

    def test_stream_intervention_loki_mode(self, provider: GeminiLLMProvider) -> None:
        """Streaming works in Loki mode."""
        chunks = [
            MagicMock(text='{"action": "delete"}'),
        ]
        provider._client.models.generate_content_stream.return_value = iter(chunks)

        result = list(provider.stream_intervention("Context", "loki"))

        assert result == ['{"action": "delete"}']

    def test_stream_intervention_error(self, provider: GeminiLLMProvider) -> None:
        """Streaming raises LLMProviderError on failure."""
        provider._client.models.generate_content_stream.side_effect = RuntimeError("Stream error")

        with pytest.raises(LLMProviderError) as exc_info:
            list(provider.stream_intervention("Context", "muse"))

        assert exc_info.value.code == "llm_api_error"
        assert "Streaming failed" in exc_info.value.message


class TestGeminiProviderSupportedModels:
    """Test supported models list."""

    def test_supported_models_list(self) -> None:
        """Supported models includes expected Gemini versions."""
        expected_models = {
            "gemini-1.5-pro",
            "gemini-1.5-pro-latest",
            "gemini-1.5-flash",
            "gemini-1.5-flash-latest",
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
        }

        assert GeminiLLMProvider.SUPPORTED_MODELS == expected_models  # noqa: SIM300


class TestGeminiProviderDefaultSafetySettings:
    """Test default safety settings configuration."""

    def test_default_safety_settings(self) -> None:
        """Default safety settings use medium thresholds."""
        provider = GeminiLLMProvider(api_key="test-key")
        settings = provider._get_default_safety_settings()

        categories = {setting["category"] for setting in settings}
        assert "HARM_CATEGORY_HARASSMENT" in categories
        assert all(setting["threshold"] == "BLOCK_MEDIUM_AND_ABOVE" for setting in settings)


class TestGeminiProviderPromptConstruction:
    """Test prompt construction and API call parameters."""

    @pytest.fixture
    def provider(self) -> GeminiLLMProvider:
        """Create a provider instance with stubbed SDK clients."""
        instance = GeminiLLMProvider(api_key="test-key")
        instance._client = MagicMock()
        instance._tokens_client = MagicMock()
        return instance

    def test_complete_method_constructs_prompt_correctly(
        self, stubbed_provider: GeminiLLMProvider, mock_response: MagicMock
    ) -> None:
        """_complete method constructs full prompt correctly."""
        provider = stubbed_provider
        provider._client.models.generate_content.return_value = mock_response

        system_prompt = "You are a creative assistant."
        user_message = "Generate a twist for: He opened the door."

        provider._complete(system_prompt, user_message)

        call_args = provider._client.models.generate_content.call_args
        full_prompt = call_args.kwargs.get("contents") or call_args[0][0]

        assert system_prompt in full_prompt
        assert user_message in full_prompt

    def test_complete_method_uses_correct_generation_config(
        self, stubbed_provider: GeminiLLMProvider, mock_response: MagicMock
    ) -> None:
        """_complete method uses correct generation configuration."""
        provider = stubbed_provider
        provider._client.models.generate_content.return_value = mock_response

        provider._complete("System", "User")

        call_args = provider._client.models.generate_content.call_args
        gen_config = call_args.kwargs.get("config")

        assert gen_config is not None
        assert gen_config.response_mime_type == "application/json"
        assert gen_config.max_output_tokens == 512
        assert gen_config.temperature == provider.temperature
        # The SDK normalizes safety dicts to SafetySetting enums; compare values.
        configured = {
            (setting.category.value, setting.threshold.value)
            for setting in gen_config.safety_settings
        }
        expected = {
            (setting["category"], setting["threshold"]) for setting in provider.safety_settings
        }
        assert configured == expected
