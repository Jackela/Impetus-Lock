"""Provider registry + header override parsing."""

from __future__ import annotations

import importlib
import importlib.util
import logging
import os
from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal, cast

from server.domain.errors import LLMProviderError
from server.domain.llm_provider import LLMProvider

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

ProviderName = Literal["openai", "anthropic", "claude", "gemini", "debug"]

_API_KEY_ENV: dict[ProviderName, str] = {
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "claude": "ANTHROPIC_API_KEY",
    "gemini": "GEMINI_API_KEY",
    "debug": "DEBUG_API_KEY",
}

_MODEL_ENV_VARS: dict[ProviderName, str] = {
    "openai": "OPENAI_MODEL",
    "anthropic": "ANTHROPIC_MODEL",
    "claude": "CLAUDE_MODEL",
    "gemini": "GEMINI_MODEL",
    "debug": "DEBUG_MODEL",
}

_MODEL_FALLBACKS: dict[ProviderName, str] = {
    "openai": "gpt-4o-mini",
    "anthropic": "claude-3-5-haiku-latest",
    "claude": "claude-3-5-sonnet-20241022",
    "gemini": "gemini-2.0-flash-lite",
    "debug": "debug-model",
}

_TEMP_ENV_VARS: dict[ProviderName, str] = {
    "openai": "OPENAI_TEMPERATURE",
    "anthropic": "ANTHROPIC_TEMPERATURE",
    "claude": "CLAUDE_TEMPERATURE",
    "gemini": "GEMINI_TEMPERATURE",
    "debug": "DEBUG_TEMPERATURE",
}

_TEMP_FALLBACKS: dict[ProviderName, float] = {
    "openai": 0.9,
    "anthropic": 0.8,
    "claude": 0.8,
    "gemini": 0.7,
    "debug": 0.0,
}


@dataclass
class ProviderConfig:
    provider: ProviderName
    api_key: str
    model: str
    temperature: float


@dataclass
class ProviderOverride:
    provider: str | None = None
    model: str | None = None
    api_key: str | None = None


class ProviderFactory:
    """Factory for creating provider instances with deferred imports.

    Uses a registry pattern to reduce duplication in provider instantiation.
    """

    @dataclass
    class ProviderSpec:
        """Specification for a provider."""

        module: str
        class_name: str
        install_msg: str
        no_args: bool = False

    # Registry of provider configurations
    _REGISTRY: dict[ProviderName, ProviderSpec] = {
        "openai": ProviderSpec(
            module="server.infrastructure.llm.instructor_provider",
            class_name="InstructorLLMProvider",
            install_msg=(
                "OpenAI provider is not available. Install with: pip install openai instructor"
            ),
        ),
        "anthropic": ProviderSpec(
            module="server.infrastructure.llm.anthropic_provider",
            class_name="AnthropicLLMProvider",
            install_msg="Anthropic provider is not available. Install with: pip install anthropic",
        ),
        "claude": ProviderSpec(
            module="server.infrastructure.llm.claude_provider",
            class_name="ClaudeProvider",
            install_msg="Claude provider is not available. Install with: pip install anthropic",
        ),
        "gemini": ProviderSpec(
            module="server.infrastructure.llm.gemini_provider",
            class_name="GeminiLLMProvider",
            install_msg=(
                "Gemini provider is not available. Install with: pip install google-generativeai"
            ),
        ),
        "debug": ProviderSpec(
            module="server.infrastructure.llm.debug_provider",
            class_name="DebugLLMProvider",
            install_msg="Debug provider is not available.",
            no_args=True,
        ),
    }

    @classmethod
    def create(cls, provider_name: ProviderName, config: ProviderConfig) -> LLMProvider:
        """Create a provider instance using the registry.

        Args:
            provider_name: Name of the provider.
            config: Provider configuration.

        Returns:
            Instantiated provider.

        Raises:
            LLMProviderError: If provider cannot be instantiated.
        """
        spec = cls._REGISTRY.get(provider_name)
        if not spec:
            raise LLMProviderError(
                code="unsupported_provider",
                message=f"Unsupported provider: {provider_name}",
                status_code=422,
                provider=provider_name,
            )

        try:
            module = importlib.import_module(spec.module)
            provider_class = getattr(module, spec.class_name)
        except ImportError as e:
            logger.warning(f"{provider_name} provider not available: {e}")
            raise LLMProviderError(
                code="provider_unavailable",
                message=spec.install_msg,
                status_code=503,
                provider=provider_name,
            ) from e

        # Instantiate with appropriate arguments
        if spec.no_args:
            return provider_class()

        return provider_class(
            api_key=config.api_key,
            model=config.model,
            temperature=config.temperature,
        )

    @classmethod
    def is_available(cls, provider_name: ProviderName) -> bool:
        """Check if a provider module is available without importing.

        Args:
            provider_name: Name of the provider.

        Returns:
            True if the module exists, False otherwise.
        """
        spec = cls._REGISTRY.get(provider_name)
        if not spec:
            return False

        try:
            found_spec = importlib.util.find_spec(spec.module)
            return found_spec is not None
        except Exception:
            return False


