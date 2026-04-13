"""Authentication utilities for password hashing and JWT tokens.

@module auth.utils
"""

import os
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt

# JWT configuration
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# bcrypt work factor (log rounds)
BCRYPT_ROUNDS = 12


def hash_password(password: str) -> str:
    """Hash a plain text password using bcrypt.

    Args:
        password: Plain text password to hash.

    Returns:
        Hashed password string.
    """
    # bcrypt requires bytes input
    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hash.

    Args:
        plain_password: Plain text password to verify.
        hashed_password: Hashed password to compare against.

    Returns:
        True if password matches, False otherwise.
    """
    password_bytes = plain_password.encode("utf-8")
    hash_bytes = hashed_password.encode("utf-8")
    return bcrypt.checkpw(password_bytes, hash_bytes)


def create_access_token(user_id: str, expires_delta: timedelta | None = None) -> str:
    """Create a JWT access token for a user.

    Args:
        user_id: User ID to encode in the token.
        expires_delta: Optional custom expiration time. Defaults to 24 hours.

    Returns:
        Encoded JWT token string.
    """
    if expires_delta is None:
        expires_delta = timedelta(hours=JWT_EXPIRATION_HOURS)

    expire = datetime.now(UTC) + expires_delta

    payload: dict[str, Any] = {
        "sub": user_id,  # Subject (user ID)
        "exp": expire,  # Expiration time
        "iat": datetime.now(UTC),  # Issued at
        "type": "access",
    }

    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Decode and validate a JWT access token.

    Args:
        token: JWT token string to decode.

    Returns:
        Decoded token payload if valid, None otherwise.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        # Verify token type
        if payload.get("type") != "access":
            return None
        return payload  # type: ignore[no-any-return]
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_token_expiry(token: str) -> datetime | None:
    """Get the expiration time from a token without full validation.

    Args:
        token: JWT token string.

    Returns:
        Expiration datetime if token is decodable, None otherwise.
    """
    try:
        payload = jwt.decode(
            token, JWT_SECRET, algorithms=[JWT_ALGORITHM], options={"verify_exp": False}
        )
        exp_timestamp = payload.get("exp")
        if exp_timestamp:
            return datetime.fromtimestamp(exp_timestamp, tz=UTC)
        return None
    except jwt.InvalidTokenError:
        return None
