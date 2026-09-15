"""Tests for GeminiLLMProvider initialization.

This module tests the provider initialization, configuration,
and API key handling.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

from server.infrastructure.llm.gemini_provider import GeminiLLMProvider

if TYPE_CHECKING:
    pass


class TestGeminiProviderInitialization:
    """Test Gemini provider initialization and configuration."""

    def test_init_with_api_key(self) -> None:
        """Provider initializes with explicit API key."""
        provider = GeminiLLMProvider(api_key="test-key")

        assert provider.provider_name == "gemini"
        assert provider.model == "gemini-1.5-flash"
        assert provider.temperature == 0.7

    def test_init_from_env_var(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Provider initializes from GEMINI_API_KEY environment variable."""
        monkeypatch.setenv("GEMINI_API_KEY", "env-api-key")

        provider = GeminiLLMProvider()

        assert provider.provider_name == "gemini"
        assert provider.api_key == "env-api-key"

    def test_init_missing_api_key(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Provider raises error when API key is missing."""
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)

        with pytest.raises(ValueError, match="API key is required"):
            GeminiLLMProvider()

    def test_default_model(self) -> None:
        """Provider uses correct default model."""
        provider = GeminiLLMProvider(api_key="test-key")

        assert provider.model == "gemini-1.5-flash"

    def test_clients_are_instance_scoped(self) -> None:
        """Each provider owns its clients; no shared/global SDK state."""
        provider_one = GeminiLLMProvider(api_key="key-one")
        provider_two = GeminiLLMProvider(api_key="key-two")

        assert provider_one._client is not provider_two._client
        assert provider_one._tokens_client is not provider_two._tokens_client

    def test_close_closes_clients(self) -> None:
        """close() closes both instance-scoped SDK clients."""
        from unittest.mock import MagicMock

        provider = GeminiLLMProvider(api_key="test-key")
        provider._client = MagicMock()
        provider._tokens_client = MagicMock()

        provider.close()

        provider._client.close.assert_called_once_with()
        provider._tokens_client.close.assert_called_once_with()
