"""Add user table and task-user association.

Revision ID: 20260409174552
Revises: c39f598d1361
Create Date: 2026-04-09 17:45:52.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260409174552"
down_revision: Union[str, None] = "c39f598d1361"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create users table and add user_id to tasks."""
    # Create users table
    op.create_table(
        "users",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )

    # Create indexes
    op.create_index("idx_users_email", "users", ["email"], unique=False)
    op.create_index("idx_users_created_at", "users", ["created_at"], unique=False)

    # Add user_id to tasks table
    op.add_column(
        "tasks",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=True,  # Allow null for migration - will be required later
        ),
    )

    # Create index on tasks.user_id
    op.create_index("idx_tasks_user_id", "tasks", ["user_id"], unique=False)


def downgrade() -> None:
    """Drop users table and user_id from tasks."""
    # Drop index on tasks
    op.drop_index("idx_tasks_user_id", table_name="tasks")

    # Drop user_id column from tasks
    op.drop_column("tasks", "user_id")

    # Drop indexes on users
    op.drop_index("idx_users_created_at", table_name="users")
    op.drop_index("idx_users_email", table_name="users")

    # Drop users table
    op.drop_table("users")
