"""
Authentication service with JWT tokens.

Simple username/password authentication.
Uses bcrypt for password hashing and python-jose for JWT.
"""

from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.domain.models.user import User, UserCreate, UserLogin, Token, UserResponse
from server.infrastructure.persistence.database import get_settings

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
settings = get_settings()
JWT_SECRET_KEY = settings.jwt_secret_key
JWT_ALGORITHM = settings.jwt_algorithm
ACCESS_TOKEN_EXPIRE_MINUTES = settings.access_token_expire_minutes
REFRESH_TOKEN_EXPIRE_DAYS = settings.refresh_token_expire_days


class AuthService:
    """Simple JWT authentication service."""

    @staticmethod
    def hash_password(password: str) -> str:
        """Hash password using bcrypt."""
        return pwd_context.hash(password)

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify password against hash."""
        return pwd_context.verify(plain_password, hashed_password)

    @staticmethod
    def create_access_token(user_id: UUID, expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token."""
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

        to_encode = {
            "sub": str(user_id),
            "exp": expire,
            "type": "access"
        }
        return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

    @staticmethod
    def create_refresh_token(user_id: UUID, expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT refresh token."""
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

        to_encode = {
            "sub": str(user_id),
            "exp": expire,
            "type": "refresh"
        }
        return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

    @staticmethod
    def decode_token(token: str) -> Optional[dict]:
        """Decode and validate JWT token."""
        try:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
            return payload
        except JWTError:
            return None

    @staticmethod
    async def create_user(db: AsyncSession, user_create: UserCreate) -> User:
        """Create new user with hashed password."""
        # Check if username exists
        existing = await db.execute(
            select(User).where(User.username == user_create.username)
        )
        if existing.scalar_one_or_none():
            raise ValueError("Username already exists")

        # Check if email exists
        existing = await db.execute(
            select(User).where(User.email == user_create.email)
        )
        if existing.scalar_one_or_none():
            raise ValueError("Email already exists")

        # Create user
        user = User(
            username=user_create.username,
            email=user_create.email,
            password_hash=AuthService.hash_password(user_create.password),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    @staticmethod
    async def authenticate_user(db: AsyncSession, login: UserLogin) -> Optional[User]:
        """Authenticate user by username and password."""
        result = await db.execute(
            select(User).where(User.username == login.username)
        )
        user = result.scalar_one_or_none()

        if not user:
            return None

        if not AuthService.verify_password(login.password, user.password_hash):
            return None

        return user

    @staticmethod
    async def get_user_by_id(db: AsyncSession, user_id: UUID) -> Optional[User]:
        """Get user by ID."""
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()
