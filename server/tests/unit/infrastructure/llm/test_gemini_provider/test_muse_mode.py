"""Tests for GeminiLLMProvider Muse mode.

This module tests intervention generation in Muse mode,
including provoke and rewrite actions.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING
from unittest.mock import MagicMock

from server.infrastructure.llm.gemini_provider import GeminiLLMProvider

if TYPE_CHECKING:
    pass


class TestGeminiProviderMuseMode:
    """Test intervention generation in Muse mode."""

    def test_generate_muse_provoke(
        self, provider: GeminiLLMProvider, mock_response: MagicMock
    ) -> None:
        """Muse mode generates intervention with provoke action."""
        provider._model.generate_content.return_value = mock_response

        response = provider.generate_intervention(context="He opened the door.", mode="muse")

        assert response.action == "provoke"
        assert response.content == "Test intervention content"
        assert response.source == "muse"
        assert response.lock_id is not None
        assert response.action_id is not None

    def test_generate_muse_rewrite(
        self, provider: GeminiLLMProvider, mock_response: MagicMock
    ) -> None:
        """Muse mode handles rewrite action correctly."""
        mock_response.candidates[0].content.parts[0].text = json.dumps(
            {"action": "rewrite", "content": "He smashed the door open."}
        )
        provider._model.generate_content.return_value = mock_response

        response = provider.generate_intervention(context="He opened the door.", mode="muse")

        assert response.action == "rewrite"
        assert response.content == "He smashed the door open."
        assert response.lock_id is not None

    def test_muse_with_safety_settings(
        self, provider: GeminiLLMProvider, mock_response: MagicMock
    ) -> None:
        """Muse mode respects safety settings."""
        provider._model.generate_content.return_value = mock_response

        response = provider.generate_intervention(context="He opened the door.", mode="muse")

        # Check that safety_settings was set on the provider
        assert provider.safety_settings is not None
        assert response.action == "provoke"