class ProviderRegistry:
    """Resolves provider instances from env defaults or BYOK overrides."""

    def __init__(self) -> None:
        self._allow_debug = _is_truthy(os.getenv("LLM_ALLOW_DEBUG_PROVIDER")) or _is_truthy(
            os.getenv("TESTING")
        )
        self.default_provider: ProviderName = self._coerce_provider(
            os.getenv("LLM_DEFAULT_PROVIDER", "openai")
        )
        self._default_configs = self._load_default_configs()
        self._default_instances: dict[ProviderName, LLMProvider] = {}

    def reload(self) -> None:
        """Reload env backed defaults (used by tests)."""

        self._default_configs = self._load_default_configs()
        self._default_instances.clear()

    def get_provider(
        self,
        overrides: ProviderOverride | None = None,
        *,
        allow_blank: bool = False,
    ) -> LLMProvider | None:
        resolved = self._resolve_config(overrides, allow_blank=allow_blank)
        if resolved is None:
            return None
        config, cacheable = resolved
        return self._build_provider(config, cacheable=cacheable)

    def _resolve_config(
        self,
        overrides: ProviderOverride | None,
        *,
        allow_blank: bool = False,
    ) -> tuple[ProviderConfig, bool] | None:
        override = overrides or ProviderOverride()
        normalized_provider = self._coerce_provider(override.provider or self.default_provider)

        model_override = _normalize(override.model)
        api_key_override = _normalize(override.api_key)

        if normalized_provider == "debug":
            if not self._allow_debug:
                raise LLMProviderError(
                    code="unsupported_provider",
                    message="Debug provider disabled",
                    status_code=422,
                    provider="debug",
                )
            return (
                ProviderConfig(
                    provider="debug",
                    api_key="",
                    model=model_override or _default_model("debug"),
                    temperature=_default_temperature("debug"),
                ),
                True,
            )

        if api_key_override:
            model = model_override or _default_model(normalized_provider)
            return (
                ProviderConfig(
                    provider=normalized_provider,
                    api_key=api_key_override,
                    model=model,
                    temperature=_default_temperature(normalized_provider),
                ),
                False,
            )

        default_cfg = self._default_configs.get(normalized_provider)
        if default_cfg:
            model = model_override or default_cfg.model
            return (
                ProviderConfig(
                    provider=normalized_provider,
                    api_key=default_cfg.api_key,
                    model=model,
                    temperature=default_cfg.temperature,
                ),
                True,
            )

        if allow_blank:
            return None

        raise LLMProviderError(
            code="llm_not_configured",
            message="Server-side LLM key missing. Provide BYOK credentials.",
            status_code=503,
            provider=normalized_provider,
        )

    def _build_provider(self, config: ProviderConfig, *, cacheable: bool) -> LLMProvider:
        if cacheable:
            cached = self._default_instances.get(config.provider)
            if cached is not None:
                return cached

        provider = self._instantiate(config)
        if cacheable:
            self._default_instances[config.provider] = provider
        return provider

    def _instantiate(self, config: ProviderConfig) -> LLMProvider:
        """Instantiate provider using the factory pattern."""
        return ProviderFactory.create(config.provider, config)

    def _load_default_configs(self) -> dict[ProviderName, ProviderConfig]:
        configs: dict[ProviderName, ProviderConfig] = {}

        for provider_name, env_key in _API_KEY_ENV.items():
            api_key = _normalize(os.getenv(env_key))
            if provider_name == "debug":
                if not self._allow_debug:
                    continue
                # Check if debug provider is available
                if not self._is_provider_available("debug"):
                    logger.debug("Debug provider not available, skipping registration")
                    continue
                configs[provider_name] = ProviderConfig(
                    provider=provider_name,
                    api_key="",
                    model=_default_model(provider_name),
                    temperature=_default_temperature(provider_name),
                )
                continue
            if not api_key:
                continue

            # Check if provider is available before registering
            if not self._is_provider_available(provider_name):
                logger.debug(f"{provider_name} provider not available, skipping registration")
                continue

            configs[provider_name] = ProviderConfig(
                provider=provider_name,
                api_key=api_key,
                model=_default_model(provider_name),
                temperature=_default_temperature(provider_name),
            )

        return configs

    def _is_provider_available(self, provider_name: ProviderName) -> bool:
        """Check if a provider module can be imported without hanging."""
        return ProviderFactory.is_available(provider_name)

    def _coerce_provider(self, name: str | None) -> ProviderName:
        normalized = (name or "openai").strip().lower()
        allowed = {"openai", "anthropic", "claude", "gemini"}
        if self._allow_debug:
            allowed.add("debug")
        if normalized not in allowed:
            raise LLMProviderError(
                code="unsupported_provider",
                message=f"Unsupported provider: {normalized}",
                status_code=422,
                provider=normalized,
            )
        return cast(ProviderName, normalized)


def _normalize(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _default_model(provider: ProviderName) -> str:
    env_value = _normalize(os.getenv(_MODEL_ENV_VARS[provider]))
    return env_value or _MODEL_FALLBACKS[provider]


def _default_temperature(provider: ProviderName) -> float:
    env_value = _normalize(os.getenv(_TEMP_ENV_VARS[provider]))
    if env_value is None:
        return _TEMP_FALLBACKS[provider]
    try:
        return float(env_value)
    except ValueError:
        return _TEMP_FALLBACKS[provider]


def _is_truthy(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "on"}
