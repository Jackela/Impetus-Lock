"""CSRF token generation and validation."""

import os
import secrets

from itsdangerous import URLSafeTimedSerializer


class CSRFProtection:
    """Generate and validate signed, time-limited CSRF tokens."""

    def __init__(self) -> None:
        """Create a serializer from the SECRET_KEY environment variable.

        Raises:
            ValueError: If SECRET_KEY is not set.
        """
        secret = os.getenv("SECRET_KEY")
        if not secret:
            raise ValueError("SECRET_KEY not set")
        self._serializer = URLSafeTimedSerializer(secret)

    def generate_token(self) -> str:
        """Return a fresh random URL-safe CSRF token."""
        return secrets.token_urlsafe(32)

    def validate_token(self, token: str, max_age: int = 3600) -> bool:
        """Check a signed token within the allowed age.

        Args:
            token: The signed token to validate.
            max_age: Maximum token age in seconds.

        Returns:
            True if the token is valid and not expired, False otherwise.
        """
        try:
            self._serializer.loads(token, max_age=max_age)
            return True
        except Exception:
            return False
