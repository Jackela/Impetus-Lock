"""Style History ORM model for storing style analysis history.

Maps domain style history entities to database tables using SQLAlchemy 2.0.
"""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import TIMESTAMP, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from server.infrastructure.persistence.models import Base


class StyleHistoryModel(Base):
    """Style analysis history ORM model (maps to 'style_history' table).

    Stores historical style analysis results for users, enabling:
    - Tracking writing style evolution over time
    - Comparing past analyses
    - Reviewing style learning progress

    Attributes:
        id: Primary key (UUID).
        user_id: External user identifier (string for flexibility).
        text: Original text that was analyzed.
        style_vector: JSONB containing style features and confidence scores.
        created_at: Analysis timestamp (UTC).
    """

    __tablename__ = "style_history"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    style_vector: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        index=True,
    )

    __table_args__ = (
        Index("ix_style_history_user_created", "user_id", "created_at"),
    )

    def __repr__(self) -> str:
        """String representation for debugging."""
        return f"<StyleHistoryModel(id={self.id}, user_id={self.user_id}, created_at={self.created_at})>"
