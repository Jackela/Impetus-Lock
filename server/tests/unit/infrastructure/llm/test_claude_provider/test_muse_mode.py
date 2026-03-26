"""Tests for ClaudeProvider Muse mode.

This module contains tests for ClaudeProvider intervention generation
in muse mode, including provoke and rewrite actions.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING
from unittest.mock import MagicMock, patch

import pytest
from anthropic.types import Message, TextBlock, Usage

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
    """Fixture for mocked Anthropic API response with provoke action."""
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


class TestClaudeProviderMuseMode:
    """Test suite for ClaudeProvider Muse mode interventions."""

    def test_generate_muse_provoke(
        self,
        claude_provider: ClaudeProvider,
        mock_anthropic_response: Message,
    ) -> None:
        """Test intervention generation in muse mode with provoke action."""
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

    def test_generate_muse_rewrite(
        self,
        claude_provider: ClaudeProvider,
    ) -> None:
        """Test intervention generation in muse mode with rewrite action."""
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
                mode="muse",
            )

        assert response.action == "rewrite"
        assert response.content == "门后其实是台手术桌。"
        assert response.lock_id is not None

    def test_muse_with_cursor_position(
        self,
        claude_provider: ClaudeProvider,
        mock_anthropic_response: Message,
    ) -> None:
        """Test intervention generation in muse mode with cursor position."""
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
        assert response.action == "provoke"

    def test_muse_safety_guard(self, claude_provider: ClaudeProvider) -> None:
        """Test that empty context raises ValueError in muse mode."""
        with pytest.raises(ValueError, match="Context cannot be empty"):
            claude_provider.generate_intervention(context="", mode="muse")

    def test_generate_intervention_invalid_mode(self, claude_provider: ClaudeProvider) -> None:
        """Test that invalid mode raises ValueError."""
        with pytest.raises(ValueError, match="Invalid mode: invalid"):
            claude_provider.generate_intervention(
                context="Some context",
                mode="invalid",  # type: ignore[arg-type]
            )
