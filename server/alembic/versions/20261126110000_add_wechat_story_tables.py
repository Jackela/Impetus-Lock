"""Add storage for WeChat identity, story challenge runs, and works.

Revision ID: 20261126110000
Revises: 441c7e275255
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261126110000"
down_revision: str = "441c7e275255"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create the WeChat tables alongside the existing Web editor tables."""
    op.create_table(
        "wechat_identities",
        sa.Column("subject", sa.String(length=36), nullable=False),
        sa.Column("app_id", sa.String(length=128), nullable=False),
        sa.Column("open_id", sa.String(length=128), nullable=False),
        sa.PrimaryKeyConstraint("subject"),
        sa.UniqueConstraint("app_id", "open_id", name="uq_wechat_identity"),
    )
    op.create_table(
        "wechat_runs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("start_request_id", sa.String(length=128), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("initial", sa.JSON(), nullable=False),
        sa.Column("state", sa.JSON(), nullable=False),
        sa.Column("work_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("subject", "start_request_id"),
    )
    op.create_index("ix_wechat_runs_subject", "wechat_runs", ["subject"])
    op.create_table(
        "wechat_run_receipts",
        sa.Column("run_id", sa.String(length=36), nullable=False),
        sa.Column("request_id", sa.String(length=128), nullable=False),
        sa.Column("outcome", sa.String(length=12), server_default="committed", nullable=False),
        sa.Column("attempt", sa.String(length=36), nullable=True),
        sa.Column("attempt_version", sa.Integer(), nullable=True),
        sa.Column("expires_at", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["run_id"], ["wechat_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("run_id", "request_id"),
    )
    op.create_table(
        "wechat_progress",
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("completed", sa.Integer(), nullable=False),
        sa.Column("rewrite", sa.Boolean(), nullable=False),
        sa.Column("delete", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("subject"),
    )
    op.create_table(
        "wechat_works",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("run_id", sa.String(length=64), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("ai_generated", sa.Boolean(), nullable=False),
        sa.Column("initial", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("run_id"),
    )
    op.create_index("ix_wechat_works_subject", "wechat_works", ["subject"])
    op.create_table(
        "wechat_cards",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("work_id", sa.String(length=64), nullable=False),
        sa.Column("request_id", sa.String(length=128), nullable=False),
        sa.Column("work_version", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("ai_generated", sa.Boolean(), nullable=False),
        sa.Column("initial", sa.JSON(), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["work_id"], ["wechat_works.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("work_id", "request_id"),
    )
    op.create_table(
        "wechat_modes",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("rules", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_wechat_modes_subject", "wechat_modes", ["subject"])


def downgrade() -> None:
    """Remove only WeChat storage, including any data written to its tables."""
    op.drop_table("wechat_modes")
    op.drop_table("wechat_cards")
    op.drop_table("wechat_works")
    op.drop_table("wechat_progress")
    op.drop_table("wechat_run_receipts")
    op.drop_table("wechat_runs")
    op.drop_table("wechat_identities")
