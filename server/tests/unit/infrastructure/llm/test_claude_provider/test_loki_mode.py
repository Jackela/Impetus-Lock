"""Tests for ClaudeProvider Loki mode.

This module contains tests for ClaudeProvider intervention generation
in loki mode, including chaos actions and randomness.
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


class TestClaudeProviderLokiMode:
    """Test suite for ClaudeProvider Loki mode interventions."""

    def test_generate_loki_provoke(
        self,
        claude_provider: ClaudeProvider,
    ) -> None:
        """Test intervention generation in loki mode with provoke action."""
        mock_response = MagicMock(spec=Message)
        mock_response.content = [
            TextBlock(
                text=json.dumps({"action": "provoke", "content": "门突然自己打开了。"}),
                type="text",
            )
        ]
        mock_response.stop_reason = "end_turn"
        mock_response.usage = Usage(input_tokens=80, output_tokens=25)

        with patch.object(
            claude_provider._anthropic_client.messages,
            "create",
            return_value=mock_response,
        ):
            response = claude_provider.generate_intervention(
                context="他打开门，犹豫着要不要进去。",
                mode="loki",
            )

        assert response.action == "provoke"
        assert response.content == "门突然自己打开了。"
        assert response.source == "loki"

    def test_generate_loki_chaos(
        self,
        claude_provider: ClaudeProvider,
    ) -> None:
        """Test intervention generation in loki mode with chaos/delete action."""
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

    def test_loki_randomness(
        self,
        claude_provider: ClaudeProvider,
    ) -> None:
        """Test that loki mode generates varied responses."""
        responses = []

        for action in ["provoke", "delete", "rewrite"]:
            content = {"action": action}
            if action != "delete":
                content["content"] = f"Test content for {action}"

            mock_response = MagicMock(spec=Message)
            mock_response.content = [TextBlock(text=json.dumps(content), type="text")]
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
                responses.append(response.action)

        assert "provoke" in responses
        assert "delete" in responses
        assert "rewrite" in responses

    def test_loki_with_selection(
        self,
        claude_provider: ClaudeProvider,
    ) -> None:
        """Test loki mode intervention with text selection."""
        mock_response = MagicMock(spec=Message)
        mock_response.content = [
            TextBlock(
                text=json.dumps({"action": "rewrite", "content": "重写的内容"}),
                type="text",
            )
        ]
        mock_response.stop_reason = "end_turn"
        mock_response.usage = Usage(input_tokens=90, output_tokens=30)

        with patch.object(
            claude_provider._anthropic_client.messages,
            "create",
            return_value=mock_response,
        ):
            response = claude_provider.generate_intervention(
                context="他打开门，犹豫着要不要进去。",
                mode="loki",
                selection_from=50,
                selection_to=100,
            )

        assert response.action == "rewrite"
        assert response.content == "重写的内容"
        # Anchor is calculated as AnchorRange(from_=max(0, cursor_pos-120), to=cursor_pos)
        # With selection_to=100: from_=max(0, 100-120)=0, to=100
        assert response.anchor.to == 100
        assert response.anchor.from_ == 0
        assert response.content == "重写的内容"
        # Anchor is calculated as AnchorRange(from_=max(0, cursor_pos-120), to=cursor_pos)
        # With selection_to=100: from_=max(0, 100-120)=0, to=100
        assert response.anchor.to == 100
        assert response.anchor.from_ == 0
        assert response.content == "重写的内容"
        assert response.anchor.from_ == 0
