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
    # Step 1: Drop the existing default (can't cast array default to json)
    op.execute("ALTER TABLE tasks ALTER COLUMN lock_ids DROP DEFAULT")
    # Step 2: Alter the column type
    op.alter_column(
        "tasks",
        "lock_ids",
        existing_type=sa.ARRAY(sa.String()),
        type_=sa.JSON(),
        existing_nullable=False,
        postgresql_using="to_json(lock_ids)",
    )
    # Step 3: Set a new JSON default
    op.execute("ALTER TABLE tasks ALTER COLUMN lock_ids SET DEFAULT '[]'::json")


def downgrade() -> None:
    """Revert lock_ids back to PostgreSQL ARRAY."""
    # ALTER TYPE's USING expression cannot contain a subquery. Use a
    # connection-local function to decode JSON strings and preserve their order.
    op.execute(
        """
        CREATE FUNCTION pg_temp.impetus_55b03991a06c_lock_array(locks json)
        RETURNS varchar[] LANGUAGE sql IMMUTABLE STRICT AS $$
            SELECT ARRAY(
                SELECT value::varchar
                FROM pg_catalog.json_array_elements_text(locks)
                WITH ORDINALITY AS elements(value, position)
                ORDER BY position
            );
        $$
        """
    )
    op.execute("ALTER TABLE tasks ALTER COLUMN lock_ids DROP DEFAULT")
    op.alter_column(
        "tasks",
        "lock_ids",
        existing_type=sa.JSON(),
        type_=sa.ARRAY(sa.String()),
        existing_nullable=False,
        postgresql_using="pg_temp.impetus_55b03991a06c_lock_array(lock_ids)",
    )
    op.execute("ALTER TABLE tasks ALTER COLUMN lock_ids SET DEFAULT '{}'")
    op.execute("DROP FUNCTION pg_temp.impetus_55b03991a06c_lock_array(json)")
