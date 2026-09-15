"""Tests for AnthropicLLMProvider error mapping.

This module pins the mapping from anthropic SDK errors to
LLMProviderError (429 rate limit, 401 authentication, generic APIError)
across SDK migrations.
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from unittest.mock import MagicMock, patch

import pytest
from anthropic import APIError, AuthenticationError, RateLimitError

from server.domain.errors import LLMProviderError
from server.infrastructure.llm.anthropic_provider import AnthropicLLMProvider

if TYPE_CHECKING:
    pass


@pytest.fixture
def anthropic_provider() -> AnthropicLLMProvider:
    """Fixture for AnthropicLLMProvider instance."""
    return AnthropicLLMProvider(api_key="sk-ant-test-key")


class TestAnthropicErrorMapping:
    """Test suite for AnthropicLLMProvider error mapping."""

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
        anthropic_provider: AnthropicLLMProvider,
        error_class: type,
        error_kwargs: dict,
        expected_code: str,
        expected_status: int,
    ) -> None:
        """Test error mapping from anthropic errors to LLMProviderError."""
        with (
            patch.object(
                anthropic_provider.client.messages,
                "create",
                side_effect=error_class(**error_kwargs),
            ),
            pytest.raises(LLMProviderError) as exc_info,
        ):
            anthropic_provider._complete("system", "user")

        assert exc_info.value.code == expected_code
        assert exc_info.value.status_code == expected_status
