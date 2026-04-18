"""Task ORM model for persistence.

@module models.task
"""

from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    TIMESTAMP,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from server.infrastructure.persistence.models import Base

if TYPE_CHECKING:
    from server.infrastructure.persistence.models import InterventionActionModel


class TaskModel(Base):
    """Task ORM model (maps to 'tasks' table).

    Attributes:
        id: Primary key (UUID).
        user_id: Foreign key to users table (task owner).
        title: Task title.
        content: Task content (Markdown text).
        lock_ids: Array of lock IDs for un-deletable blocks.
        category: Task category (e.g., "WRITING").
        priority: Task priority (e.g., "MEDIUM").
        due_date: Optional due date timestamp (UTC).
        word_count: Word count for the task.
        created_at: Creation timestamp (UTC).
        updated_at: Last update timestamp (UTC).
        version: Optimistic locking version number.
        actions: Relationship to intervention actions (cascade delete).
    """

    __tablename__ = "tasks"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    content: Mapped[str] = mapped_column(Text, nullable=False)
    lock_ids: Mapped[list[str]] = mapped_column(JSON, nullable=False, server_default="[]")
    category: Mapped[str] = mapped_column(String(20), nullable=False, default="WRITING")
    priority: Mapped[str] = mapped_column(String(10), nullable=False, default="MEDIUM")
    due_date: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    word_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
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
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    actions: Mapped[list["InterventionActionModel"]] = relationship(
        "InterventionActionModel", back_populates="task", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint("length(content) > 0", name="tasks_content_not_empty"),
        Index("idx_tasks_user_id", "user_id"),
        Index("idx_tasks_created_at", "created_at"),
        Index("idx_tasks_updated_at", "updated_at"),
        Index("idx_tasks_category", "category"),
        Index("idx_tasks_priority", "priority"),
    )

    def __repr__(self) -> str:
        """Return string representation of TaskModel."""
        return f"<TaskModel(id={self.id}, title={self.title}, user_id={self.user_id})>"
