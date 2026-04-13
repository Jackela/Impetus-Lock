"""fix lock_ids column type from array to json

Revision ID: 55b03991a06c
Revises: 20260413130000
Create Date: 2026-04-14 01:36:13.532952

Constitutional Compliance:
- Article I (Simplicity): Minimal, focused migration
- Article V (Documentation): Complete docstring with purpose

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "55b03991a06c"
down_revision: Union[str, None] = "20260413130000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Change lock_ids from PostgreSQL ARRAY to JSON for model compatibility."""
    op.alter_column(
        "tasks",
        "lock_ids",
        existing_type=sa.ARRAY(sa.String()),
        type_=sa.JSON(),
        existing_nullable=False,
        postgresql_using="to_json(lock_ids)",
    )


def downgrade() -> None:
    """Revert lock_ids back to PostgreSQL ARRAY."""
    op.alter_column(
        "tasks",
        "lock_ids",
        existing_type=sa.JSON(),
        type_=sa.ARRAY(sa.String()),
        existing_nullable=False,
        postgresql_using="array(select jsonb_array_elements_text(lock_ids::jsonb))",
    )
