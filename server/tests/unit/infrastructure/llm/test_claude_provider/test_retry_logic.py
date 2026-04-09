"""Tests for ClaudeProvider retry logic.

This module contains tests for ClaudeProvider retry behavior,
including transient error retry, retry exhaustion, and auth error handling.
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from unittest.mock import MagicMock, patch

import pytest
from anthropic import APIError, AuthenticationError
from anthropic.types import Message, TextBlock, Usage

from server.domain.errors import LLMProviderError
from server.infrastructure.llm.claude_provider import ClaudeProvider

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


class TestClaudeProviderRetry:
    """Test suite for ClaudeProvider retry logic."""

    def test_retry_on_transient_error(
        self,
        claude_provider: ClaudeProvider,
        mock_anthropic_response: Message,
    ) -> None:
        """Test retry logic on transient errors."""
        claude_provider.max_retries = 2

        call_count = 0

        def side_effect(*args: object, **kwargs: object) -> Message:
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise APIError(
                    message="Service unavailable",
                    request=MagicMock(),
                    body={"error": {"message": "Service unavailable"}},
                )
            return mock_anthropic_response

        with patch.object(
            claude_provider._anthropic_client.messages,
            "create",
            side_effect=side_effect,
        ):
            result = claude_provider._complete_with_raw_api("system", "user")

        assert call_count == 2
        assert result.action == "provoke"

    def test_retry_exhausted_raises_error(
        self,
        claude_provider: ClaudeProvider,
    ) -> None:
        """Test that error is raised after retries are exhausted."""
        claude_provider.max_retries = 1

        with (
            patch.object(
                claude_provider._anthropic_client.messages,
                "create",
                side_effect=APIError(
                    message="Service unavailable",
                    request=MagicMock(),
                    body={"error": {"message": "Service unavailable"}},
                ),
            ),
            pytest.raises(LLMProviderError) as exc_info,
        ):
            claude_provider._complete_with_raw_api("system", "user")

        assert exc_info.value.code == "llm_api_error"

    def test_no_retry_on_auth_error(
        self,
        claude_provider: ClaudeProvider,
    ) -> None:
        """Test that authentication errors are not retried."""
        claude_provider.max_retries = 3
        call_count = 0

        def side_effect(*args: object, **kwargs: object) -> Message:
            nonlocal call_count
            call_count += 1
            raise AuthenticationError(
                message="Invalid API key",
                response=MagicMock(status_code=401),
                body={"error": {"message": "Invalid API key"}},
            )

        with (
            patch.object(
                claude_provider._anthropic_client.messages,
                "create",
                side_effect=side_effect,
            ),
            pytest.raises(LLMProviderError),
        ):
            claude_provider._complete_with_raw_api("system", "user")

        # Should only be called once - no retries for auth errors
        assert call_count == 1

    def test_retry_count_tracking(
        self,
        claude_provider: ClaudeProvider,
        mock_anthropic_response: Message,
    ) -> None:
        """Test that retry count is tracked correctly."""
        claude_provider.max_retries = 3
        call_count = 0

        def side_effect(*args: object, **kwargs: object) -> Message:
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise APIError(
                    message="Service unavailable",
                    request=MagicMock(),
                    body={"error": {"message": "Service unavailable"}},
                )
            return mock_anthropic_response

        with patch.object(
            claude_provider._anthropic_client.messages,
            "create",
            side_effect=side_effect,
        ):
            result = claude_provider._complete_with_raw_api("system", "user")

        # Should succeed on 3rd attempt after 2 retries
        assert call_count == 3
        assert result.action == "provoke"
