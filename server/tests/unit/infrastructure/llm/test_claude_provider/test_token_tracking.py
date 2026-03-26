"""Tests for ClaudeProvider token tracking.

This module contains tests for ClaudeProvider token usage tracking,
including usage calculation and state management.
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from unittest.mock import MagicMock, patch

import pytest
from anthropic.types import Message, TextBlock, Usage

from server.infrastructure.llm.claude_provider import ClaudeProvider, TokenUsage

if TYPE_CHECKING:
    pass


@pytest.fixture
def mock_api_key() -> str:
    """Fixture for mock API key."""
    return "sk-ant-api03-test-key-for-claude"


@pytest.fixture
def claude_provider(mock_api_key: str) -> ClaudeProvider:
    """Fixture for ClaudeProvider instance."""
    return ClaudeProvider(
        api_key=mock_api_key,
        model=ClaudeProvider.CLAUDE_35_SONNET,
        temperature=0.8,
        max_tokens=400,
        use_instructor=False,
    )


@pytest.fixture
def mock_anthropic_response() -> Message:
    """Fixture for mocked Anthropic API response."""
    import json

    mock_message = MagicMock(spec=Message)
    mock_message.content = [
        TextBlock(
            text=json.dumps({"action": "provoke", "content": "门后传来低沉的呼吸声。"}),
            type="text",
        )
    ]
    mock_message.stop_reason = "end_turn"
    mock_message.usage = Usage(input_tokens=100, output_tokens=50)
    return mock_message


class TestClaudeProviderToken:
    """Test suite for ClaudeProvider token tracking."""

    def test_token_usage_tracking(
        self,
        claude_provider: ClaudeProvider,
        mock_anthropic_response: Message,
    ) -> None:
        """Test that token usage is tracked correctly."""
        with patch.object(
            claude_provider._anthropic_client.messages,
            "create",
            return_value=mock_anthropic_response,
        ):
            claude_provider._complete_with_raw_api("system", "user")

        usage = claude_provider.last_token_usage
        assert usage is not None
        assert usage.input_tokens == 100
        assert usage.output_tokens == 50
        assert usage.total_tokens == 150

    def test_token_usage_none_before_request(self, claude_provider: ClaudeProvider) -> None:
        """Test that token usage is None before any request."""
        assert claude_provider.last_token_usage is None


class TestTokenUsage:
    """Test suite for TokenUsage dataclass."""

    def test_token_usage_calculation(self) -> None:
        """Test TokenUsage total calculation."""
        usage = TokenUsage(input_tokens=100, output_tokens=50)

        assert usage.input_tokens == 100
        assert usage.output_tokens == 50
        assert usage.total_tokens == 150

    def test_token_usage_zero(self) -> None:
        """Test TokenUsage with zero values."""
        usage = TokenUsage()

        assert usage.input_tokens == 0
        assert usage.output_tokens == 0
        assert usage.total_tokens == 0

    def test_token_usage_custom_values(self) -> None:
        """Test TokenUsage with custom input/output values."""
        usage = TokenUsage(input_tokens=500, output_tokens=200)

        assert usage.input_tokens == 500
        assert usage.output_tokens == 200
        assert usage.total_tokens == 700
