"""Tests for ClaudeProvider request contract.

This module pins ClaudeProvider's raw API and Instructor request shapes,
including sampling parameters, structured tools, retries, and token usage.
"""

from __future__ import annotations

import inspect
import json
from collections.abc import Callable
from typing import Any
from unittest.mock import MagicMock, patch

import httpx2
import pytest
from anthropic import Anthropic
from anthropic.types import Message, TextBlock, Usage

from server.domain.errors import LLMProviderError
from server.infrastructure.llm.base_provider import LLMInterventionDraft
from server.infrastructure.llm.claude_provider import ClaudeProvider

Send = Callable[[httpx2.Request], httpx2.Response]
MakeWireProvider = Callable[[Send], ClaudeProvider]


@pytest.fixture
def make_wire_provider(monkeypatch: pytest.MonkeyPatch) -> MakeWireProvider:
    """Use the real SDK and Instructor with an in-memory HTTP transport."""
    monkeypatch.setattr("anthropic._base_client.time.sleep", lambda _: None)

    def make(send: Send) -> ClaudeProvider:
        class OfflineAnthropic(Anthropic):
            def __init__(self, *, api_key: str) -> None:
                super().__init__(
                    api_key=api_key,
                    base_url="https://api.anthropic.invalid",
                    http_client=httpx2.Client(
                        transport=httpx2.MockTransport(send),
                        trust_env=False,
                    ),
                )

        monkeypatch.setattr("anthropic.Anthropic", OfflineAnthropic)
        return ClaudeProvider(api_key="offline-key", temperature=0.6)

    return make


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

    @pytest.mark.parametrize(
        ("actions", "expected_attempts"),
        [(("provoke",), 1), (("invalid", "provoke"), 2), (("invalid",), 4)],
    )
    def test_instructor_tools_with_the_installed_sdk(
        self,
        make_wire_provider: MakeWireProvider,
        actions: tuple[str, ...],
        expected_attempts: int,
    ) -> None:
        """Check the actual Anthropic tool request, validation retry, and terminal error."""
        requests: list[dict[str, Any]] = []

        def send(request: httpx2.Request) -> httpx2.Response:
            assert request.url.path == "/v1/messages"
            assert request.headers["x-api-key"] == "offline-key"
            action = actions[min(len(requests), len(actions) - 1)]
            requests.append(json.loads(request.content))
            return httpx2.Response(
                200,
                json={
                    "id": "msg_offline",
                    "type": "message",
                    "role": "assistant",
                    "model": "claude-sonnet-4-6",
                    "stop_reason": "tool_use",
                    "stop_sequence": None,
                    "usage": {"input_tokens": 28, "output_tokens": 9},
                    "content": [
                        {
                            "type": "tool_use",
                            "id": "toolu_offline",
                            "name": "LLMInterventionDraft",
                            "input": {"action": action, "content": "门外有脚步。"},
                        }
                    ],
                },
            )

        provider = make_wire_provider(send)
        with provider._anthropic_client:
            if actions[-1] == "invalid":
                with pytest.raises(LLMProviderError) as error:
                    provider._complete("system prompt", "user prompt")
                assert (error.value.code, error.value.status_code) == ("llm_api_error", 502)
            else:
                draft = provider._complete("system prompt", "user prompt")
                assert (draft.action, draft.content) == ("provoke", "门外有脚步。")
                usage = provider.last_token_usage
                assert usage is not None
                assert usage.input_tokens == 28 * expected_attempts
                assert usage.output_tokens == 9 * expected_attempts
                assert usage.total_tokens == 37 * expected_attempts

        assert len(requests) == expected_attempts
        first = requests[0]
        assert first["model"] == "claude-sonnet-4-6"
        assert first["temperature"] == 0.6
        assert first["max_tokens"] == provider.max_tokens
        assert first["system"] == [{"type": "text", "text": "system prompt"}]
        assert first["messages"] == [{"role": "user", "content": "user prompt"}]
        (tool,) = first["tools"]
        assert tool["name"] == "LLMInterventionDraft"
        schema = tool["input_schema"]
        assert schema["required"] == ["action"]
        assert set(schema["properties"]) == {"action", "content"}
        assert set(schema["properties"]["action"]["enum"]) == {"provoke", "delete", "rewrite"}
        assert first["tool_choice"]["type"] == "tool"
        assert first["tool_choice"]["name"] == "LLMInterventionDraft"
        if expected_attempts > 1:
            retry = requests[1]
            assert retry["tools"] == first["tools"]
            assert retry["messages"][0] == first["messages"][0]
            assert [message["role"] for message in retry["messages"]] == [
                "user",
                "assistant",
                "user",
            ]
            (correction,) = retry["messages"][-1]["content"]
            assert correction["type"] == "tool_result"
            assert correction["tool_use_id"] == "toolu_offline"

    @pytest.mark.parametrize(
        "upstream_status,upstream_type,code,status,attempts",
        [
            (401, "authentication_error", "invalid_api_key", 401, 1),
            (429, "rate_limit_error", "quota_exceeded", 402, 3),
            (500, "api_error", "llm_api_error", 502, 3),
        ],
    )
    def test_instructor_maps_sdk_http_errors(
        self,
        make_wire_provider: MakeWireProvider,
        upstream_status: int,
        upstream_type: str,
        code: str,
        status: int,
        attempts: int,
    ) -> None:
        """Check provider errors after the real SDK applies its retry policy."""
        requests: list[httpx2.Request] = []

        def send(request: httpx2.Request) -> httpx2.Response:
            requests.append(request)
            return httpx2.Response(
                upstream_status,
                json={
                    "type": "error",
                    "error": {"type": upstream_type, "message": "Synthetic error"},
                },
            )

        provider = make_wire_provider(send)
        with provider._anthropic_client, pytest.raises(LLMProviderError) as error:
            provider._complete("system prompt", "user prompt")

        assert error.value.provider == "claude"
        assert (error.value.code, error.value.status_code) == (code, status)
        assert len(requests) == attempts
