"""Streak ORM model for tracking consecutive writing days.

@module models.streak
"""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from server.infrastructure.persistence.models import Base


class Streak(Base):
    """Streak ORM model (maps to 'streaks' table).

    Attributes:
        id: Primary key (UUID).
        user_id: Foreign key to users table (unique).
        current_streak_days: Current consecutive days streak.
        longest_streak_days: Longest streak ever achieved.
        streak_start_date: Start date of current streak.
        last_activity_date: Last activity date.
        grace_used: Whether grace period was used this streak.
    """

    __tablename__ = "streaks"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    current_streak_days: Mapped[int] = mapped_column(nullable=False, default=0)
    longest_streak_days: Mapped[int] = mapped_column(nullable=False, default=0)
    streak_start_date: Mapped[datetime | None] = mapped_column(nullable=True)
    last_activity_date: Mapped[datetime | None] = mapped_column(nullable=True)
    grace_used: Mapped[bool] = mapped_column(nullable=False, default=False)

    __table_args__ = (Index("idx_streaks_user_id", "user_id"),)

    def __repr__(self) -> str:
        """Return string representation of Streak."""
        return f"<Streak(user_id={self.user_id}, current={self.current_streak_days})>"
