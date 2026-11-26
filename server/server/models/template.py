"""Template ORM model for task templates.

@module models.template
"""

from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import TIMESTAMP, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from server.infrastructure.persistence.models import Base


class Template(Base):
    """Template ORM model (maps to 'templates' table).

    Attributes:
        id: Primary key (UUID).
        name: Template name (max 100 chars).
        content: Initial task content (text).
        user_id: Foreign key to users table.
        created_at: Creation timestamp (UTC).
        updated_at: Last update timestamp (UTC).
    """

    __tablename__ = "templates"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        server_default=func.gen_random_uuid(),
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
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
        Index("idx_templates_user_id", "user_id"),
        Index("idx_templates_user_name", "user_id", "name"),
    )

    def __repr__(self) -> str:
        """Return string representation of Template."""
        return f"<Template(id={self.id}, name={self.name}, user_id={self.user_id})>"
