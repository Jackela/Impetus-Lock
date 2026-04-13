"""Unit tests for JWT token utilities.

@module tests/test_jwt
"""

from datetime import UTC, datetime, timedelta

from server.auth.utils import (
    BCRYPT_ROUNDS,
    JWT_EXPIRATION_HOURS,
    create_access_token,
    decode_access_token,
    get_token_expiry,
    hash_password,
    verify_password,
)


class TestPasswordHashing:
    """Test suite for password hashing functions."""

    def test_hash_password_returns_string(self) -> None:
        """Test that hash_password returns a string."""
        password = "securePassword123"
        hashed = hash_password(password)

        assert isinstance(hashed, str)
        assert len(hashed) > 0

    def test_hash_password_not_equal_to_plain(self) -> None:
        """Test that hashed password is different from plain password."""
        password = "securePassword123"
        hashed = hash_password(password)

        assert hashed != password

    def test_verify_password_correct(self) -> None:
        """Test verifying correct password."""
        password = "securePassword123"
        hashed = hash_password(password)

        assert verify_password(password, hashed) is True

    def test_verify_password_incorrect(self) -> None:
        """Test verifying incorrect password."""
        password = "securePassword123"
        hashed = hash_password(password)

        assert verify_password("wrongPassword", hashed) is False

    def test_verify_password_empty(self) -> None:
        """Test verifying empty password."""
        password = "securePassword123"
        hashed = hash_password(password)

        assert verify_password("", hashed) is False

    def test_bcrypt_work_factor(self) -> None:
        """Test that bcrypt uses expected work factor."""
        assert BCRYPT_ROUNDS >= 12


class TestJWTToken:
    """Test suite for JWT token functions."""

    def test_create_access_token_returns_string(self) -> None:
        """Test that create_access_token returns a string."""
        user_id = "test-user-id"
        token = create_access_token(user_id)

        assert isinstance(token, str)
        assert len(token) > 0

    def test_decode_valid_token(self) -> None:
        """Test decoding a valid token."""
        user_id = "test-user-id"
        token = create_access_token(user_id)

        payload = decode_access_token(token)

        assert payload is not None
        assert payload["sub"] == user_id
        assert payload["type"] == "access"
        assert "exp" in payload
        assert "iat" in payload

    def test_decode_invalid_token(self) -> None:
        """Test decoding an invalid token."""
        payload = decode_access_token("invalid.token.here")

        assert payload is None

    def test_decode_expired_token(self) -> None:
        """Test decoding an expired token."""
        user_id = "test-user-id"
        # Create token that expired 1 hour ago
        expired_token = create_access_token(user_id, expires_delta=timedelta(hours=-1))

        payload = decode_access_token(expired_token)

        assert payload is None

    def test_token_expiration_time(self) -> None:
        """Test that token has correct expiration time."""
        user_id = "test-user-id"
        token = create_access_token(user_id)

        expiry = get_token_expiry(token)

        assert expiry is not None
        # Token should expire in approximately 24 hours
        now = datetime.now(UTC)
        expected_expiry = now + timedelta(hours=JWT_EXPIRATION_HOURS)
        time_diff = abs((expiry - expected_expiry).total_seconds())
        assert time_diff < 60  # Within 1 minute

    def test_get_token_expiry_invalid_token(self) -> None:
        """Test getting expiry from invalid token."""
        expiry = get_token_expiry("invalid.token")

        assert expiry is None

    def test_token_type_verification(self) -> None:
        """Test that token type is verified during decode."""
        import jwt as pyjwt

        from server.auth.utils import JWT_ALGORITHM, JWT_SECRET

        # Create token with wrong type
        payload = {
            "sub": "test-user-id",
            "exp": datetime.now(UTC) + timedelta(hours=24),
            "iat": datetime.now(UTC),
            "type": "refresh",  # Wrong type
        }
        token = pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

        decoded = decode_access_token(token)

        assert decoded is None  # Should reject non-access tokens
