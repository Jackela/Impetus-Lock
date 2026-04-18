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
    JSON,
    TIMESTAMP,
    CheckConstraint,
    ForeignKey,
    Index,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Base class for all ORM models.

    Provides common table configuration and utilities.
    """

    pass


class InterventionActionModel(Base):
    """Intervention action ORM model (maps to 'intervention_actions' table).

    Attributes:
        id: Primary key (UUID).
        task_id: Foreign key to tasks table.
        action_type: "provoke", "delete", or "rewrite".
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

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    task_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    action_type: Mapped[str] = mapped_column(String(10), nullable=False)
    action_id: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    lock_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    anchor: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    mode: Mapped[str] = mapped_column(String(10), nullable=False)
    context: Mapped[str] = mapped_column(Text, nullable=False)
    issued_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )

    # Relationship to parent task
    task: Mapped["TaskModel"] = relationship("TaskModel", back_populates="actions")

    __table_args__ = (
        CheckConstraint(
            "action_type IN ('provoke', 'delete', 'rewrite')", name="actions_type_check"
        ),
        CheckConstraint("mode IN ('muse', 'loki')", name="actions_mode_check"),
        CheckConstraint(
            "("
            "action_type IN ('provoke', 'rewrite') AND content IS NOT NULL AND lock_id IS NOT NULL"
            ") OR (action_type = 'delete' AND content IS NULL AND lock_id IS NULL)",
            name="actions_mutation_payload_check",
        ),
        Index("idx_actions_task_id", "task_id"),
        Index("idx_actions_action_id", "action_id"),
        Index("idx_actions_issued_at", "issued_at"),
        Index("idx_actions_mode", "mode"),
    )


from server.models.task import TaskModel  # noqa: E402
