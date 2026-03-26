"""Tests for ClaudeProvider.

This module contains comprehensive tests for the ClaudeProvider implementation,
covering initialization, intervention generation, error handling, token tracking,
and retry logic.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING
from unittest.mock import MagicMock, patch

import pytest
from anthropic import APIError, AuthenticationError, RateLimitError
from anthropic.types import Message, TextBlock, Usage

from server.domain.errors import LLMProviderError
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
    mock_message = MagicMock(spec=Message)
    mock_message.content = [
        TextBlock(
            text=json.dumps({"action": "provoke", "content": "门后传来低沉的呼吸声。"}), type="text"
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

    def test_init_custom_parameters(self, mock_api_key: str) -> None:
        """Test initialization with custom parameters."""
        provider = ClaudeProvider(
            api_key=mock_api_key,
            model=ClaudeProvider.CLAUDE_35_OPUS,
            temperature=0.5,
            max_tokens=1000,
            max_retries=5,
            use_instructor=False,
        )

        assert provider.model == ClaudeProvider.CLAUDE_35_OPUS
        assert provider.temperature == 0.5
        assert provider.max_tokens == 1000
        assert provider.max_retries == 5
        assert provider.use_instructor is False

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

    def test_validate_model_valid(self, claude_provider: ClaudeProvider) -> None:
        """Test validate_model with valid models."""
        assert claude_provider.validate_model(ClaudeProvider.CLAUDE_35_SONNET) is True
        assert claude_provider.validate_model(ClaudeProvider.CLAUDE_35_OPUS) is True
        assert claude_provider.validate_model("claude-3-5-sonnet-latest") is True

    def test_validate_model_invalid(self, claude_provider: ClaudeProvider) -> None:
        """Test validate_model with invalid models."""
        assert claude_provider.validate_model("gpt-4") is False
        assert claude_provider.validate_model("invalid-model") is False


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


class TestClaudeProviderIntervention:
    """Test suite for ClaudeProvider intervention generation."""

    def test_generate_intervention_muse_mode(
        self,
        claude_provider: ClaudeProvider,
        mock_anthropic_response: Message,
    ) -> None:
        """Test intervention generation in muse mode."""
        with patch.object(
            claude_provider._anthropic_client.messages,
            "create",
            return_value=mock_anthropic_response,
        ):
            response = claude_provider.generate_intervention(
                context="他打开门，犹豫着要不要进去。",
                mode="muse",
            )

        assert response.action == "provoke"
        assert response.content == "门后传来低沉的呼吸声。"
        assert response.lock_id is not None
        assert response.action_id is not None
        assert response.source == "muse"

    def test_generate_intervention_loki_mode(
        self,
        claude_provider: ClaudeProvider,
    ) -> None:
        """Test intervention generation in loki mode."""
        mock_response = MagicMock(spec=Message)
        mock_response.content = [TextBlock(text=json.dumps({"action": "delete"}), type="text")]
        mock_response.stop_reason = "end_turn"
        mock_response.usage = Usage(input_tokens=80, output_tokens=20)

        with patch.object(
            claude_provider._anthropic_client.messages,
            "create",
            return_value=mock_response,
        ):
            response = claude_provider.generate_intervention(
                context="他打开门，犹豫着要不要进去。",
                mode="loki",
            )

        assert response.action == "delete"
        assert response.content is None
        assert response.lock_id is None
        assert response.source == "loki"

    def test_generate_intervention_with_cursor_position(
        self,
        claude_provider: ClaudeProvider,
        mock_anthropic_response: Message,
    ) -> None:
        """Test intervention generation with cursor position."""
        with patch.object(
            claude_provider._anthropic_client.messages,
            "create",
            return_value=mock_anthropic_response,
        ):
            response = claude_provider.generate_intervention(
                context="他打开门，犹豫着要不要进去。",
                mode="muse",
                selection_from=100,
                selection_to=150,
            )

        assert response.anchor.from_ == 150

    def test_generate_intervention_empty_context(self, claude_provider: ClaudeProvider) -> None:
        """Test that empty context raises ValueError."""
        with pytest.raises(ValueError, match="Context cannot be empty"):
            claude_provider.generate_intervention(context="", mode="muse")

    def test_generate_intervention_invalid_mode(self, claude_provider: ClaudeProvider) -> None:
        """Test that invalid mode raises ValueError."""
        with pytest.raises(ValueError, match="Invalid mode: invalid"):
            claude_provider.generate_intervention(
                context="Some context",
                mode="invalid",  # type: ignore[arg-type]
            )

    def test_generate_intervention_rewrite_action(
        self,
        claude_provider: ClaudeProvider,
    ) -> None:
        """Test intervention with rewrite action."""
        mock_response = MagicMock(spec=Message)
        mock_response.content = [
            TextBlock(
                text=json.dumps({"action": "rewrite", "content": "门后其实是台手术桌。"}),
                type="text",
            )
        ]
        mock_response.stop_reason = "end_turn"
        mock_response.usage = Usage(input_tokens=90, output_tokens=40)

        with patch.object(
            claude_provider._anthropic_client.messages,
            "create",
            return_value=mock_response,
        ):
            response = claude_provider.generate_intervention(
                context="他打开门，犹豫着要不要进去。",
                mode="loki",
            )

        assert response.action == "rewrite"
        assert response.content == "门后其实是台手术桌。"
        assert response.lock_id is not None


class TestClaudeProviderErrorHandling:
    """Test suite for ClaudeProvider error handling."""

    def test_rate_limit_error(
        self,
        claude_provider: ClaudeProvider,
    ) -> None:
        """Test handling of rate limit errors."""
        with patch.object(
            claude_provider._anthropic_client.messages,
            "create",
            side_effect=RateLimitError(
                message="Rate limit exceeded",
                response=MagicMock(status_code=429),
                body={"error": {"message": "Rate limit exceeded"}},
            ),
        ):
            with pytest.raises(LLMProviderError) as exc_info:
                claude_provider._complete_with_raw_api("system", "user")

        assert exc_info.value.code == "quota_exceeded"
        assert exc_info.value.status_code == 402

    def test_authentication_error(
        self,
        claude_provider: ClaudeProvider,
    ) -> None:
        """Test handling of authentication errors."""
        with patch.object(
            claude_provider._anthropic_client.messages,
            "create",
            side_effect=AuthenticationError(
                message="Invalid API key",
                response=MagicMock(status_code=401),
                body={"error": {"message": "Invalid API key"}},
            ),
        ):
            with pytest.raises(LLMProviderError) as exc_info:
                claude_provider._complete_with_raw_api("system", "user")

        assert exc_info.value.code == "invalid_api_key"
        assert exc_info.value.status_code == 401

    def test_api_error(
        self,
        claude_provider: ClaudeProvider,
    ) -> None:
        """Test handling of general API errors."""
        with patch.object(
            claude_provider._anthropic_client.messages,
            "create",
            side_effect=APIError(
                message="Internal server error",
                response=MagicMock(status_code=500),
                body={"error": {"message": "Internal server error"}},
            ),
        ):
            with pytest.raises(LLMProviderError) as exc_info:
                claude_provider._complete_with_raw_api("system", "user")

        assert exc_info.value.code == "llm_api_error"
        assert exc_info.value.status_code == 502

    def test_network_error(
        self,
        claude_provider: ClaudeProvider,
    ) -> None:
        """Test handling of network errors."""
        with patch.object(
            claude_provider._anthropic_client.messages,
            "create",
            side_effect=ConnectionError("Network unreachable"),
        ):
            with pytest.raises(LLMProviderError) as exc_info:
                claude_provider._complete_with_raw_api("system", "user")

        assert exc_info.value.code == "llm_network_error"
        assert exc_info.value.status_code == 502

    def test_no_text_blocks_error(
        self,
        claude_provider: ClaudeProvider,
    ) -> None:
        """Test handling of response with no text blocks."""
        mock_response = MagicMock(spec=Message)
        mock_response.content = []
        mock_response.usage = Usage(input_tokens=50, output_tokens=0)

        with patch.object(
            claude_provider._anthropic_client.messages,
            "create",
            return_value=mock_response,
        ):
            with pytest.raises(LLMProviderError) as exc_info:
                claude_provider._complete_with_raw_api("system", "user")

        assert exc_info.value.code == "invalid_response"
        assert "no text blocks" in exc_info.value.message


class TestClaudeProviderRetryLogic:
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
                    response=MagicMock(status_code=503),
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

        with patch.object(
            claude_provider._anthropic_client.messages,
            "create",
            side_effect=APIError(
                message="Service unavailable",
                response=MagicMock(status_code=503),
                body={"error": {"message": "Service unavailable"}},
            ),
        ):
            with pytest.raises(LLMProviderError) as exc_info:
                claude_provider._complete_with_raw_api("system", "user")

        assert exc_info.value.code == "llm_api_error"


class TestClaudeProviderTokenTracking:
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
