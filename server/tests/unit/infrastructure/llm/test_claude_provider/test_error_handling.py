"""Tests for ClaudeProvider error handling.

This module contains tests for ClaudeProvider error mapping and handling,
including rate limits, authentication, server errors, and network issues.
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from unittest.mock import MagicMock, patch

import pytest
from anthropic import APIError, AuthenticationError, RateLimitError

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


class TestClaudeProviderErrors:
    """Test suite for ClaudeProvider error handling."""

    @pytest.mark.parametrize(
        "error_class,error_kwargs,expected_code,expected_status",
        [
            (
                RateLimitError,
                {
                    "message": "Rate limit exceeded",
                    "response": MagicMock(status_code=429),
                    "body": {"error": {"message": "Rate limit exceeded"}},
                },
                "quota_exceeded",
                402,
            ),
            (
                AuthenticationError,
                {
                    "message": "Invalid API key",
                    "response": MagicMock(status_code=401),
                    "body": {"error": {"message": "Invalid API key"}},
                },
                "invalid_api_key",
                401,
            ),
            (
                APIError,
                {
                    "message": "Internal server error",
                    "request": MagicMock(),
                    "body": {"error": {"message": "Internal server error"}},
                },
                "llm_api_error",
                502,
            ),
        ],
    )
    def test_error_mapping(
        self,
        claude_provider: ClaudeProvider,
        error_class: type,
        error_kwargs: dict,
        expected_code: str,
        expected_status: int,
    ) -> None:
        """Test error mapping from Anthropic errors to LLMProviderError."""
        with (
            patch.object(
                claude_provider._anthropic_client.messages,
                "create",
                side_effect=error_class(**error_kwargs),
            ),
            pytest.raises(LLMProviderError) as exc_info,
        ):
            claude_provider._complete_with_raw_api("system", "user")

        assert exc_info.value.code == expected_code
        assert exc_info.value.status_code == expected_status

    def test_rate_limit_error(
        self,
        claude_provider: ClaudeProvider,
    ) -> None:
        """Test handling of rate limit errors."""
        with (
            patch.object(
                claude_provider._anthropic_client.messages,
                "create",
                side_effect=RateLimitError(
                    message="Rate limit exceeded",
                    response=MagicMock(status_code=429),
                    body={"error": {"message": "Rate limit exceeded"}},
                ),
            ),
            pytest.raises(LLMProviderError) as exc_info,
        ):
            claude_provider._complete_with_raw_api("system", "user")

        assert exc_info.value.code == "quota_exceeded"
        assert exc_info.value.status_code == 402

    def test_authentication_error(
        self,
        claude_provider: ClaudeProvider,
    ) -> None:
        """Test handling of authentication errors."""
        with (
            patch.object(
                claude_provider._anthropic_client.messages,
                "create",
                side_effect=AuthenticationError(
                    message="Invalid API key",
                    response=MagicMock(status_code=401),
                    body={"error": {"message": "Invalid API key"}},
                ),
            ),
            pytest.raises(LLMProviderError) as exc_info,
        ):
            claude_provider._complete_with_raw_api("system", "user")

        assert exc_info.value.code == "invalid_api_key"
        assert exc_info.value.status_code == 401

    def test_server_error(
        self,
        claude_provider: ClaudeProvider,
    ) -> None:
        """Test handling of server errors."""
        with (
            patch.object(
                claude_provider._anthropic_client.messages,
                "create",
                side_effect=APIError(
                    message="Internal server error",
                    request=MagicMock(),
                    body={"error": {"message": "Internal server error"}},
                ),
            ),
            pytest.raises(LLMProviderError) as exc_info,
        ):
            claude_provider._complete_with_raw_api("system", "user")

        assert exc_info.value.code == "llm_api_error"
        assert exc_info.value.status_code == 502

    def test_network_error(
        self,
        claude_provider: ClaudeProvider,
    ) -> None:
        """Test handling of network errors."""
        with (
            patch.object(
                claude_provider._anthropic_client.messages,
                "create",
                side_effect=ConnectionError("Network unreachable"),
            ),
            pytest.raises(LLMProviderError) as exc_info,
        ):
            claude_provider._complete_with_raw_api("system", "user")

        assert exc_info.value.code == "llm_network_error"
        assert exc_info.value.status_code == 502

    def test_invalid_response_handling(
        self,
        claude_provider: ClaudeProvider,
    ) -> None:
        """Test handling of response with no text blocks."""
        from anthropic.types import Message, Usage

        mock_response = MagicMock(spec=Message)
        mock_response.content = []
        mock_response.usage = Usage(input_tokens=50, output_tokens=0)

        with (
            patch.object(
                claude_provider._anthropic_client.messages,
                "create",
                return_value=mock_response,
            ),
            pytest.raises(LLMProviderError) as exc_info,
        ):
            claude_provider._complete_with_raw_api("system", "user")

        assert exc_info.value.code == "invalid_response"
        assert "no text blocks" in exc_info.value.message
