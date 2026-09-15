"""CSRF token generation and validation."""

import os
import secrets

from itsdangerous import URLSafeTimedSerializer


class CSRFProtection:
    """Generate and validate signed, time-limited CSRF tokens.

    Tokens carry a random payload signed with the SECRET_KEY, so any
    instance constructed with the same SECRET_KEY can both issue tokens
    and verify their integrity and age.
    """

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
        """Return a signed URL-safe CSRF token.

        The token wraps a fresh random payload in a timed signature, so it
        roundtrips through validate_token on any instance sharing the
        SECRET_KEY.

        Returns:
            A signed, URL-safe CSRF token string.
        """
        return str(self._serializer.dumps(secrets.token_urlsafe(32)))

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
