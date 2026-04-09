"""Tests for GeminiLLMProvider initialization.

This module tests the provider initialization, configuration,
and API key handling.
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from unittest.mock import Mock

import pytest

from server.infrastructure.llm.gemini_provider import GeminiLLMProvider

if TYPE_CHECKING:
    pass


class TestGeminiProviderInitialization:
    """Test Gemini provider initialization and configuration."""

    def test_init_with_api_key(self, mock_genai: Mock) -> None:
        """Provider initializes with explicit API key."""
        provider = GeminiLLMProvider(api_key="test-key")

        assert provider.provider_name == "gemini"
        assert provider.model == "gemini-1.5-flash"
        assert provider.temperature == 0.7
        mock_genai.configure.assert_called_once_with(api_key="test-key")

    def test_init_from_env_var(self, monkeypatch: pytest.MonkeyPatch, mock_genai: Mock) -> None:
        """Provider initializes from GEMINI_API_KEY environment variable."""
        monkeypatch.setenv("GEMINI_API_KEY", "env-api-key")

        provider = GeminiLLMProvider()

        assert provider.provider_name == "gemini"
        mock_genai.configure.assert_called_once_with(api_key="env-api-key")

    def test_init_missing_api_key(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Provider raises error when API key is missing."""
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)

        with pytest.raises(ValueError, match="API key is required"):
            GeminiLLMProvider()

    def test_default_model(self, mock_genai: Mock) -> None:
        """Provider uses correct default model."""
        provider = GeminiLLMProvider(api_key="test-key")

        assert provider.model == "gemini-1.5-flash"
