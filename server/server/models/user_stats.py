"""UserStats ORM model for writing analytics.

@module models.user_stats
"""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from server.infrastructure.persistence.models import Base


class UserStats(Base):
    """UserStats ORM model (maps to 'user_stats' table).

    Attributes:
        id: Primary key (UUID).
        user_id: Foreign key to users table (unique).
        total_tasks: Total number of tasks created.
        total_muse_interventions: Count of Muse interventions received.
        total_loki_interventions: Count of Loki interventions received.
        total_locks_created: Count of locks created.
        writing_minutes: Estimated writing time in minutes.
        last_activity_at: Last writing activity timestamp.
    """

    __tablename__ = "user_stats"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    total_tasks: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    total_muse_interventions: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    total_loki_interventions: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    total_locks_created: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    writing_minutes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    last_activity_at: Mapped[datetime | None] = mapped_column(
        nullable=True,
        default=None,
    )

    __table_args__ = (Index("idx_user_stats_user_id", "user_id"),)

    def __repr__(self) -> str:
        """Return string representation of UserStats."""
        return f"<UserStats(user_id={self.user_id}, tasks={self.total_tasks})>"
