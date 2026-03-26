"""Shared JSON-prompted LLM provider helpers."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Literal, Protocol

from pydantic import BaseModel

from server.domain.llm_provider import LLMProvider
from server.domain.models.anchor import AnchorPos, AnchorRange
from server.domain.models.intervention import InterventionResponse
from server.infrastructure.llm.prompts.loki_prompt import get_loki_prompts
from server.infrastructure.llm.prompts.muse_prompt import get_muse_prompts

if TYPE_CHECKING:
    from collections.abc import Callable


class LLMInterventionDraft(BaseModel):
    """Minimal schema returned directly by the LLM before backend post-processing."""

    action: Literal["provoke", "delete", "rewrite"]
    content: str | None = None


@dataclass
class TokenUsage:
    """Track token usage for a single request."""

    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = field(init=False)

    def __post_init__(self) -> None:
        """Calculate total tokens after initialization."""
        self.total_tokens = self.input_tokens + self.output_tokens


class BasePromptLLMProvider(LLMProvider, ABC):
    """Base class implementing shared intervention -> response plumbing."""

    provider_name: str = "generic"

    def __init__(self, *, model: str, temperature: float = 0.9) -> None:
        self.model = model
        self.temperature = temperature

    def generate_intervention(
        self,
        context: str,
        mode: Literal["muse", "loki"],
        doc_version: int | None = None,
        selection_from: int | None = None,
        selection_to: int | None = None,
    ) -> InterventionResponse:
        if not context:
            raise ValueError("Context cannot be empty")
        if mode not in {"muse", "loki"}:
            raise ValueError(f"Invalid mode: {mode}")

        if mode == "muse":
            system_prompt, user_message = get_muse_prompts(context)
        else:
            system_prompt, user_message = get_loki_prompts(context)

        draft = self._complete(system_prompt, user_message)

        cursor_pos = selection_to or selection_from or 0
        cursor_pos = max(0, cursor_pos)

        if draft.action == "provoke":
            anchor: AnchorPos | AnchorRange = AnchorPos(from_=cursor_pos)
        else:
            # Ensure to > 0 for AnchorRange validation
            to_pos = max(1, cursor_pos)
            from_pos = max(0, to_pos - 120)
            anchor = AnchorRange(from_=from_pos, to=to_pos)

        lock_id = None
        content = draft.content

        if draft.action in {"provoke", "rewrite"}:
            if not content:
                raise ValueError("LLM returned mutate action without content")
            lock_id = f"lock_{uuid.uuid4()}"

        return InterventionResponse(
            action=draft.action,
            content=content if draft.action in {"provoke", "rewrite"} else None,
            lock_id=lock_id,
            anchor=anchor,
            action_id=f"act_{uuid.uuid4()}",
            source=mode,
        )

    @abstractmethod
    def _complete(self, system_prompt: str, user_message: str) -> LLMInterventionDraft:
        """Subclasses call their provider SDK and return a validated draft."""


class LLMErrorHandlerMixin:
    """Mixin providing standardized error handling for LLM providers.

    This mixin standardizes exception handling across different LLM providers,
    mapping provider-specific exceptions to standardized LLMProviderError.
    """

    def handle_llm_error(
        self,
        exc: Exception,
        provider_name: str,
        retryable_exceptions: tuple[type[Exception], ...] | None = None,
        max_retries: int = 0,
        current_attempt: int = 0,
    ) -> tuple[bool, Exception | None]:
        """Handle LLM API errors and determine if retry is appropriate.

        Args:
            exc: The exception that occurred.
            provider_name: Name of the LLM provider.
            retryable_exceptions: Tuple of exception types that should trigger retry.
            max_retries: Maximum number of retry attempts allowed.
            current_attempt: Current attempt number (0-indexed).

        Returns:
            Tuple of (should_retry, error_to_store).

        Raises:
            LLMProviderError: If error should not be retried or retries exhausted.
        """
        from server.domain.errors import LLMProviderError

        retryable = retryable_exceptions or (OSError, ConnectionError)

        # Check if this is a retryable error and we haven't exhausted retries
        if isinstance(exc, retryable) and current_attempt < max_retries:
            return True, exc

        # Map common error patterns
        error_code = "llm_api_error"
        status_code = 502
        message = f"Request failed: {exc.__class__.__name__}"

        # Check for rate limiting
        if any(keyword in str(exc).lower() for keyword in ["rate limit", "quota", "429"]):
            error_code = "quota_exceeded"
            status_code = 402
            message = f"{provider_name} quota exceeded. Provide another key or try later."

        # Check for authentication errors
        elif any(keyword in str(exc).lower() for keyword in ["auth", "api key", "401"]):
            error_code = "invalid_api_key"
            status_code = 401
            message = f"{provider_name} API key rejected."

        # Check for network errors
        elif isinstance(exc, (OSError, ConnectionError)):
            error_code = "llm_network_error"
            message = f"Network error connecting to {provider_name} API."

        raise LLMProviderError(
            code=error_code,
            message=message,
            status_code=status_code,
            provider=provider_name,
        ) from exc


class RetryMixin:
    """Mixin providing retry logic for LLM operations.

    Implements exponential backoff and retry for transient failures.
    """

    DEFAULT_MAX_RETRIES: int = 3
    DEFAULT_BACKOFF_FACTOR: float = 1.0

    def execute_with_retry(
        self,
        operation: Callable[[], T],
        should_retry: Callable[[Exception], bool] | None = None,
        max_retries: int | None = None,
        backoff_factor: float | None = None,
    ) -> T:
        """Execute an operation with retry logic.

        Args:
            operation: The operation to execute.
            should_retry: Function to determine if an exception should trigger retry.
            max_retries: Maximum number of retry attempts.
            backoff_factor: Exponential backoff multiplier.

        Returns:
            Result of the operation.

        Raises:
            Exception: The last exception if all retries are exhausted.
        """
        import time

        max_retries = max_retries if max_retries is not None else self.DEFAULT_MAX_RETRIES
        backoff_factor = (
            backoff_factor if backoff_factor is not None else self.DEFAULT_BACKOFF_FACTOR
        )

        if should_retry is None:
            should_retry = lambda e: isinstance(e, (OSError, ConnectionError))

        last_error: Exception | None = None

        for attempt in range(max_retries + 1):
            try:
                return operation()
            except Exception as exc:
                last_error = exc

                if attempt < max_retries and should_retry(exc):
                    sleep_time = backoff_factor * (2**attempt)
                    time.sleep(sleep_time)
                    continue

                raise

        # This should never be reached, but just in case
        if last_error:
            raise last_error
        raise RuntimeError("Unexpected error in retry logic")


# Type variable for generic return type
from typing import TypeVar

T = TypeVar("T")
