"""Tests for ClaudeProvider initialization.

This module contains tests for ClaudeProvider initialization scenarios,
including API key configuration, parameter validation, and environment setup.
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from unittest.mock import MagicMock, patch

import pytest
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
    mock_message = MagicMock(spec=Message)
    mock_message.content = [
        TextBlock(
            text='{"action": "provoke", "content": "门后传来低沉的呼吸声。"}',
            type="text",
        )
    ]
    mock_message.stop_reason = "end_turn"
    mock_message.usage = Usage(input_tokens=100, output_tokens=50)
    return mock_message


class TestClaudeProviderInitialization:
    """Test suite for ClaudeProvider initialization."""

    def test_init_with_api_key(self, mock_api_key: str) -> None:
        """Test initialization with explicit API key."""
        provider = ClaudeProvider(api_key=mock_api_key)

        assert provider.model == ClaudeProvider.CLAUDE_35_SONNET
        assert provider.temperature == ClaudeProvider.DEFAULT_TEMPERATURE
        assert provider.max_tokens == ClaudeProvider.DEFAULT_MAX_TOKENS
        assert provider.use_instructor is True

    def test_init_from_env_var(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Test initialization from ANTHROPIC_API_KEY environment variable."""
        monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-env-key")

        provider = ClaudeProvider()

        assert provider._api_key == "sk-ant-env-key"

    def test_init_missing_api_key(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Test initialization fails without API key."""
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

        with pytest.raises(LLMProviderError) as exc_info:
            ClaudeProvider()

        assert exc_info.value.code == "missing_api_key"
        assert exc_info.value.status_code == 401
        assert "Claude API key required" in exc_info.value.message

    @pytest.mark.parametrize(
        "param_name,param_value,expected_attr",
        [
            ("model", ClaudeProvider.CLAUDE_35_OPUS, "model"),
            ("temperature", 0.5, "temperature"),
            ("max_tokens", 1000, "max_tokens"),
            ("max_retries", 5, "max_retries"),
            ("use_instructor", False, "use_instructor"),
        ],
    )
    def test_init_validation(
        self,
        mock_api_key: str,
        param_name: str,
        param_value: object,
        expected_attr: str,
    ) -> None:
        """Test initialization with various custom parameters."""
        kwargs = {param_name: param_value}
        provider = ClaudeProvider(api_key=mock_api_key, **kwargs)

        assert getattr(provider, expected_attr) == param_value

    def test_init_invalid_temperature(self, mock_api_key: str) -> None:
        """Test initialization fails with invalid temperature."""
        with pytest.raises(ValueError, match="Temperature must be between 0.0 and 1.0"):
            ClaudeProvider(api_key=mock_api_key, temperature=1.5)

    def test_init_invalid_max_tokens(self, mock_api_key: str) -> None:
        """Test initialization fails with invalid max_tokens."""
        with pytest.raises(ValueError, match="max_tokens must be at least 1"):
            ClaudeProvider(api_key=mock_api_key, max_tokens=0)

    def test_init_invalid_max_retries(self, mock_api_key: str) -> None:
        """Test initialization fails with invalid max_retries."""
        with pytest.raises(ValueError, match="max_retries must be non-negative"):
            ClaudeProvider(api_key=mock_api_key, max_retries=-1)


class TestClaudeProviderProperties:
    """Test suite for ClaudeProvider properties."""

    def test_provider_name(self, claude_provider: ClaudeProvider) -> None:
        """Test provider_name property."""
        assert claude_provider.provider_name == "claude"

    def test_supported_models(self, claude_provider: ClaudeProvider) -> None:
        """Test get_supported_models method."""
        models = claude_provider.get_supported_models()

        assert ClaudeProvider.CLAUDE_35_SONNET in models
        assert ClaudeProvider.CLAUDE_35_OPUS in models
        assert ClaudeProvider.CLAUDE_35_HAIKU in models
        assert "claude-3-5-sonnet-latest" in models

    @pytest.mark.parametrize(
        "model,expected",
        [
            (ClaudeProvider.CLAUDE_35_SONNET, True),
            (ClaudeProvider.CLAUDE_35_OPUS, True),
            ("claude-3-5-sonnet-latest", True),
            ("gpt-4", False),
            ("invalid-model", False),
        ],
    )
    def test_validate_model(
        self, claude_provider: ClaudeProvider, model: str, expected: bool
    ) -> None:
        """Test validate_model with various models."""
        assert claude_provider.validate_model(model) is expected


class TestClaudeProviderHealthCheck:
    """Test suite for ClaudeProvider health check."""

    def test_health_check_success(
        self,
        claude_provider: ClaudeProvider,
        mock_anthropic_response: Message,
    ) -> None:
        """Test successful health check."""
        with patch.object(
            claude_provider._anthropic_client.messages,
            "create",
            return_value=mock_anthropic_response,
        ):
            result = claude_provider.health_check()
            assert result is True

    def test_health_check_failure(self, claude_provider: ClaudeProvider) -> None:
        """Test failed health check."""
        with patch.object(
            claude_provider._anthropic_client.messages,
            "create",
            side_effect=Exception("API Error"),
        ):
            result = claude_provider.health_check()
            assert result is False


class TestClaudeProviderWithInstructor:
    """Test suite for ClaudeProvider with Instructor integration."""

    def test_init_with_instructor(self, mock_api_key: str) -> None:
        """Test initialization with Instructor enabled."""
        provider = ClaudeProvider(
            api_key=mock_api_key,
            use_instructor=True,
        )

        assert provider.use_instructor is True
        assert provider._instructor_client is not None

    def test_init_without_instructor(self, mock_api_key: str) -> None:
        """Test initialization with Instructor disabled."""
        provider = ClaudeProvider(
            api_key=mock_api_key,
            use_instructor=False,
        )

        assert provider.use_instructor is False
        assert provider._instructor_client is None

    def test_complete_with_instructor_fallback(
        self,
        claude_provider: ClaudeProvider,
    ) -> None:
        """Test that _complete falls back to raw API when Instructor is disabled."""
        import json

        claude_provider.use_instructor = False
        claude_provider._instructor_client = None

        mock_response = MagicMock(spec=Message)
        mock_response.content = [
            TextBlock(text=json.dumps({"action": "provoke", "content": "Test"}), type="text")
        ]
        mock_response.stop_reason = "end_turn"
        mock_response.usage = Usage(input_tokens=50, output_tokens=20)

        with patch.object(
            claude_provider._anthropic_client.messages,
            "create",
            return_value=mock_response,
        ):
            result = claude_provider._complete("system", "user")

        assert result.action == "provoke"
        assert result.content == "Test"


class TestClaudeProviderBackwardCompatibility:
    """Test suite for backward compatibility with AnthropicLLMProvider."""

    def test_claude_llm_provider_alias(self, mock_api_key: str) -> None:
        """Test that ClaudeLLMProvider alias works."""
        from server.infrastructure.llm.claude_provider import ClaudeLLMProvider

        provider = ClaudeLLMProvider(api_key=mock_api_key)
        assert isinstance(provider, ClaudeProvider)
        assert provider.provider_name == "claude"
