"""User ORM model for authentication.

@module models.user
"""

from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import TIMESTAMP, Index, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from server.infrastructure.persistence.models import Base


class User(Base):
    """User ORM model (maps to 'users' table).

    Attributes:
        id: Primary key (UUID).
        email: User's email address (unique, indexed).
        password_hash: Bcrypt hashed password.
        created_at: Creation timestamp (UTC).
        updated_at: Last update timestamp (UTC).
    """

    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid4, server_default=func.gen_random_uuid()
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=func.current_timestamp(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=func.current_timestamp(),
        onupdate=lambda: datetime.now(UTC),
    )

    __table_args__ = (
        Index("idx_users_email", "email"),
        Index("idx_users_created_at", "created_at"),
    )

    def __repr__(self) -> str:
        """Return string representation of User."""
        return f"<User(id={self.id}, email={self.email})>"
