"""Tests for GeminiLLMProvider token counting.

This module tests token counting functionality and
usage tracking.
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from unittest.mock import MagicMock

import pytest

from server.infrastructure.llm.gemini_provider import GeminiLLMProvider

if TYPE_CHECKING:
    pass


class TestGeminiProviderToken:
    """Test token counting and usage tracking."""

    def test_count_tokens(self, provider: GeminiLLMProvider) -> None:
        """Token counting returns correct value."""
        mock_result = MagicMock()
        mock_result.total_tokens = 42
        provider._model.count_tokens.return_value = mock_result

        count = provider.count_tokens("Hello, world!")

        assert count == 42
        provider._model.count_tokens.assert_called_once_with(contents="Hello, world!")

    def test_token_usage_tracking(self, provider: GeminiLLMProvider) -> None:
        """Token usage is tracked across operations."""
        mock_result = MagicMock()
        mock_result.total_tokens = 100
        provider._model.count_tokens.return_value = mock_result

        # First count
        count1 = provider.count_tokens("First text")
        assert count1 == 100

        # Second count
        mock_result.total_tokens = 50
        count2 = provider.count_tokens("Second text")
        assert count2 == 50

        # Verify both calls were made
        assert provider._model.count_tokens.call_count == 2
