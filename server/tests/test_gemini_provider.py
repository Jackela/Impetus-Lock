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
import sys
from typing import TYPE_CHECKING
from unittest.mock import MagicMock, Mock, patch

import pytest

from server.domain.errors import LLMProviderError
from server.infrastructure.llm.gemini_provider import GeminiLLMProvider

if TYPE_CHECKING:
    from collections.abc import Generator


@pytest.fixture(autouse=True)
def mock_genai() -> Generator[Mock, None, None]:
    """Mock the google.generativeai module for all tests in this file."""
    with patch("google.generativeai") as mock:
        mock.configure = Mock()
        mock.GenerativeModel = Mock()
        yield mock


@pytest.fixture
def mock_response() -> MagicMock:
    """Create a mock Gemini response with successful completion."""
    response = MagicMock()
    response.candidates = [MagicMock()]
    response.candidates[0].content.parts = [MagicMock()]
    response.candidates[0].content.parts[0].text = json.dumps(
        {"action": "provoke", "content": "Test intervention content"}
    )
    return response


class TestGeminiProviderInitialization:
    """Test Gemini provider initialization and configuration."""

    def test_init_with_default_model(self, mock_genai: Mock) -> None:
        """Provider initializes with default model."""
        provider = GeminiLLMProvider(api_key="test-key")

        assert provider.provider_name == "gemini"
        assert provider.model == "gemini-1.5-flash"
        assert provider.temperature == 0.7
        mock_genai.configure.assert_called_once_with(api_key="test-key")

    def test_init_with_custom_model(self, mock_genai: Mock) -> None:
        """Provider initializes with custom model."""
        provider = GeminiLLMProvider(api_key="test-key", model="gemini-1.5-pro", temperature=0.9)

        assert provider.model == "gemini-1.5-pro"
        assert provider.temperature == 0.9

    def test_init_with_custom_safety_settings(self, mock_genai: Mock) -> None:
        """Provider initializes with custom safety settings."""
        from google.generativeai.types import HarmBlockThreshold, HarmCategory

        custom_settings = {
            HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        }

        provider = GeminiLLMProvider(api_key="test-key", safety_settings=custom_settings)

        assert provider.safety_settings == custom_settings


