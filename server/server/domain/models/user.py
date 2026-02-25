"""
User authentication domain models.

Simple username/password auth with JWT tokens.
"""

from datetime import datetime
from uuid import UUID, uuid4

from pydantic import BaseModel, EmailStr, Field, ConfigDict
from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from server.infrastructure.persistence.database import Base


class User(Base):
    """User database model.

    Simple auth: username + email + password hash.
    """

    __tablename__ = "users"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    subscription_tier = Column(String(20), default="free", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserCreate(BaseModel):
    """User registration request."""

    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)


class UserLogin(BaseModel):
    """User login request."""

    username: str
    password: str


class Token(BaseModel):
    """JWT token response."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class UserResponse(BaseModel):
    """User profile response."""

    id: UUID
    username: str
    email: str
    subscription_tier: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
