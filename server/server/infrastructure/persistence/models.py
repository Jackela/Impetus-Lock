"""SQLAlchemy ORM models for PostgreSQL persistence.

Maps domain entities to database tables using SQLAlchemy 2.0 declarative mapping.

Constitutional Compliance:
- Article I (Simplicity): Uses SQLAlchemy declarative_base (framework-native)
- Article IV (SOLID - SRP): Models are pure data structures (no business logic)
- Article V (Documentation): Complete Google-style docstrings
"""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    TIMESTAMP,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Base class for all ORM models.

    Provides common table configuration and utilities.
    """

    pass


class TaskModel(Base):
    """Task ORM model (maps to 'tasks' table).

    Attributes:
        id: Primary key (UUID).
        content: Task content (Markdown text).
        lock_ids: Array of lock IDs for un-deletable blocks.
        created_at: Creation timestamp (UTC).
        updated_at: Last update timestamp (UTC).
        version: Optimistic locking version number.
        actions: Relationship to intervention actions (cascade delete).
    """

    __tablename__ = "tasks"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    lock_ids: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Relationship to intervention actions (cascade delete)
    actions: Mapped[list["InterventionActionModel"]] = relationship(
        "InterventionActionModel", back_populates="task", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint("length(content) > 0", name="tasks_content_not_empty"),
        Index("idx_tasks_created_at", "created_at"),
        Index("idx_tasks_updated_at", "updated_at"),
    )


class InterventionActionModel(Base):
    """Intervention action ORM model (maps to 'intervention_actions' table).

    Attributes:
        id: Primary key (UUID).
        task_id: Foreign key to tasks table.
        action_type: "provoke" or "delete".
        action_id: Client-facing action identifier (e.g., "act_xxxxx").
        lock_id: Lock identifier for provoke actions (NULL for delete).
        content: Intervention content for provoke actions (NULL for delete).
        anchor: Position information (JSONB: {type, from, to, lock_id}).
        mode: Agent mode ("muse" or "loki").
        context: User context at intervention time.
        issued_at: Server timestamp when action was generated (UTC).
        created_at: Database insertion timestamp (UTC).
        task: Relationship to parent task.
    """

    __tablename__ = "intervention_actions"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    task_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    action_type: Mapped[str] = mapped_column(String(10), nullable=False)
    action_id: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    lock_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    anchor: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    mode: Mapped[str] = mapped_column(String(10), nullable=False)
    context: Mapped[str] = mapped_column(Text, nullable=False)
    issued_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )

    # Relationship to parent task
    task: Mapped["TaskModel"] = relationship("TaskModel", back_populates="actions")

    __table_args__ = (
        CheckConstraint("action_type IN ('provoke', 'delete')", name="actions_type_check"),
        CheckConstraint("mode IN ('muse', 'loki')", name="actions_mode_check"),
        CheckConstraint(
            "(action_type = 'provoke' AND content IS NOT NULL AND lock_id IS NOT NULL) OR "
            "(action_type = 'delete')",
            name="actions_provoke_has_content",
        ),
        Index("idx_actions_task_id", "task_id"),
        Index("idx_actions_action_id", "action_id"),
        Index("idx_actions_issued_at", "issued_at"),
        Index("idx_actions_mode", "mode"),
    )
