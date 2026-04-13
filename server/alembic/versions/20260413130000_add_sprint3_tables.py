"""Add Sprint 3 tables: achievements, streaks, templates, user_stats.

Revision ID: 20260413130000
Revises: 20260409174552
Create Date: 2026-04-13 13:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260413130000"
down_revision: Union[str, None] = "20260409174552"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create achievements, streaks, templates, user_stats tables."""
    # Achievements table
    op.create_table(
        "achievements",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("achievement_type", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.Column(
            "earned_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column("metadata_json", sa.String(length=1000), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_achievements_user_id", "achievements", ["user_id"], unique=False)
    op.create_index(
        "idx_achievements_user_type", "achievements", ["user_id", "achievement_type"], unique=False
    )

    # Streaks table
    op.create_table(
        "streaks",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("current_streak_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("longest_streak_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("streak_start_date", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("last_activity_date", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("grace_used", sa.Boolean(), nullable=False, server_default="false"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("idx_streaks_user_id", "streaks", ["user_id"], unique=False)

    # Templates table
    op.create_table(
        "templates",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
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
    )
    op.create_index("idx_templates_user_id", "templates", ["user_id"], unique=False)
    op.create_index("idx_templates_user_name", "templates", ["user_id", "name"], unique=False)

    # UserStats table
    op.create_table(
        "user_stats",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("total_tasks", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("total_muse_interventions", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("total_loki_interventions", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("total_locks_created", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("writing_minutes", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("last_activity_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("idx_user_stats_user_id", "user_stats", ["user_id"], unique=False)


def downgrade() -> None:
    """Drop Sprint 3 tables."""
    op.drop_index("idx_user_stats_user_id", table_name="user_stats")
    op.drop_table("user_stats")
    op.drop_index("idx_templates_user_name", table_name="templates")
    op.drop_index("idx_templates_user_id", table_name="templates")
    op.drop_table("templates")
    op.drop_index("idx_streaks_user_id", table_name="streaks")
    op.drop_table("streaks")
    op.drop_index("idx_achievements_user_type", table_name="achievements")
    op.drop_index("idx_achievements_user_id", table_name="achievements")
    op.drop_table("achievements")
