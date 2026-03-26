"""Tests for GeminiLLMProvider error handling.

This module tests error mapping, exception handling,
and various failure scenarios.
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from unittest.mock import MagicMock

import pytest

from server.domain.errors import LLMProviderError
from server.infrastructure.llm.gemini_provider import GeminiLLMProvider

if TYPE_CHECKING:
    pass


class TestGeminiProviderErrors:
    """Test error handling for various Gemini API failures."""

    @pytest.mark.parametrize(
        "exception_class,error_code,status_code,error_message",
        [
            (
                "google.generativeai.types.BlockedPromptException",
                "content_blocked",
                400,
                "Content was blocked by safety filters",
            ),
            (
                "google.generativeai.types.InvalidArgument",
                "invalid_api_key",
                401,
                "Invalid API key",
            ),
            (
                "google.api_core.exceptions.ResourceExhausted",
                "quota_exceeded",
                429,
                "Quota exceeded",
            ),
        ],
    )
    def test_error_mapping(
        self,
        provider: GeminiLLMProvider,
        exception_class: str,
        error_code: str,
        status_code: int,
        error_message: str,
    ) -> None:
        """Test that Gemini exceptions are properly mapped to LLMProviderError."""
        # Import dynamically based on exception class
        module_name, class_name = exception_class.rsplit(".", 1)
        module = __import__(module_name, fromlist=[class_name])
        exception = getattr(module, class_name)(error_message)

        provider._model.generate_content.side_effect = exception

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="System prompt", user_message="User message")

        assert exc_info.value.code == error_code
        assert exc_info.value.status_code == status_code
        assert exc_info.value.provider == "gemini"

    def test_blocked_content_error(self, provider: GeminiLLMProvider) -> None:
        """BlockedPromptException maps to content_blocked error."""
        from google.generativeai.types import BlockedPromptException

        provider._model.generate_content.side_effect = BlockedPromptException("Blocked")

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="System prompt", user_message="User message")

        assert exc_info.value.code == "content_blocked"
        assert exc_info.value.status_code == 400
        assert exc_info.value.provider == "gemini"

    def test_auth_error(self, provider: GeminiLLMProvider) -> None:
        """InvalidArgument maps to auth error."""
        from google.generativeai.types import InvalidArgument

        provider._model.generate_content.side_effect = InvalidArgument("Invalid API key")

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="System prompt", user_message="User message")

        assert exc_info.value.code == "invalid_api_key"
        assert exc_info.value.provider == "gemini"

    def test_quota_exceeded(self, provider: GeminiLLMProvider) -> None:
        """ResourceExhausted maps to quota_exceeded error."""
        from google.api_core.exceptions import ResourceExhausted

        provider._model.generate_content.side_effect = ResourceExhausted("Quota exceeded")

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="System prompt", user_message="User message")

        assert exc_info.value.code == "quota_exceeded"
        assert exc_info.value.status_code == 429
        assert exc_info.value.provider == "gemini"

    def test_invalid_response_empty_candidates(self, provider: GeminiLLMProvider) -> None:
        """Empty candidates list raises invalid_response error."""
        mock_response = MagicMock()
        mock_response.candidates = []
        provider._model.generate_content.return_value = mock_response

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="System prompt", user_message="User message")

        assert exc_info.value.code == "invalid_response"
        assert "empty candidates" in exc_info.value.message.lower()

    def test_invalid_response_no_content(self, provider: GeminiLLMProvider) -> None:
        """Missing content raises invalid_response error."""
        mock_response = MagicMock()
        mock_response.candidates = [MagicMock()]
        mock_response.candidates[0].content = None
        provider._model.generate_content.return_value = mock_response

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="System prompt", user_message="User message")

        assert exc_info.value.code == "invalid_response"

    def test_invalid_response_no_text(self, provider: GeminiLLMProvider) -> None:
        """No text content raises invalid_response error."""
        mock_response = MagicMock()
        mock_response.candidates = [MagicMock()]
        mock_response.candidates[0].content.parts = []
        provider._model.generate_content.return_value = mock_response

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="System prompt", user_message="User message")

        assert exc_info.value.code == "invalid_response"
