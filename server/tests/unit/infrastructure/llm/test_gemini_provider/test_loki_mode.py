"""Tests for GeminiLLMProvider Loki mode.

This module tests intervention generation in Loki mode,
including chaos and disruptive content actions.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING
from unittest.mock import MagicMock

import pytest

from server.infrastructure.llm.gemini_provider import GeminiLLMProvider

if TYPE_CHECKING:
    pass


class TestGeminiProviderLokiMode:
    """Test intervention generation in Loki mode."""

    def test_generate_loki_chaos(
        self, provider: GeminiLLMProvider, mock_response: MagicMock
    ) -> None:
        """Loki mode generates intervention with chaos action."""
        mock_response.candidates[0].content.parts[0].text = json.dumps({"action": "delete"})
        provider._model.generate_content.return_value = mock_response

        response = provider.generate_intervention(
            context="He opened the door and stepped inside.", mode="loki"
        )

        assert response.action == "delete"
        assert response.content is None
        assert response.lock_id is None
        assert response.source == "loki"

    def test_loki_disruptive_content(
        self, provider: GeminiLLMProvider, mock_response: MagicMock
    ) -> None:
        """Loki mode handles disruptive content appropriately."""
        mock_response.candidates[0].content.parts[0].text = json.dumps({"action": "disrupt"})
        provider._model.generate_content.return_value = mock_response

        response = provider.generate_intervention(
            context="He opened the door and stepped inside.", mode="loki"
        )

        assert response.action == "disrupt"
        assert response.source == "loki"

    def test_loki_safety_threshold(
        self, provider: GeminiLLMProvider, mock_response: MagicMock
    ) -> None:
        """Loki mode uses appropriate safety thresholds."""
        provider._model.generate_content.return_value = mock_response

        response = provider.generate_intervention(context="Test context", mode="loki")

        call_kwargs = provider._model.generate_content.call_args.kwargs
        assert "safety_settings" in call_kwargs
        assert response.source == "loki"
