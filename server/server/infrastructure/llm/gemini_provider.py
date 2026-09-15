"""Google Gemini provider implemented via the google-genai SDK.

This module provides a Gemini LLM provider that implements the LLMProvider
protocol. It supports both Muse (supportive, creative) and Loki (disruptive,
wildcard) modes with configurable safety settings and token counting.

Features:
    - Gemini model support via instance-scoped ``genai.Client`` (no global SDK
      configuration, so BYOK credentials never cross requests)
    - Structured JSON outputs for intervention generation
    - Safety settings configuration (string categories/thresholds)
    - Token counting utilities
    - Streaming support (optional)
    - Proper error handling for rate limits and auth failures

Example:
    >>> provider = GeminiLLMProvider(
    ...     api_key="your-api-key",
    ...     model="gemini-2.0-flash-lite",
    ...     temperature=0.7
    ... )
    >>> response = provider.generate_intervention(
    ...     context="他打开门，犹豫着要不要进去。",
    ...     mode="muse"
    ... )
    >>> response.action
    'provoke'
"""

from __future__ import annotations

import os
from typing import TYPE_CHECKING, Any

from server.domain.errors import LLMProviderError
from server.infrastructure.llm.base_provider import BasePromptLLMProvider, LLMInterventionDraft
from server.infrastructure.llm.prompts.loki_prompt import get_loki_prompts
from server.infrastructure.llm.prompts.muse_prompt import get_muse_prompts

if TYPE_CHECKING:
    from collections.abc import Iterator

    from google.genai.client import Client
    from google.genai.types import GenerateContentConfig

# Effective outbound-attempt budget carried over from the legacy
# google-generativeai SDK (measured 2026-09-15 with a fake clock at the legacy
# GAPIC wrapped-RPC boundary; see
# tests/unit/infrastructure/llm/test_gemini_provider/test_migration_parity.py):
#
# - generate_content on a persistent retryable failure (503): 5 trials gave
#   [123, 137, 136, 119, 134] outbound attempts under a 600s retry deadline
#   with backoff initial=1s, multiplier=1.3, max=10s (plus jitter). The legacy
#   predicate retried ONLY ServiceUnavailable (HTTP 503).
# - count_tokens on the same failure: 18 attempts under its 60s deadline.
#
# The google-genai SDK applies one retry policy per client, so the generation
# and token-counting budgets use separate clients. Deliberately configured
# (never SDK defaults): attempts mirror the measured legacy budgets, the
# retriable status codes match the legacy ServiceUnavailable-only predicate,
# and the backoff schedule mirrors the legacy 1s/1.3x/10s parameters. Total
# wall time still differs slightly because the legacy and new SDK jitter
# formulas are not identical.
_GENERATE_RETRY_ATTEMPTS = 120  # within the measured [119, 137] envelope
_COUNT_TOKENS_RETRY_ATTEMPTS = 18  # measured under the legacy 60s deadline
_RETRY_INITIAL_DELAY_SECONDS = 1.0
_RETRY_MAX_DELAY_SECONDS = 10.0
_RETRY_EXP_BASE = 1.3
_RETRIABLE_STATUS_CODES = (503,)

# Safety settings: Gemini models have default safety filters that may block
# some content. For creative writing interventions, we use medium thresholds
# to balance safety with creative freedom. The google-genai SDK accepts
# string category/threshold values with the same names the legacy
# HarmCategory/HarmBlockThreshold enums used.
_DEFAULT_SAFETY_SETTINGS: list[dict[str, str]] = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
]

