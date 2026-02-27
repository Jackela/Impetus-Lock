"""add_style_history_table

Revision ID: c39f598d1361
Revises: c4a5e8d9f2b1
Create Date: 2026-02-27 03:42:00.000000+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c39f598d1361"
down_revision: Union[str, None] = "c4a5e8d9f2b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create style_history table for storing style analysis history."""
    op.create_table(
        "style_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.String(length=255), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column(
            "style_vector",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes for efficient querying
    op.create_index(op.f("ix_style_history_user_id"), "style_history", ["user_id"], unique=False)
    op.create_index(op.f("ix_style_history_created_at"), "style_history", ["created_at"], unique=False)
    op.create_index("ix_style_history_user_created", "style_history", ["user_id", "created_at"], unique=False)


def downgrade() -> None:
    """Drop style_history table."""
    op.drop_index("ix_style_history_user_created", table_name="style_history")
    op.drop_index(op.f("ix_style_history_created_at"), table_name="style_history")
    op.drop_index(op.f("ix_style_history_user_id"), table_name="style_history")
    op.drop_table("style_history")
