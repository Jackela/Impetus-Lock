"""Tests for ClaudeProvider request contract.

This module pins the request shape ClaudeProvider sends to the Anthropic
API so that SDK migrations cannot silently drop sampling parameters or
alter the payload structure: temperature transmission and payload shape
on the raw API path, temperature transmission on the Instructor path,
and compatibility with the installed SDK's create signature.
"""

from __future__ import annotations

import inspect
import json
from typing import TYPE_CHECKING
from unittest.mock import MagicMock, patch

import pytest
from anthropic.types import Message, TextBlock, Usage

from server.infrastructure.llm.base_provider import LLMInterventionDraft
from server.infrastructure.llm.claude_provider import ClaudeProvider

if TYPE_CHECKING:
    pass


def extract_transmitted_temperature(kwargs: dict) -> float | None:
    """Extract the temperature a provider transmitted to the API call.

    Accepts both call forms so the assertion pins the external behavior
    (temperature reaches the request payload) rather than one SDK shape:
    a direct ``temperature=`` kwarg or ``extra_body={"temperature": ...}``.

    Args:
        kwargs: Keyword arguments captured from a mocked create call.

    Returns:
        The transmitted temperature, or None if not transmitted.
    """
    if "temperature" in kwargs:
        return kwargs["temperature"]
    extra_body = kwargs.get("extra_body") or {}
    return extra_body.get("temperature")


def undeclared_create_kwargs(kwargs: dict) -> set[str]:
    """Return kwarg names the installed SDK's create signature rejects.

    ``messages.create`` has no ``**kwargs`` catch-all, so any kwarg not
    declared by the installed anthropic SDK raises TypeError at runtime.

    Args:
        kwargs: Keyword arguments captured from a mocked create call.

    Returns:
        Set of kwarg names not accepted by the installed SDK.
    """
    from anthropic import Anthropic

    signature = inspect.signature(Anthropic(api_key="test").messages.create)
    declared = set(signature.parameters)
    return set(kwargs) - declared


@pytest.fixture
def mock_api_key() -> str:
    """Fixture for mock API key."""
    return "sk-ant-api03-test-key-for-claude"


@pytest.fixture
def claude_provider(mock_api_key: str) -> ClaudeProvider:
    """Fixture for ClaudeProvider with raw API path and custom temperature."""
    return ClaudeProvider(
        api_key=mock_api_key,
        model=ClaudeProvider.CLAUDE_35_SONNET,
        temperature=0.5,
        max_tokens=400,
        use_instructor=False,
    )


@pytest.fixture
def mock_anthropic_response() -> Message:
    """Fixture for mocked Anthropic API response."""
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


