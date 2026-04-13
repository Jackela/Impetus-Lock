"""Template ORM model for task templates.

@module models.template
"""

from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

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

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    __table_args__ = (
        Index("idx_templates_user_id", "user_id"),
        Index("idx_templates_user_name", "user_id", "name"),
    )

    def __repr__(self) -> str:
        """Return string representation of Template."""
        return f"<Template(id={self.id}, name={self.name}, user_id={self.user_id})>"