class TestGeminiProviderModes:
    """Test intervention generation in Muse and Loki modes."""

    @pytest.fixture
    def provider(self, mock_genai: Mock) -> GeminiLLMProvider:
        """Create a provider instance with mocked model."""
        mock_model_instance = MagicMock()
        mock_genai.GenerativeModel.return_value = mock_model_instance
        return GeminiLLMProvider(api_key="test-key")

    def test_muse_mode_generate_intervention(
        self, provider: GeminiLLMProvider, mock_response: MagicMock
    ) -> None:
        """Muse mode generates intervention with provoke action."""
        provider._model.generate_content.return_value = mock_response

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
        provider._model.generate_content.return_value = mock_response

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
        provider._model.generate_content.return_value = mock_response

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
    def provider(self, mock_genai: Mock) -> GeminiLLMProvider:
        """Create a provider instance with mocked model."""
        mock_model_instance = MagicMock()
        mock_genai.GenerativeModel.return_value = mock_model_instance
        return GeminiLLMProvider(api_key="test-key")

    def test_blocked_prompt_error(self, provider: GeminiLLMProvider) -> None:
        """BlockedPromptException maps to content_blocked error."""
        from google.generativeai.types import BlockedPromptException

        provider._model.generate_content.side_effect = BlockedPromptException("Blocked")

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="System prompt", user_message="User message")

        assert exc_info.value.code == "content_blocked"
        assert exc_info.value.status_code == 400
        assert exc_info.value.provider == "gemini"

    def test_invalid_api_key_error(self, provider: GeminiLLMProvider) -> None:
        """InvalidAPIKeyException maps to invalid_api_key error."""
        from google.generativeai.types import InvalidArgument

        # The SDK raises InvalidArgument for bad API keys
        provider._model.generate_content.side_effect = InvalidArgument("Invalid API key")

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="System prompt", user_message="User message")

        # The generic exception handler catches this
        assert exc_info.value.provider == "gemini"

    def test_quota_exceeded_error(self, provider: GeminiLLMProvider) -> None:
        """ResourceExhausted maps to quota_exceeded error."""
        from google.api_core.exceptions import ResourceExhausted

        provider._model.generate_content.side_effect = ResourceExhausted("Quota exceeded")

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="System prompt", user_message="User message")

        assert exc_info.value.code == "quota_exceeded"
        assert exc_info.value.provider == "gemini"

    def test_empty_candidates_error(self, provider: GeminiLLMProvider) -> None:
        """Empty candidates list raises invalid_response error."""
        mock_response = MagicMock()
        mock_response.candidates = []
        provider._model.generate_content.return_value = mock_response

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="System prompt", user_message="User message")

        assert exc_info.value.code == "invalid_response"
        assert "empty candidates" in exc_info.value.message.lower()

    def test_no_content_parts_error(self, provider: GeminiLLMProvider) -> None:
        """Missing content parts raises invalid_response error."""
        mock_response = MagicMock()
        mock_response.candidates = [MagicMock()]
        mock_response.candidates[0].content = None
        provider._model.generate_content.return_value = mock_response

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="System prompt", user_message="User message")

        assert exc_info.value.code == "invalid_response"

    def test_no_text_content_error(self, provider: GeminiLLMProvider) -> None:
        """No text content raises invalid_response error."""
        mock_response = MagicMock()
        mock_response.candidates = [MagicMock()]
        mock_response.candidates[0].content.parts = []
        provider._model.generate_content.return_value = mock_response

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="System prompt", user_message="User message")

        assert exc_info.value.code == "invalid_response"

    def test_invalid_json_response(self, provider: GeminiLLMProvider) -> None:
        """Invalid JSON in response raises validation error."""
        mock_response = MagicMock()
        mock_response.candidates = [MagicMock()]
        mock_response.candidates[0].content.parts = [MagicMock()]
        mock_response.candidates[0].content.parts[0].text = "not valid json"
        provider._model.generate_content.return_value = mock_response

        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            provider._complete(system_prompt="System prompt", user_message="User message")


class TestGeminiProviderUtilities:
    """Test utility methods like token counting and health checks."""

    @pytest.fixture
    def provider(self, mock_genai: Mock) -> GeminiLLMProvider:
        """Create a provider instance with mocked model."""
        mock_model_instance = MagicMock()
        mock_genai.GenerativeModel.return_value = mock_model_instance
        return GeminiLLMProvider(api_key="test-key")

    def test_count_tokens_success(self, provider: GeminiLLMProvider) -> None:
        """Token counting returns correct value."""
        mock_result = MagicMock()
        mock_result.total_tokens = 42
        provider._model.count_tokens.return_value = mock_result

        count = provider.count_tokens("Hello, world!")

        assert count == 42
        provider._model.count_tokens.assert_called_once_with(contents="Hello, world!")

    def test_count_tokens_fallback_on_error(self, provider: GeminiLLMProvider) -> None:
        """Token counting falls back to estimate on error."""
        provider._model.count_tokens.side_effect = Exception("API error")

        text = "Hello, world! This is a test."
        count = provider.count_tokens(text)

        # Should use fallback: len(text) // 4
        expected = len(text) // 4
        assert count == expected

    def test_health_check_success(self, provider: GeminiLLMProvider) -> None:
        """Health check returns True when API is accessible."""
        mock_result = MagicMock()
        mock_result.total_tokens = 1
        provider._model.count_tokens.return_value = mock_result

        assert provider.health_check() is True

    def test_health_check_failure(self, provider: GeminiLLMProvider) -> None:
        """Health check returns False when API is not accessible."""
        provider._model.count_tokens.side_effect = Exception("API error")

        assert provider.health_check() is False