class TestClaudeRawApiRequestContract:
    """Test suite pinning the ClaudeProvider raw API request contract."""

    def test_temperature_transmitted(
        self,
        claude_provider: ClaudeProvider,
        mock_anthropic_response: Message,
    ) -> None:
        """Test that the configured temperature reaches the create payload."""
        with patch.object(
            claude_provider._anthropic_client.messages,
            "create",
            return_value=mock_anthropic_response,
        ) as mock_create:
            claude_provider._complete_with_raw_api("system prompt", "user message")

        kwargs = mock_create.call_args.kwargs
        assert extract_transmitted_temperature(kwargs) == 0.5

    def test_default_temperature_transmitted(self, mock_api_key: str) -> None:
        """Test that the default temperature (0.8) reaches the create payload."""
        provider = ClaudeProvider(api_key=mock_api_key, use_instructor=False)

        mock_message = MagicMock(spec=Message)
        mock_message.content = [TextBlock(text=json.dumps({"action": "provoke"}), type="text")]
        mock_message.stop_reason = "end_turn"
        mock_message.usage = Usage(input_tokens=10, output_tokens=5)

        with patch.object(
            provider._anthropic_client.messages,
            "create",
            return_value=mock_message,
        ) as mock_create:
            provider._complete_with_raw_api("system prompt", "user message")

        kwargs = mock_create.call_args.kwargs
        assert extract_transmitted_temperature(kwargs) == ClaudeProvider.DEFAULT_TEMPERATURE

    def test_request_payload_shape(
        self,
        claude_provider: ClaudeProvider,
        mock_anthropic_response: Message,
    ) -> None:
        """Test model, max_tokens, system prompt and messages shape."""
        with patch.object(
            claude_provider._anthropic_client.messages,
            "create",
            return_value=mock_anthropic_response,
        ) as mock_create:
            claude_provider._complete_with_raw_api("system prompt", "user message")

        kwargs = mock_create.call_args.kwargs
        assert kwargs["model"] == ClaudeProvider.CLAUDE_35_SONNET
        assert kwargs["max_tokens"] == ClaudeProvider.DEFAULT_MAX_TOKENS
        assert kwargs["system"] == "system prompt"
        assert kwargs["messages"] == [
            {
                "role": "user",
                "content": [{"type": "text", "text": "user message"}],
            }
        ]

    def test_create_kwargs_accepted_by_installed_sdk(
        self,
        claude_provider: ClaudeProvider,
        mock_anthropic_response: Message,
    ) -> None:
        """Test every create kwarg is declared by the installed SDK signature.

        messages.create has no **kwargs catch-all: a kwarg removed by an
        SDK major version would raise TypeError at runtime.
        """
        with patch.object(
            claude_provider._anthropic_client.messages,
            "create",
            return_value=mock_anthropic_response,
        ) as mock_create:
            claude_provider._complete_with_raw_api("system prompt", "user message")

        kwargs = mock_create.call_args.kwargs
        undeclared = undeclared_create_kwargs(kwargs)
        assert not undeclared, f"kwargs rejected by installed anthropic SDK: {undeclared}"

    def test_usage_tokens_extracted(
        self,
        claude_provider: ClaudeProvider,
        mock_anthropic_response: Message,
    ) -> None:
        """Test that usage input/output tokens are extracted from the response."""
        with patch.object(
            claude_provider._anthropic_client.messages,
            "create",
            return_value=mock_anthropic_response,
        ):
            claude_provider._complete_with_raw_api("system prompt", "user message")

        usage = claude_provider.last_token_usage
        assert usage is not None
        assert usage.input_tokens == 100
        assert usage.output_tokens == 50


class TestClaudeInstructorRequestContract:
    """Test suite pinning the ClaudeProvider Instructor request contract."""

    def test_temperature_transmitted(self, mock_api_key: str) -> None:
        """Test that the temperature reaches the instructor create call."""
        provider = ClaudeProvider(api_key=mock_api_key, use_instructor=True)

        draft = LLMInterventionDraft(action="provoke", content="Test content")
        raw_response = MagicMock()
        raw_response.usage.input_tokens = 120
        raw_response.usage.output_tokens = 60

        with patch.object(
            provider._instructor_client.chat.completions,
            "create_with_completion",
            return_value=(draft, raw_response),
        ) as mock_create:
            result = provider._complete("system prompt", "user message")

        kwargs = mock_create.call_args.kwargs
        assert extract_transmitted_temperature(kwargs) == ClaudeProvider.DEFAULT_TEMPERATURE
        assert result.action == "provoke"

    def test_usage_tokens_tracked(self, mock_api_key: str) -> None:
        """Test that usage tokens from the raw response are tracked."""
        provider = ClaudeProvider(api_key=mock_api_key, use_instructor=True)

        draft = LLMInterventionDraft(action="provoke", content="Test content")
        raw_response = MagicMock()
        raw_response.usage.input_tokens = 120
        raw_response.usage.output_tokens = 60

        with patch.object(
            provider._instructor_client.chat.completions,
            "create_with_completion",
            return_value=(draft, raw_response),
        ):
            provider._complete("system prompt", "user message")

        usage = provider.last_token_usage
        assert usage is not None
        assert usage.input_tokens == 120
        assert usage.output_tokens == 60
