"""Claude LLM Provider with structured outputs via Instructor.

This module provides an enhanced Claude provider that leverages Instructor
for Pydantic-based structured outputs, with support for Muse and Loki modes,
token usage tracking, and configurable parameters.

Constitutional Compliance:
- Article IV (SOLID): Implements LLMProvider protocol via BasePromptLLMProvider
- Article V (Documentation): Complete Google-style docstrings
"""

from __future__ import annotations

import os
from typing import TYPE_CHECKING, Any, cast

from anthropic.types import Message

from server.domain.errors import LLMProviderError
from server.infrastructure.llm.base_provider import (
    BasePromptLLMProvider,
    LLMInterventionDraft,
    TokenUsage,
)

if TYPE_CHECKING:
    pass


class ClaudeProvider(BasePromptLLMProvider):
    """Claude provider with Instructor integration for structured outputs.

    Supports Claude 3.5 Sonnet and Opus models with configurable parameters,
    Muse/Loki modes, and comprehensive error handling with retries.

    Features:
        - Muse mode: Provocative, encouraging tone
        - Loki mode: Chaotic, creative, challenging
        - Structured JSON outputs via Instructor
        - Token usage tracking
        - Configurable temperature and max_tokens
        - Retry logic for transient failures

    Example:
        >>> provider = ClaudeProvider(
        ...     api_key="sk-ant-...",
        ...     model="claude-3-5-sonnet-20241022",
        ...     temperature=0.8,
        ... )
        >>> response = provider.generate_intervention(
        ...     context="他打开门，犹豫着要不要进去。",
        ...     mode="muse"
        ... )
        >>> response.action
        'provoke'
    """

    provider_name = "claude"

    # Supported models
    CLAUDE_35_SONNET = "claude-3-5-sonnet-20241022"
    CLAUDE_35_OPUS = "claude-3-opus-20240229"
    CLAUDE_35_HAIKU = "claude-3-5-haiku-20241022"

    # Default configuration
    DEFAULT_MAX_TOKENS = 400
    DEFAULT_TEMPERATURE = 0.8
    DEFAULT_MAX_RETRIES = 3

    def __init__(
        self,
        api_key: str | None = None,
        model: str = CLAUDE_35_SONNET,
        temperature: float = DEFAULT_TEMPERATURE,
        max_tokens: int = DEFAULT_MAX_TOKENS,
        max_retries: int = DEFAULT_MAX_RETRIES,
        use_instructor: bool = True,
    ) -> None:
        """Initialize Claude provider.

        Args:
            api_key: Anthropic API key. If not provided, reads from ANTHROPIC_API_KEY env var.
            model: Claude model to use (defaults to claude-3-5-sonnet-20241022).
            temperature: Sampling temperature (0.0 to 1.0).
            max_tokens: Maximum tokens to generate.
            max_retries: Number of retries for transient errors.
            use_instructor: Whether to use Instructor for structured outputs.

        Raises:
            LLMProviderError: If API key is not provided and not found in environment.
            ValueError: If temperature or max_tokens are out of valid range.
        """
        super().__init__(model=model, temperature=temperature)

        # Resolve API key
        self._api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        if not self._api_key:
            raise LLMProviderError(
                code="missing_api_key",
                message="Claude API key required. Set ANTHROPIC_API_KEY or pass api_key.",
                status_code=401,
                provider=self.provider_name,
            )

        # Validate parameters
        if not 0.0 <= temperature <= 1.0:
            raise ValueError(f"Temperature must be between 0.0 and 1.0, got {temperature}")
        if max_tokens < 1:
            raise ValueError(f"max_tokens must be at least 1, got {max_tokens}")
        if max_retries < 0:
            raise ValueError(f"max_retries must be non-negative, got {max_retries}")

        self.max_tokens = max_tokens
        self.max_retries = max_retries
        self.use_instructor = use_instructor
        self._last_token_usage: TokenUsage | None = None

        # Import and initialize clients
        import instructor
        from anthropic import Anthropic

        self._anthropic_client = Anthropic(api_key=self._api_key)

        # Initialize Instructor client if requested
        if use_instructor:
            self._instructor_client = instructor.from_anthropic(
                self._anthropic_client,
                mode=instructor.Mode.ANTHROPIC_TOOLS,
            )
        else:
            self._instructor_client = None

    @property
    def last_token_usage(self) -> TokenUsage | None:
        """Get token usage from the last request."""
        return self._last_token_usage

    def health_check(self) -> bool:
        """Check if the provider is healthy and API key is valid.

        Returns:
            True if the provider can connect to Anthropic API, False otherwise.
        """
        try:
            # Make a minimal API call to verify connectivity
            response = self._anthropic_client.messages.create(
                model=self.model,
                max_tokens=10,
                messages=[{"role": "user", "content": "Hi"}],
            )
            return response.stop_reason is not None
        except Exception:
            return False

    def _complete(self, system_prompt: str, user_message: str) -> LLMInterventionDraft:
        """Complete a prompt and return a validated intervention draft.

        Uses Instructor for structured outputs if enabled, otherwise falls back
        to raw API calls with JSON parsing.

        Args:
            system_prompt: System instructions for the LLM.
            user_message: User message content.

        Returns:
            Validated LLMInterventionDraft with action and optional content.

        Raises:
            LLMProviderError: If the API call fails or response is invalid.
        """
        if self.use_instructor and self._instructor_client:
            return self._complete_with_instructor(system_prompt, user_message)
        return self._complete_with_raw_api(system_prompt, user_message)

    def _complete_with_instructor(
        self,
        system_prompt: str,
        user_message: str,
    ) -> LLMInterventionDraft:
        """Use Instructor for structured outputs.

        Args:
            system_prompt: System instructions.
            user_message: User message.

        Returns:
            Validated LLMInterventionDraft.
        """
        from anthropic import (
            APIError,
            AuthenticationError,
            RateLimitError,
        )

        try:
            # Instructor handles retries internally
            completion, raw_response = (
                self._instructor_client.chat.completions.create_with_completion(
                    model=self.model,
                    max_tokens=self.max_tokens,
                    temperature=self.temperature,
                    response_model=LLMInterventionDraft,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message},
                    ],
                )
            )

            # Track token usage if available
            if hasattr(raw_response, "usage"):
                self._last_token_usage = TokenUsage(
                    input_tokens=getattr(raw_response.usage, "input_tokens", 0),
                    output_tokens=getattr(raw_response.usage, "output_tokens", 0),
                )

            return cast(LLMInterventionDraft, completion)
        except RateLimitError as exc:
            raise LLMProviderError(
                code="quota_exceeded",
                message="Claude quota exceeded. Provide another key or try later.",
                status_code=402,
                provider=self.provider_name,
            ) from exc
        except AuthenticationError as exc:
            raise LLMProviderError(
                code="invalid_api_key",
                message="Claude API key rejected.",
                status_code=401,
                provider=self.provider_name,
            ) from exc
        except APIError as exc:
            raise LLMProviderError(
                code="llm_api_error",
                message=f"Claude API error: {exc.__class__.__name__}: {exc}",
                status_code=502,
                provider=self.provider_name,
            ) from exc
        except (OSError, ConnectionError) as exc:
            raise LLMProviderError(
                code="llm_network_error",
                message="Network error connecting to Claude API.",
                status_code=502,
                provider=self.provider_name,
            ) from exc
        except Exception as exc:
            raise LLMProviderError(
                code="llm_api_error",
                message=f"Claude request failed: {exc}",
                status_code=502,
                provider=self.provider_name,
            ) from exc

    def _complete_with_raw_api(
        self,
        system_prompt: str,
        user_message: str,
    ) -> LLMInterventionDraft:
        """Use raw Anthropic API with JSON parsing.

        Args:
            system_prompt: System instructions.
            user_message: User message.

        Returns:
            Validated LLMInterventionDraft.
        """
        payload = self._build_api_payload(user_message)
        attempt = 0
        last_error: Exception | None = None

        while attempt <= self.max_retries:
            try:
                message = self._call_anthropic_api(system_prompt, payload)
                return self._parse_anthropic_response(message)
            except Exception as exc:
                should_retry, last_error = self._handle_api_error(exc, attempt)
                if not should_retry:
                    raise
                attempt += 1

        return self._handle_retry_exhausted(last_error)

    def _build_api_payload(self, user_message: str) -> list[dict[str, Any]]:
        """Build the API payload for Anthropic request.

        Args:
            user_message: User message content.

        Returns:
            List of message parameters for the API call.
        """
        return [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": user_message,
                    }
                ],
            }
        ]

    def _call_anthropic_api(
        self,
        system_prompt: str,
        payload: list[dict[str, Any]],
    ) -> Message:
        """Make the actual API call to Anthropic.

        Args:
            system_prompt: System instructions.
            payload: Message payload.

        Returns:
            Raw message response from Anthropic.
        """
        return self._anthropic_client.messages.create(
            model=self.model,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            system=system_prompt,
            messages=payload,
        )

    def _parse_anthropic_response(self, message: Message) -> LLMInterventionDraft:
        """Parse and validate the API response.

        Args:
            message: Raw message from Anthropic API.

        Returns:
            Validated LLMInterventionDraft.

        Raises:
            LLMProviderError: If response parsing fails.
        """
        from anthropic.types import TextBlock

        # Track token usage
        if message.usage:
            self._last_token_usage = TokenUsage(
                input_tokens=message.usage.input_tokens,
                output_tokens=message.usage.output_tokens,
            )

        # Extract text blocks
        text_blocks = [block.text for block in message.content if isinstance(block, TextBlock)]
        if not text_blocks:
            raise LLMProviderError(
                code="invalid_response",
                message="Claude returned no text blocks",
                status_code=502,
                provider=self.provider_name,
            )

        return cast(LLMInterventionDraft, LLMInterventionDraft.model_validate_json(text_blocks[0]))

    def _handle_api_error(
        self,
        exc: Exception,
        attempt: int,
    ) -> tuple[bool, Exception | None]:
        """Handle API errors and determine if retry is needed.

        Args:
            exc: The exception that occurred.
            attempt: Current attempt number.

        Returns:
            Tuple of (should_retry, last_error).

        Raises:
            LLMProviderError: For non-retryable errors.
        """
        from anthropic import (
            APIError,
            AuthenticationError,
            RateLimitError,
        )

        # Check specific error types
        if isinstance(exc, RateLimitError):
            return self._handle_rate_limit_error(exc, attempt)
        if isinstance(exc, AuthenticationError):
            return self._handle_auth_error(exc, attempt)
        if isinstance(exc, APIError):
            return self._handle_api_error_response(exc, attempt)
        if isinstance(exc, OSError | ConnectionError):
            return self._handle_network_error(exc, attempt)
        if isinstance(exc, LLMProviderError):
            return self._handle_provider_error(exc, attempt)

        # Unknown error - don't retry
        raise LLMProviderError(
            code="llm_api_error",
            message=f"Claude request failed: {exc}",
            status_code=502,
            provider=self.provider_name,
        ) from exc

    def _handle_rate_limit_error(
        self,
        exc: Exception,
        attempt: int,
    ) -> tuple[bool, Exception | None]:
        """Handle rate limit errors.

        Args:
            exc: The rate limit exception.
            attempt: Current attempt number.

        Returns:
            Tuple of (should_retry, last_error) or raises LLMProviderError.
        """
        if attempt < self.max_retries:
            return True, exc
        raise LLMProviderError(
            code="quota_exceeded",
            message="Claude quota exceeded. Provide another key or try later.",
            status_code=402,
            provider=self.provider_name,
        ) from exc

    def _handle_auth_error(
        self,
        exc: Exception,
        attempt: int,
    ) -> tuple[bool, Exception | None]:
        """Handle authentication errors.

        Args:
            exc: The authentication exception.
            attempt: Current attempt number (unused).

        Raises:
            LLMProviderError: Always raises for auth errors.
        """
        raise LLMProviderError(
            code="invalid_api_key",
            message="Claude API key rejected.",
            status_code=401,
            provider=self.provider_name,
        ) from exc

    def _handle_api_error_response(
        self,
        exc: Exception,
        attempt: int,
    ) -> tuple[bool, Exception | None]:
        """Handle general API errors.

        Args:
            exc: The API error exception.
            attempt: Current attempt number.

        Returns:
            Tuple of (should_retry, last_error) or raises LLMProviderError.
        """
        if attempt < self.max_retries:
            return True, exc
        raise LLMProviderError(
            code="llm_api_error",
            message=f"Claude API error: {exc.__class__.__name__}",
            status_code=502,
            provider=self.provider_name,
        ) from exc

    def _handle_network_error(
        self,
        exc: Exception,
        attempt: int,
    ) -> tuple[bool, Exception | None]:
        """Handle network errors.

        Args:
            exc: The network error exception.
            attempt: Current attempt number.

        Returns:
            Tuple of (should_retry, last_error) or raises LLMProviderError.
        """
        if attempt < self.max_retries:
            return True, exc
        raise LLMProviderError(
            code="llm_network_error",
            message="Network error connecting to Claude API.",
            status_code=502,
            provider=self.provider_name,
        ) from exc

    def _handle_provider_error(
        self,
        exc: Exception,
        attempt: int,
    ) -> tuple[bool, Exception | None]:
        """Handle provider errors.

        Args:
            exc: The provider error exception.
            attempt: Current attempt number (unused).

        Raises:
            LLMProviderError: Re-raises the original error.
        """
        raise exc

    def _handle_retry_exhausted(
        self,
        last_error: Exception | None,
    ) -> LLMInterventionDraft:
        """Handle the case when all retries are exhausted.

        Args:
            last_error: The last error that occurred.

        Raises:
            LLMProviderError: Always raises when retries are exhausted.
        """
        if last_error:
            raise LLMProviderError(
                code="llm_api_error",
                message=f"Claude request failed after {self.max_retries} retries",
                status_code=502,
                provider=self.provider_name,
            ) from last_error

        raise LLMProviderError(
            code="llm_api_error",
            message="Unexpected error in Claude provider",
            status_code=502,
            provider=self.provider_name,
        )

    def get_supported_models(self) -> list[str]:
        """Get list of supported Claude models.

        Returns:
            List of model identifiers supported by this provider.
        """
        return [
            self.CLAUDE_35_SONNET,
            self.CLAUDE_35_OPUS,
            self.CLAUDE_35_HAIKU,
            "claude-3-5-sonnet-latest",
            "claude-3-opus-latest",
            "claude-3-5-haiku-latest",
        ]

    def validate_model(self, model: str) -> bool:
        """Validate if a model is supported.

        Args:
            model: Model identifier to validate.

        Returns:
            True if the model is supported, False otherwise.
        """
        supported = self.get_supported_models()
        return model in supported or any(m in model for m in ["claude-3-5", "claude-3-opus"])


# Alias for backward compatibility with existing anthropic_provider imports
ClaudeLLMProvider = ClaudeProvider
