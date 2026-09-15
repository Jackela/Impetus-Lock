"""Tests for GeminiLLMProvider streaming.

This module tests streaming intervention generation,
including error handling and timeouts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from unittest.mock import MagicMock

import pytest

from server.domain.errors import LLMProviderError
from server.infrastructure.llm.gemini_provider import GeminiLLMProvider

if TYPE_CHECKING:
    pass


class TestGeminiProviderStreaming:
    """Test streaming intervention generation."""

    def test_stream_intervention(self, provider: GeminiLLMProvider) -> None:
        """Streaming intervention yields chunks correctly."""
        chunks = [
            MagicMock(text='{"action": "'),
            MagicMock(text='provoke", "'),
            MagicMock(text='content": "'),
            MagicMock(text='Test"}'),
        ]
        provider._client.models.generate_content_stream.return_value = iter(chunks)

        result = list(provider.stream_intervention("Context", "muse"))

        assert result == ['{"action": "', 'provoke", "', 'content": "', 'Test"}']

    def test_stream_error_handling(self, provider: GeminiLLMProvider) -> None:
        """Streaming raises LLMProviderError on failure."""
        provider._client.models.generate_content_stream.side_effect = RuntimeError("Stream error")

        with pytest.raises(LLMProviderError) as exc_info:
            list(provider.stream_intervention("Context", "muse"))

        assert exc_info.value.code == "llm_api_error"
        assert "Streaming failed" in exc_info.value.message

    def test_stream_timeout(self, provider: GeminiLLMProvider) -> None:
        """Local httpx timeouts during streaming map to timeout / 504."""
        import httpx

        provider._client.models.generate_content_stream.side_effect = httpx.ReadTimeout("Timeout")

        with pytest.raises(LLMProviderError) as exc_info:
            list(provider.stream_intervention("Context", "muse"))

        assert exc_info.value.code == "timeout"
        assert exc_info.value.status_code == 504
        assert exc_info.value.provider == "gemini"
