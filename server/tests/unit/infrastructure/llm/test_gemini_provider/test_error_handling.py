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
        "code,error_code,status_code",
        [
            (400, "invalid_api_key", 401),
            (401, "invalid_api_key", 401),
            (403, "invalid_api_key", 401),
            (429, "quota_exceeded", 429),
            (404, "llm_api_error", 502),
        ],
    )
    def test_client_error_dispatch(
        self,
        provider: GeminiLLMProvider,
        code: int,
        error_code: str,
        status_code: int,
    ) -> None:
        """google-genai ClientError maps by HTTP code to the public contract."""
        import httpx
        from google.genai import errors

        provider._client.models.generate_content.side_effect = errors.ClientError(
            code=code,
            response_json={"error": {"message": "boom", "status": "FAILED"}},
            response=httpx.Response(code),
        )

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="System prompt", user_message="User message")

        assert exc_info.value.code == error_code
        assert exc_info.value.status_code == status_code
        assert exc_info.value.provider == "gemini"

    @pytest.mark.parametrize(
        "code,error_code,status_code",
        [
            (504, "timeout", 504),
            (500, "llm_api_error", 502),
            (503, "llm_api_error", 502),
        ],
    )
    def test_server_error_dispatch(
        self,
        provider: GeminiLLMProvider,
        code: int,
        error_code: str,
        status_code: int,
    ) -> None:
        """google-genai ServerError maps 504 to timeout, others to 502."""
        from google.genai import errors

        provider._client.models.generate_content.side_effect = errors.ServerError(
            code=code,
            response_json={"error": {"message": "boom", "status": "UNAVAILABLE"}},
        )

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="System prompt", user_message="User message")

        assert exc_info.value.code == error_code
        assert exc_info.value.status_code == status_code
        assert exc_info.value.provider == "gemini"

    def test_httpx_timeout_maps_to_504(self, provider: GeminiLLMProvider) -> None:
        """Local client timeouts (httpx.TimeoutException) map to timeout / 504."""
        import httpx

        provider._client.models.generate_content.side_effect = httpx.ReadTimeout("timed out")

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="System prompt", user_message="User message")

        assert exc_info.value.code == "timeout"
        assert exc_info.value.status_code == 504

    def test_generic_error_maps_to_502(self, provider: GeminiLLMProvider) -> None:
        """Unexpected failures map to llm_api_error / 502."""
        provider._client.models.generate_content.side_effect = RuntimeError("boom")

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="System prompt", user_message="User message")

        assert exc_info.value.code == "llm_api_error"
        assert exc_info.value.status_code == 502

    def test_blocked_prompt_maps_to_400(self, provider: GeminiLLMProvider) -> None:
        """prompt_feedback.block_reason maps to content_blocked / 400."""
        from tests.unit.infrastructure.llm.test_gemini_provider.conftest import (
            make_blocked_prompt_response,
        )

        provider._client.models.generate_content.return_value = make_blocked_prompt_response()

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="System prompt", user_message="User message")

        assert exc_info.value.code == "content_blocked"
        assert exc_info.value.status_code == 400
        assert exc_info.value.provider == "gemini"

    def test_stopped_candidate_maps_to_502(self, provider: GeminiLLMProvider) -> None:
        """A blocked finish_reason with no text maps to generation_stopped / 502."""
        from tests.unit.infrastructure.llm.test_gemini_provider.conftest import (
            make_stopped_candidate_response,
        )

        provider._client.models.generate_content.return_value = make_stopped_candidate_response()

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="System prompt", user_message="User message")

        assert exc_info.value.code == "generation_stopped"
        assert exc_info.value.status_code == 502

    def test_invalid_response_empty_candidates(self, provider: GeminiLLMProvider) -> None:
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

    def test_invalid_response_no_content(self, provider: GeminiLLMProvider) -> None:
        """Missing content raises invalid_response error."""
        mock_response = MagicMock()
        mock_response.candidates = [MagicMock()]
        mock_response.candidates[0].content = None
        mock_response.prompt_feedback = MagicMock()
        mock_response.prompt_feedback.block_reason = None
        provider._client.models.generate_content.return_value = mock_response

        with pytest.raises(LLMProviderError) as exc_info:
            provider._complete(system_prompt="System prompt", user_message="User message")

        assert exc_info.value.code == "invalid_response"

    def test_invalid_response_no_text(self, provider: GeminiLLMProvider) -> None:
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
