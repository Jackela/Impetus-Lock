"""Domain-level error helpers for LLM provider resolution."""

from __future__ import annotations


class LLMProviderError(RuntimeError):
    """Represents an expected provider/configuration failure.

    Attributes:
        code: Stable machine-readable error code.
        message: Human-facing message (safe to surface to clients).
        status_code: HTTP status that best matches the failure.
        provider: Optional provider identifier (e.g., "openai").
    """

    def __init__(
        self,
        *,
        code: str,
        message: str,
        status_code: int,
        provider: str | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.provider = provider

    def to_dict(self) -> dict[str, str | None]:
        """Serialize error payload for API responses."""

        payload: dict[str, str | None] = {
            "code": self.code,
            "message": self.message,
        }
        if self.provider:
            payload["provider"] = self.provider
        return payload
