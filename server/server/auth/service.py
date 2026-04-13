"""Authentication service layer.

Handles business logic for user registration, login, and authentication.
Uses repository pattern for database operations.

@module auth.service
"""

from dataclasses import dataclass
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.auth.utils import create_access_token, hash_password, verify_password
from server.models.user import User


class UserRepositoryProtocol(Protocol):
    """Protocol for user repository operations."""

    async def get_by_email(self, email: str) -> User | None:
        """Get user by email."""
        ...

    async def create(self, email: str, password_hash: str) -> User:
        """Create a new user."""
        ...

    async def exists(self, email: str) -> bool:
        """Check if user with email exists."""
        ...


@dataclass
class UserRepository:
    """Concrete implementation of user repository."""

    session: AsyncSession

    async def get_by_email(self, email: str) -> User | None:
        """Get user by email address.

        Args:
            email: Email address to look up.

        Returns:
            User if found, None otherwise.
        """
        result = await self.session.execute(select(User).where(User.email == email))
        user: User | None = result.scalar_one_or_none()
        return user

    async def create(self, email: str, password_hash: str) -> User:
        """Create a new user.

        Args:
            email: User's email address.
            password_hash: Bcrypt hashed password.

        Returns:
            Created User instance.
        """
        user = User(email=email, password_hash=password_hash)
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def exists(self, email: str) -> bool:
        """Check if user with email exists.

        Args:
            email: Email address to check.

        Returns:
            True if user exists, False otherwise.
        """
        result = await self.session.execute(select(User.id).where(User.email == email))
        return result.scalar_one_or_none() is not None


@dataclass
class AuthResult:
    """Result of authentication operation."""

    success: bool
    user: User | None = None
    token: str | None = None
    error_message: str | None = None


class AuthService:
    """Authentication service handling registration and login."""

    def __init__(self, user_repo: UserRepositoryProtocol):
        """Initialize with user repository.

        Args:
            user_repo: Repository for user data access.
        """
        self._user_repo = user_repo

    async def register(self, email: str, password: str) -> AuthResult:
        """Register a new user.

        Args:
            email: User's email address.
            password: Plain text password.

        Returns:
            AuthResult with success status, user, and token if successful.
        """
        # Check if user already exists
        if await self._user_repo.exists(email):
            return AuthResult(success=False, error_message="Email already registered")

        # Hash password
        password_hash = hash_password(password)

        # Create user
        user = await self._user_repo.create(email, password_hash)

        # Create access token
        token = create_access_token(str(user.id))

        return AuthResult(success=True, user=user, token=token)

    async def login(self, email: str, password: str) -> AuthResult:
        """Authenticate a user.

        Args:
            email: User's email address.
            password: Plain text password.

        Returns:
            AuthResult with success status, user, and token if successful.
        """
        # Get user by email
        user = await self._user_repo.get_by_email(email)

        # Generic error message for security (don't reveal if email exists)
        auth_error = AuthResult(success=False, error_message="Invalid credentials")

        if user is None:
            return auth_error

        # Verify password
        if not verify_password(password, user.password_hash):
            return auth_error

        # Create access token
        token = create_access_token(str(user.id))

        return AuthResult(success=True, user=user, token=token)


def get_auth_service(session: AsyncSession) -> AuthService:
    """Factory function to create AuthService with default repository.

    Args:
        session: Database session.

    Returns:
        Configured AuthService instance.
    """
    repo = UserRepository(session)
    return AuthService(repo)
