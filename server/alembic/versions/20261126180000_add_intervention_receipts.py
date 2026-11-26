"""Add metadata for replaying committed task interventions across API processes.

Revision ID: 20261126180000
Revises: 20261126110000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20261126180000"
down_revision: str = "20261126110000"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create an additive, short-lived receipt table with cascading ownership."""
    op.create_table(
        "intervention_receipts",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("task_id", sa.Uuid(), nullable=False),
        sa.Column("key_digest", sa.String(64), nullable=False),
        sa.Column("action_id", sa.String(100), nullable=False),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("user_id", "task_id", "key_digest"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["action_id"], ["intervention_actions.action_id"], ondelete="CASCADE"
        ),
    )
    for column in ("expires_at", "task_id", "action_id"):
        op.create_index(f"ix_intervention_receipts_{column}", "intervention_receipts", [column])


def downgrade() -> None:
    """Remove temporary receipts while keeping the underlying actions and drafts."""
    op.drop_table("intervention_receipts")
