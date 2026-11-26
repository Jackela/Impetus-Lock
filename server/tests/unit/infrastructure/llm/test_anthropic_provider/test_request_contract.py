"""Tests for AnthropicLLMProvider request contract.

This module pins the request shape sent to ``messages.create`` so that
SDK migrations cannot silently drop sampling parameters or alter the
payload structure: temperature transmission, max_tokens/system/messages
shape, and compatibility with the installed SDK's create signature.
"""

from __future__ import annotations

import inspect
import json
from typing import TYPE_CHECKING
from unittest.mock import patch

import httpx2
import pytest
from anthropic import Anthropic

from server.infrastructure.llm.anthropic_provider import AnthropicLLMProvider

if TYPE_CHECKING:
    from anthropic.types import Message

# Sentinels for request-shape assertions.
EXPECTED_MAX_TOKENS = 400


def extract_transmitted_temperature(kwargs: dict) -> float | None:
    """Extract the temperature a provider transmitted to messages.create.

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
def anthropic_provider() -> AnthropicLLMProvider:
    """Fixture for AnthropicLLMProvider with a custom temperature."""
    return AnthropicLLMProvider(api_key="sk-ant-test-key", temperature=0.3)


@pytest.fixture
def mock_message() -> Message:
    """Fixture for a real Anthropic Message with a text block."""
    from anthropic.types import Message, TextBlock, Usage

    draft_json = '{"action": "provoke", "content": "门后传来低沉的呼吸声。"}'
    return Message(
        id="msg_test",
        content=[TextBlock(text=draft_json, type="text")],
        model="claude-haiku-4-5-20251001",
        role="assistant",
        stop_reason="end_turn",
        type="message",
        usage=Usage(input_tokens=25, output_tokens=13),
    )


class TestAnthropicRequestContract:
    """Test suite pinning the AnthropicLLMProvider request contract."""

    def test_default_model_on_the_sdk_wire(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """The SDK serializes the current model and parses its JSON text response."""

        def send(request: httpx2.Request) -> httpx2.Response:
            assert request.url.path == "/v1/messages"
            assert request.headers["x-api-key"] == "offline-key"
            body = json.loads(request.content)
            assert body["model"] == "claude-haiku-4-5-20251001"
            assert body["temperature"] == 0.8
            assert body["messages"][0]["role"] == "user"
            return httpx2.Response(
                200,
                json={
                    "id": "msg_offline",
                    "type": "message",
                    "role": "assistant",
                    "model": body["model"],
                    "stop_reason": "end_turn",
                    "stop_sequence": None,
                    "usage": {"input_tokens": 25, "output_tokens": 13},
                    "content": [
                        {"type": "text", "text": '{"action":"provoke","content":"门外有脚步。"}'}
                    ],
                },
            )

        with Anthropic(
            api_key="offline-key",
            base_url="https://api.anthropic.invalid",
            max_retries=0,
            http_client=httpx2.Client(transport=httpx2.MockTransport(send), trust_env=False),
        ) as client:
            monkeypatch.setattr(
                "server.infrastructure.llm.anthropic_provider.Anthropic", lambda **_: client
            )
            draft = AnthropicLLMProvider(api_key="offline-key")._complete("system", "user")
        assert (draft.action, draft.content) == ("provoke", "门外有脚步。")

    def test_temperature_transmitted(
        self,
        anthropic_provider: AnthropicLLMProvider,
        mock_message: Message,
    ) -> None:
        """Test that the configured temperature reaches the create payload."""
        with patch.object(
            anthropic_provider.client.messages,
            "create",
            return_value=mock_message,
        ) as mock_create:
            anthropic_provider._complete("system prompt", "user message")

        kwargs = mock_create.call_args.kwargs
        assert extract_transmitted_temperature(kwargs) == 0.3

    def test_default_temperature_transmitted(self, mock_message: Message) -> None:
        """Test that the default temperature (0.8) reaches the create payload."""
        provider = AnthropicLLMProvider(api_key="sk-ant-test-key")

        with patch.object(
            provider.client.messages,
            "create",
            return_value=mock_message,
        ) as mock_create:
            provider._complete("system prompt", "user message")

        kwargs = mock_create.call_args.kwargs
        assert extract_transmitted_temperature(kwargs) == 0.8

    def test_request_payload_shape(
        self,
        anthropic_provider: AnthropicLLMProvider,
        mock_message: Message,
    ) -> None:
        """Test model, max_tokens, system prompt and messages shape."""
        with patch.object(
            anthropic_provider.client.messages,
            "create",
            return_value=mock_message,
        ) as mock_create:
            anthropic_provider._complete("system prompt", "user message")

        kwargs = mock_create.call_args.kwargs
        assert kwargs["model"] == anthropic_provider.model
        assert kwargs["max_tokens"] == EXPECTED_MAX_TOKENS
        assert kwargs["system"] == "system prompt"
        assert kwargs["messages"] == [
            {
                "role": "user",
                "content": [{"type": "text", "text": "user message"}],
            }
        ]

    def test_create_kwargs_accepted_by_installed_sdk(
        self,
        anthropic_provider: AnthropicLLMProvider,
        mock_message: Message,
    ) -> None:
        """Test every create kwarg is declared by the installed SDK signature.

        messages.create has no **kwargs catch-all: a kwarg removed by an
        SDK major version would raise TypeError at runtime.
        """
        with patch.object(
            anthropic_provider.client.messages,
            "create",
            return_value=mock_message,
        ) as mock_create:
            anthropic_provider._complete("system prompt", "user message")

        kwargs = mock_create.call_args.kwargs
        undeclared = undeclared_create_kwargs(kwargs)
        assert not undeclared, f"kwargs rejected by installed anthropic SDK: {undeclared}"

    def test_draft_parsed_from_text_block(
        self,
        anthropic_provider: AnthropicLLMProvider,
        mock_message: Message,
    ) -> None:
        """Test that the text block is parsed into an intervention draft."""
        with patch.object(
            anthropic_provider.client.messages,
            "create",
            return_value=mock_message,
        ):
            draft = anthropic_provider._complete("system prompt", "user message")

        assert draft.action == "provoke"
        assert draft.content == "门后传来低沉的呼吸声。"
