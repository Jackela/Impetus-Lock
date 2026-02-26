"""Style ORM model for user writing style storage.

Maps domain style entities to database tables using SQLAlchemy 2.0 declarative mapping.
"""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import TIMESTAMP, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from server.infrastructure.persistence.models import Base


class StyleModel(Base):
    """User writing style ORM model (maps to 'styles' table).

    Stores learned style profiles from user writing samples.
    Style vectors include features like sentence length, vocabulary richness,
    tone markers, punctuation patterns, etc.

    Attributes:
        id: Primary key (UUID).
        user_id: External user identifier (string for flexibility).
        style_vector: JSONB containing style features and confidence scores.
        samples_count: Number of writing samples used to build this profile.
        version: Profile version number for optimistic locking.
        created_at: Creation timestamp (UTC).
        updated_at: Last update timestamp (UTC).
    """

    __tablename__ = "styles"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    user_id: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True
    )
    style_vector: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )
    samples_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
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
        Index("idx_styles_user_id", "user_id"),
        Index("idx_styles_created_at", "created_at"),
        Index("idx_styles_updated_at", "updated_at"),
    )