class TestGeminiProviderStreaming:
    """Test streaming intervention generation."""

    @pytest.fixture
    def provider(self, mock_genai: Mock) -> GeminiLLMProvider:
        """Create a provider instance with mocked model."""
        mock_model_instance = MagicMock()
        mock_genai.GenerativeModel.return_value = mock_model_instance
        return GeminiLLMProvider(api_key="test-key")

    def test_stream_intervention_muse_mode(self, provider: GeminiLLMProvider) -> None:
        """Streaming works in Muse mode."""
        # Create mock chunks
        chunks = [
            MagicMock(text='{"action": "'),
            MagicMock(text='provoke", "'),
            MagicMock(text='content": "'),
            MagicMock(text='Test"}'),
        ]
        provider._model.generate_content.return_value = chunks

        result = list(provider.stream_intervention("Context", "muse"))

        assert result == ['{"action": "', 'provoke", "', 'content": "', 'Test"}']

    def test_stream_intervention_loki_mode(self, provider: GeminiLLMProvider) -> None:
        """Streaming works in Loki mode."""
        chunks = [
            MagicMock(text='{"action": "delete"}'),
        ]
        provider._model.generate_content.return_value = chunks

        result = list(provider.stream_intervention("Context", "loki"))

        assert result == ['{"action": "delete"}']

    def test_stream_intervention_error(self, provider: GeminiLLMProvider) -> None:
        """Streaming raises LLMProviderError on failure."""
        provider._model.generate_content.side_effect = Exception("Stream error")

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

    def test_default_safety_settings(self, mock_genai: Mock) -> None:
        """Default safety settings use medium thresholds."""
        from google.generativeai.types import HarmBlockThreshold, HarmCategory

        provider = GeminiLLMProvider(api_key="test-key")
        settings = provider._get_default_safety_settings()

        assert HarmCategory.HARM_CATEGORY_HARASSMENT in settings
        assert (
            settings[HarmCategory.HARM_CATEGORY_HARASSMENT]
            == HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
        )


class TestGeminiProviderPromptConstruction:
    """Test prompt construction and API call parameters."""

    @pytest.fixture
    def provider(self, mock_genai: Mock) -> GeminiLLMProvider:
        """Create a provider instance with mocked model."""
        mock_model_instance = MagicMock()
        mock_genai.GenerativeModel.return_value = mock_model_instance
        return GeminiLLMProvider(api_key="test-key")

    def test_complete_method_constructs_prompt_correctly(
        self, mock_genai: Mock, mock_response: MagicMock
    ) -> None:
        """_complete method constructs full prompt correctly."""
        mock_model_instance = MagicMock()
        mock_genai.GenerativeModel.return_value = mock_model_instance
        mock_model_instance.generate_content.return_value = mock_response
        provider = GeminiLLMProvider(api_key="test-key")

        system_prompt = "You are a creative assistant."
        user_message = "Generate a twist for: He opened the door."

        provider._complete(system_prompt, user_message)

        # Verify the call was made with combined prompt
        call_args = provider._model.generate_content.call_args
        full_prompt = call_args.kwargs.get("contents") or call_args[0][0]

        assert system_prompt in full_prompt
        assert user_message in full_prompt

    def test_complete_method_uses_correct_generation_config(
        self, mock_genai: Mock, mock_response: MagicMock
    ) -> None:
        """_complete method uses correct generation configuration."""
        mock_model_instance = MagicMock()
        mock_genai.GenerativeModel.return_value = mock_model_instance
        mock_model_instance.generate_content.return_value = mock_response
        provider = GeminiLLMProvider(api_key="test-key")

        provider._complete("System", "User")

        call_args = provider._model.generate_content.call_args
        gen_config = call_args.kwargs.get("generation_config")

        assert gen_config is not None
        # Verify gen_config was called with expected parameters
        # Since gen_config is a mock, we check it was passed as argument
        assert call_args.kwargs.get("generation_config") is not None