# Candidate finish reasons that mean the content was blocked mid-generation.
# The legacy SDK surfaced these as StopCandidateException; google-genai only
# reports them via response metadata.
_BLOCKED_FINISH_REASONS = {"SAFETY", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII"}


def _build_retry_options(attempts: int) -> Any:
    """Build explicit HTTP retry options mirroring the characterized legacy budget."""
    from google.genai.types import HttpOptions, HttpRetryOptions

    return HttpOptions(
        retry_options=HttpRetryOptions(
            attempts=attempts,
            initial_delay=_RETRY_INITIAL_DELAY_SECONDS,
            max_delay=_RETRY_MAX_DELAY_SECONDS,
            exp_base=_RETRY_EXP_BASE,
            http_status_codes=_RETRIABLE_STATUS_CODES,
        ),
    )


class GeminiLLMProvider(BasePromptLLMProvider):
    """Google Gemini LLM provider using the google-genai SDK.

    Each provider instance owns its ``genai.Client`` scoped to the resolved
    API key, so concurrent BYOK requests can never read each other's
    credentials and no process-global SDK configuration is touched.

    Attributes:
        provider_name: Provider identifier for error reporting.
        model: Gemini model name (e.g., "gemini-2.0-flash-lite").
        temperature: Sampling temperature (0.0 to 1.0).
        safety_settings: Configured safety thresholds for content filtering.

    Example:
        >>> provider = GeminiLLMProvider(
        ...     api_key="AIzaSy...",
        ...     model="gemini-2.0-flash-lite",
        ...     temperature=0.7
        ... )
        >>> draft = provider._complete(
        ...     system_prompt="You are a helpful assistant.",
        ...     user_message="Generate a creative twist."
        ... )
    """

    provider_name = "gemini"

    # Supported Gemini models
    SUPPORTED_MODELS: set[str] = {
        "gemini-1.5-pro",
        "gemini-1.5-pro-latest",
        "gemini-1.5-flash",
        "gemini-1.5-flash-latest",
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
    }

    def __init__(
        self,
        api_key: str | None = None,
        model: str = "gemini-1.5-flash",
        temperature: float = 0.7,
        safety_settings: list[dict[str, str]] | None = None,
    ) -> None:
        """Initialize the Gemini provider.

        Args:
            api_key: Google Generative AI API key. If not provided, will read
                from GEMINI_API_KEY environment variable.
            model: Gemini model name. Defaults to "gemini-1.5-flash".
            temperature: Sampling temperature (0.0 to 1.0). Defaults to 0.7.
            safety_settings: Optional custom safety settings
                (``{"category": ..., "threshold": ...}`` dicts).

        Raises:
            ValueError: If the API key is not provided and not in environment,
                or if the model is not supported.

        Example:
            >>> provider = GeminiLLMProvider(
            ...     api_key="AIzaSy...",
            ...     model="gemini-2.0-flash-lite",
            ...     temperature=0.8
            ... )
        """
        # Resolve API key from parameter or environment variable first.
        resolved_api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not resolved_api_key:
            raise ValueError("API key is required")

        import google.genai as genai

        super().__init__(model=model, temperature=temperature)

        self.api_key = resolved_api_key
        self.safety_settings: list[dict[str, str]] = (
            safety_settings if safety_settings is not None else self._get_default_safety_settings()
        )

        # Validate model
        if model not in self.SUPPORTED_MODELS:
            # Allow unknown models for forward compatibility with new releases
            pass

        # Instance-scoped clients: generation/streaming and token counting
        # carry separate characterized retry budgets (see module docstring).
        self._client: Client = genai.Client(
            api_key=self.api_key,
            http_options=_build_retry_options(_GENERATE_RETRY_ATTEMPTS),
        )
        self._tokens_client: Client = genai.Client(
            api_key=self.api_key,
            http_options=_build_retry_options(_COUNT_TOKENS_RETRY_ATTEMPTS),
        )

    @classmethod
    def _get_default_safety_settings(cls) -> list[dict[str, str]]:
        """Get default safety settings (string categories and thresholds)."""
        return [dict(setting) for setting in _DEFAULT_SAFETY_SETTINGS]

    def close(self) -> None:
        """Close the instance-scoped SDK clients and their HTTP transports."""
        for client in (getattr(self, "_client", None), getattr(self, "_tokens_client", None)):
            if client is not None:
                client.close()

    def _complete(self, system_prompt: str, user_message: str) -> LLMInterventionDraft:
        """Generate a completion using Gemini.

        This method sends the system prompt and user message to the Gemini
        API and returns a validated LLMInterventionDraft.

        Args:
            system_prompt: System instructions defining the LLM's role.
            user_message: User context and instructions.

        Returns:
            LLMInterventionDraft: Validated draft with action and content.

        Raises:
            LLMProviderError: If the API call fails, rate limited, blocked,
                or returns invalid response.

        Example:
            >>> draft = provider._complete(
            ...     system_prompt="You are a creative writing assistant.",
            ...     user_message="Context: 他打开门..."
            ... )
            >>> draft.action
            'provoke'
            >>> draft.content
            '门后传来低沉的呼吸声。'
        """
        full_prompt = self._build_prompt(system_prompt, user_message)
        generation_config = self._create_generation_config()
        response = self._generate_content(full_prompt, generation_config)
        return self._parse_gemini_response(response)

    def _build_prompt(self, system_prompt: str, user_message: str) -> str:
        """Build the full prompt from system and user messages.

        Gemini doesn't have native system message support in the same way as
        OpenAI/Anthropic, so we prepend system instructions.

        Args:
            system_prompt: System instructions defining the LLM's role.
            user_message: User context and instructions.

        Returns:
            Combined full prompt string.
        """
        return f"{system_prompt}\n\n{user_message}"

    def _create_generation_config(self) -> GenerateContentConfig:
        """Create the generation configuration for Gemini.

        Returns:
            GenerateContentConfig with temperature, max_output_tokens,
            response_mime_type and safety_settings.
        """
        from google.genai.types import GenerateContentConfig

        return GenerateContentConfig(
            temperature=self.temperature,
            max_output_tokens=512,
            response_mime_type="application/json",
            safety_settings=self.safety_settings,
        )

    def _generate_content(self, full_prompt: str, generation_config: Any) -> Any:
        """Generate content using the Gemini API.

        Args:
            full_prompt: The full prompt to send to the API.
            generation_config: Configuration for generation.

        Returns:
            Response from the Gemini API.

        Raises:
            LLMProviderError: If the API call fails.
        """
        import httpx
        from google.genai import errors as genai_errors

        try:
            return self._client.models.generate_content(
                model=self.model,
                contents=full_prompt,
                config=generation_config,
            )
        except genai_errors.ClientError as exc:
            raise self._map_client_error(exc) from exc
        except genai_errors.ServerError as exc:
            if exc.code == 504:
                raise LLMProviderError(
                    code="timeout",
                    message="Gemini request timed out.",
                    status_code=504,
                    provider=self.provider_name,
                ) from exc
            raise LLMProviderError(
                code="llm_api_error",
                message="Gemini API internal error.",
                status_code=502,
                provider=self.provider_name,
            ) from exc
        except genai_errors.APIError as exc:
            raise LLMProviderError(
                code="llm_api_error",
                message=f"Gemini request failed: {exc.__class__.__name__}",
                status_code=502,
                provider=self.provider_name,
            ) from exc
        except httpx.TimeoutException as exc:
            raise LLMProviderError(
                code="timeout",
                message="Gemini request timed out.",
                status_code=504,
                provider=self.provider_name,
            ) from exc
        except Exception as exc:
            raise LLMProviderError(
                code="llm_api_error",
                message=f"Gemini request failed: {exc.__class__.__name__}",
                status_code=502,
                provider=self.provider_name,
            ) from exc

    @staticmethod
    def _map_client_error(exc: Any) -> LLMProviderError:
        """Map a google-genai ClientError to the public error contract.

        The legacy SDK surfaced invalid keys as InvalidArgument/PermissionDenied
        and mapped them to 401; google-genai reports the same failure as
        ``ClientError(code=400)``, so dispatch on ``.code`` to keep the
        400/401/429 status semantics.

        Args:
            exc: The ``google.genai.errors.ClientError`` to map.

        Returns:
            The equivalent ``LLMProviderError``.
        """
        if exc.code == 429:
            return LLMProviderError(
                code="quota_exceeded",
                message="Gemini quota exceeded. Provide another key or try later.",
                status_code=429,
                provider="gemini",
            )
        if exc.code in (400, 401, 403):
            return LLMProviderError(
                code="invalid_api_key",
                message="Gemini API key rejected.",
                status_code=401,
                provider="gemini",
            )
        return LLMProviderError(
            code="llm_api_error",
            message=f"Gemini request failed: {exc.__class__.__name__}",
            status_code=502,
            provider="gemini",
        )

    def _parse_gemini_response(self, response: Any) -> LLMInterventionDraft:
        """Parse and validate the Gemini API response.

        The google-genai SDK no longer raises blocked-prompt/stopped-candidate
        exceptions, so both conditions are detected from response metadata
        (``prompt_feedback.block_reason`` and the candidate ``finish_reason``).

        Args:
            response: Response from the Gemini API.

        Returns:
            Validated LLMInterventionDraft.

        Raises:
            LLMProviderError: If the response is invalid or the content was
                blocked.
        """
        prompt_feedback = getattr(response, "prompt_feedback", None)
        if getattr(prompt_feedback, "block_reason", None):
            raise LLMProviderError(
                code="content_blocked",
                message="Content blocked by Gemini safety filters.",
                status_code=400,
                provider=self.provider_name,
            )

        candidates = getattr(response, "candidates", None) or []
        if not candidates:
            raise LLMProviderError(
                code="invalid_response",
                message="Gemini returned empty candidates",
                status_code=502,
                provider=self.provider_name,
            )

        candidate = candidates[0]
        content = getattr(candidate, "content", None)
        parts = getattr(content, "parts", None) or []
        if not parts:
            raise self._no_content_error(candidate)

        text_parts = [part.text for part in parts if getattr(part, "text", None)]
        if not text_parts:
            raise self._no_content_error(candidate)

        text = text_parts[0]
        draft: LLMInterventionDraft = LLMInterventionDraft.model_validate_json(text)
        return draft

    def _no_content_error(self, candidate: Any) -> LLMProviderError:
        """Map a contentless candidate to generation_stopped or invalid_response.

        A blocked finish reason (the legacy ``StopCandidateException``) maps
        to ``generation_stopped``/502; any other empty result stays
        ``invalid_response``/502.

        Args:
            candidate: The response candidate without usable text.

        Returns:
            The equivalent ``LLMProviderError``.
        """
        finish_reason = getattr(candidate, "finish_reason", None)
        finish_name = getattr(finish_reason, "name", None) or str(finish_reason)
        if finish_name in _BLOCKED_FINISH_REASONS:
            return LLMProviderError(
                code="generation_stopped",
                message="Generation stopped unexpectedly.",
                status_code=502,
                provider=self.provider_name,
            )
        return LLMProviderError(
            code="invalid_response",
            message="Gemini returned no text content",
            status_code=502,
            provider=self.provider_name,
        )

    def count_tokens(self, text: str) -> int:
        """Count tokens in the given text.

        Uses Gemini's token counting API to get the exact token count
        for the given text. Useful for checking context limits.

        Args:
            text: Text to count tokens for.

        Returns:
            int: Number of tokens in the text.

        Example:
            >>> provider.count_tokens("Hello, world!")
            4
        """
        try:
            result = self._tokens_client.models.count_tokens(
                model=self.model,
                contents=text,
            )
            tokens: int = result.total_tokens
            return tokens
        except Exception:
            # Fallback: rough estimate (1 token ≈ 4 characters for most languages)
            return len(text) // 4

    def health_check(self) -> bool:
        """Check if the Gemini API is accessible.

        Performs a lightweight API check to verify connectivity
        and API key validity.

        Returns:
            bool: True if API is accessible, False otherwise.

        Example:
            >>> if provider.health_check():
            ...     print("Gemini API is ready")
            ... else:
            ...     print("Gemini API is not available")
        """
        try:
            # Perform a minimal token count check
            self._tokens_client.models.count_tokens(
                model=self.model,
                contents="test",
            )
            return True
        except Exception:
            return False

    def stream_intervention(
        self,
        context: str,
        mode: str,
    ) -> Iterator[str]:
        """Stream intervention generation (optional feature).

        Streams the LLM response token by token for real-time
        intervention generation. This is useful for showing
        progress in the UI.

        Args:
            context: Writing context for the intervention.
            mode: "muse" or "loki" mode.

        Yields:
            str: Text chunks as they are generated.

        Note:
            This is an optional feature for advanced use cases.
            The base implementation doesn't use streaming.

        Example:
            >>> for chunk in provider.stream_intervention("Context...", "muse"):
            ...     print(chunk, end="")
        """
        if mode == "muse":
            system_prompt, user_message = get_muse_prompts(context)
        else:
            system_prompt, user_message = get_loki_prompts(context)

        full_prompt = f"{system_prompt}\n\n{user_message}"

        import httpx

        generation_config = self._create_generation_config()

        try:
            for chunk in self._client.models.generate_content_stream(
                model=self.model,
                contents=full_prompt,
                config=generation_config,
            ):
                if chunk.text:
                    yield chunk.text
        except httpx.TimeoutException as exc:
            raise LLMProviderError(
                code="timeout",
                message="Gemini streaming request timed out.",
                status_code=504,
                provider=self.provider_name,
            ) from exc
        except Exception as exc:
            raise LLMProviderError(
                code="llm_api_error",
                message=f"Streaming failed: {exc.__class__.__name__}",
                status_code=502,
                provider=self.provider_name,
            ) from exc
