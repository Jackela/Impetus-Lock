"""Domain-level error helpers for structured error responses."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


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


@dataclass
class AppError(Exception):
    """Base application error with structured response."""

    code: str
    message: str
    status_code: int
    details: Optional[dict] = field(default=None)

    def to_dict(self) -> dict:
        """Serialize error to dictionary for API responses."""
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "details": self.details,
            }
        }


class AuthenticationError(AppError):
    """Authentication failed error."""

    def __init__(self, message: str = "Authentication failed"):
        super().__init__("AUTHENTICATION_ERROR", message, 401)


class AuthorizationError(AppError):
    """Authorization failed error (not authorized)."""

    def __init__(self, message: str = "Not authorized"):
        super().__init__("AUTHORIZATION_ERROR", message, 403)


class RateLimitError(AppError):
    """Rate limit exceeded error."""

    def __init__(self, retry_after: int = 60):
        super().__init__(
            "RATE_LIMIT_EXCEEDED",
            "Rate limit exceeded. Please try again later.",
            429,
            {"retry_after": retry_after},
        )


class ValidationError(AppError):
    """Validation error with field details."""

    def __init__(self, message: str, details: dict | None = None):
        super().__init__("VALIDATION_ERROR", message, 422, details)


class ServiceUnavailableError(AppError):
    """Service temporarily unavailable error."""

    def __init__(self, message: str = "Service temporarily unavailable"):
        super().__init__("SERVICE_UNAVAILABLE", message, 503)


class DatabaseError(AppError):
    """Database operation error."""

    def __init__(self, message: str = "Database operation failed", details: dict | None = None):
        super().__init__("DATABASE_ERROR", message, 500, details)


class ConflictError(AppError):
    """Resource conflict error (e.g., duplicate entry)."""

    def __init__(self, message: str = "Resource conflict"):
        super().__init__("CONFLICT_ERROR", message, 409)


class NotFoundError(AppError):
    """Resource not found error."""

    def __init__(self, message: str = "Resource not found"):
        super().__init__("NOT_FOUND", message, 404)
