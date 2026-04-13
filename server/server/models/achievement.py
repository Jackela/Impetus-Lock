"""Achievement ORM model for gamification.

@module models.achievement
"""

from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import TIMESTAMP, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from server.infrastructure.persistence.models import Base


class Achievement(Base):
    """Achievement ORM model (maps to 'achievements' table).

    Attributes:
        id: Primary key (UUID).
        user_id: Foreign key to users table.
        achievement_type: Type identifier (e.g., "first_task", "7_day_streak").
        name: Achievement display name.
        description: Achievement description.
        earned_at: Timestamp when achievement was earned.
        metadata: Optional JSON metadata.
    """

    __tablename__ = "achievements"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    achievement_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    earned_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )
    metadata_json: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    __table_args__ = (
        Index("idx_achievements_user_id", "user_id"),
        Index("idx_achievements_user_type", "user_id", "achievement_type"),
    )

    def __repr__(self) -> str:
        """Return string representation of Achievement."""
        return f"<Achievement(id={self.id}, type={self.achievement_type}, user_id={self.user_id})>"
