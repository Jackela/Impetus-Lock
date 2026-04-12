"""Unit tests for User model.

@module tests/test_user_model
"""

import pytest
from sqlalchemy import select
from server.models.user import User


class TestUserModel:
    """Test suite for User SQLAlchemy model."""

    @pytest.mark.asyncio
    async def test_create_user(self, db_session):
        """Test creating a user with valid data."""
        user = User(
            email="test@example.com",
            password_hash="hashed_password_placeholder"
        )
        db_session.add(user)
        await db_session.commit()

        # Query the user back
        result = await db_session.execute(
            select(User).where(User.email == "test@example.com")
        )
        saved_user = result.scalar_one()

        assert saved_user.id is not None
        assert saved_user.email == "test@example.com"
        assert saved_user.password_hash == "hashed_password_placeholder"
        assert saved_user.created_at is not None
        assert saved_user.updated_at is not None

    @pytest.mark.asyncio
    async def test_email_unique_constraint(self, db_session):
        """Test that email must be unique."""
        user1 = User(email="duplicate@example.com", password_hash="hash1")
        db_session.add(user1)
        await db_session.commit()

        user2 = User(email="duplicate@example.com", password_hash="hash2")
        db_session.add(user2)

        with pytest.raises(Exception):  # IntegrityError
            await db_session.commit()

    @pytest.mark.asyncio
    async def test_email_validation_valid(self, db_session):
        """Test that valid emails are accepted."""
        valid_emails = [
            "user@example.com",
            "user.name@example.co.uk",
            "user+tag@example.org",
            "123@example.com",
        ]

        for email in valid_emails:
            user = User(email=email, password_hash="hash")
            db_session.add(user)
            await db_session.commit()

            # Clean up for next iteration
            await db_session.delete(user)
            await db_session.commit()

    def test_password_hashing(self):
        """Test password hashing with bcrypt."""
        from server.auth.utils import hash_password, verify_password

        password = "securePassword123"
        hashed = hash_password(password)

        # Hash should be bytes or string
        assert isinstance(hashed, (str, bytes))
        # Hash should not be the plain password
        assert hashed != password
        # Hash should be verifiable
        assert verify_password(password, hashed) is True
        # Wrong password should fail
        assert verify_password("wrongPassword", hashed) is False

    def test_bcrypt_work_factor(self):
        """Test that bcrypt uses appropriate work factor."""
        from server.auth.utils import hash_password
        import bcrypt

        password = "test_password"
        hashed = hash_password(password)

        # Extract work factor from hash
        # bcrypt hash format: $2b$10$... where 10 is the work factor
        if isinstance(hashed, bytes):
            hashed_str = hashed.decode('utf-8')
        else:
            hashed_str = hashed

        # Default work factor in bcrypt is usually 12
        # The hash starts with $2b$12$ for work factor 12
        parts = hashed_str.split('$')
        if len(parts) >= 3:
            work_factor = int(parts[2])
            assert work_factor >= 12, f"Work factor {work_factor} is too low"
