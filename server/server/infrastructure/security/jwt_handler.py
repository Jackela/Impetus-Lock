"""JWT token generation and validation."""

import os
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt


class JWTHandler:
    """Create and verify HS256-signed access tokens for authentication.

    Attributes:
        ALGORITHM: Signing algorithm used for all tokens.
        ACCESS_TOKEN_EXPIRE: Lifetime applied to issued tokens.
    """

    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE = timedelta(hours=24)

    @classmethod
    def create_token(cls, user_id: str, **claims: Any) -> str:
        """Encode a signed access token for the given user.

        Args:
            user_id: Subject identifier stored in the "sub" claim.
            **claims: Extra claims merged into the token payload.

        Returns:
            The encoded JWT string.

        Raises:
            ValueError: If JWT_SECRET is not set.
        """
        now = datetime.now(UTC)
        payload = {
            "sub": user_id,
            "exp": now + cls.ACCESS_TOKEN_EXPIRE,
            "iat": now,
            **claims,
        }
        secret = os.getenv("JWT_SECRET")
        if not secret:
            raise ValueError("JWT_SECRET not set")
        return str(jwt.encode(payload, secret, algorithm=cls.ALGORITHM))

    @classmethod
    def verify_token(cls, token: str) -> dict[str, Any]:
        """Decode and verify a signed JWT.

        Args:
            token: The encoded JWT string.

        Returns:
            The verified token payload.

        Raises:
            ValueError: If JWT_SECRET is not set.
            jwt.InvalidTokenError: If the token is invalid or expired.
        """
        secret = os.getenv("JWT_SECRET")
        if not secret:
            raise ValueError("JWT_SECRET not set")
        return dict(jwt.decode(token, secret, algorithms=[cls.ALGORITHM]))
