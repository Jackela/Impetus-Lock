"""add sprint2 task fields

Revision ID: 441c7e275255
Revises: 55b03991a06c
Create Date: 2026-04-16 15:00:00.000000

Constitutional Compliance:
- Article I (Simplicity): Minimal, focused migration
- Article V (Documentation): Complete docstring with purpose

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "441c7e275255"
down_revision: Union[str, None] = "55b03991a06c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add Sprint 2 columns to the tasks table."""
    op.add_column(
        "tasks",
        sa.Column("title", sa.String(), nullable=True, server_default=sa.text("''")),
    )
    op.add_column(
        "tasks",
        sa.Column("category", sa.String(), nullable=True, server_default="WRITING"),
    )
    op.add_column(
        "tasks",
        sa.Column("priority", sa.String(), nullable=True, server_default="MEDIUM"),
    )
    op.add_column(
        "tasks",
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "tasks",
        sa.Column("word_count", sa.Integer(), nullable=True, server_default="0"),
    )


def downgrade() -> None:
    """Drop Sprint 2 columns from the tasks table."""
    op.drop_column("tasks", "word_count")
    op.drop_column("tasks", "due_date")
    op.drop_column("tasks", "priority")
    op.drop_column("tasks", "category")
    op.drop_column("tasks", "title")
