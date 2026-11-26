"""Short-lived replay metadata for one task-associated intervention."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, Index, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from server.infrastructure.persistence.models import Base


class InterventionReceipt(Base):
    """Reference the committed action without duplicating its response or request body."""

    __tablename__ = "intervention_receipts"
    __table_args__ = (
        Index("ix_intervention_receipts_expires_at", "expires_at"),
        Index("ix_intervention_receipts_task_id", "task_id"),
        Index("ix_intervention_receipts_action_id", "action_id"),
    )

    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    task_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True
    )
    key_digest: Mapped[str] = mapped_column(String(64), primary_key=True)
    action_id: Mapped[str] = mapped_column(
        String(100),
        ForeignKey("intervention_actions.action_id", ondelete="CASCADE"),
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
