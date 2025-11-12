"""Unit tests for ProviderRegistry BYOK resolution."""

from __future__ import annotations

import os

import pytest

from server.domain.errors import LLMProviderError
from server.infrastructure.llm.anthropic_provider import AnthropicLLMProvider
from server.infrastructure.llm.debug_provider import DebugLLMProvider
from server.infrastructure.llm.provider_registry import (
    ProviderOverride,
    ProviderRegistry,
)


class TestProviderRegistry:
    """Covers env defaults and BYOK overrides."""

    def test_allow_blank_returns_none_when_env_missing(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)

        registry = ProviderRegistry()
        registry.reload()

        assert registry.get_provider(allow_blank=True) is None

    def test_missing_config_raises_when_no_default(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        registry = ProviderRegistry()
        registry.reload()

        with pytest.raises(LLMProviderError) as excinfo:
            registry.get_provider(allow_blank=False)

        assert excinfo.value.code == "llm_not_configured"

    def test_override_with_custom_key_builds_anthropic(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        registry = ProviderRegistry()
        registry.reload()

        provider = registry.get_provider(
            overrides=ProviderOverride(provider="anthropic", api_key="sk-ant-test"),
            allow_blank=False,
        )

        assert isinstance(provider, AnthropicLLMProvider)

    def test_default_provider_cached(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("OPENAI_API_KEY", "sk-default")
        registry = ProviderRegistry()
        registry.reload()

        first = registry.get_provider()
        second = registry.get_provider()

        assert first is second
        assert os.getenv("OPENAI_API_KEY") == "sk-default"

    def test_debug_provider_requires_flag(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("LLM_ALLOW_DEBUG_PROVIDER", raising=False)
        registry = ProviderRegistry()
        registry.reload()

        with pytest.raises(LLMProviderError):
            registry.get_provider(
                overrides=ProviderOverride(provider="debug"),
                allow_blank=False,
            )

    def test_debug_provider_available_when_enabled(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("LLM_ALLOW_DEBUG_PROVIDER", "1")
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        registry = ProviderRegistry()
        registry.reload()

        provider = registry.get_provider(
            overrides=ProviderOverride(provider="debug"),
            allow_blank=False,
        )

        assert isinstance(provider, DebugLLMProvider)
