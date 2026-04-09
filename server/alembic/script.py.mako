"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

Constitutional Compliance:
- Article I (Simplicity): Minimal, focused migration
- Article V (Documentation): Complete docstring with purpose

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

# revision identifiers, used by Alembic.
revision: str = ${repr(up_revision)}
down_revision: Union[str, None] = ${repr(down_revision)}
branch_labels: Union[str, Sequence[str], None] = ${repr(branch_labels)}
depends_on: Union[str, Sequence[str], None] = ${repr(depends_on)}


def upgrade() -> None:
    """Apply migration changes.

    Implements forward migration with:
    - CREATE TABLE for new entities
    - ALTER TABLE for schema changes
    - CREATE INDEX for performance
    - Data migrations (if needed)
    """
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    """Revert migration changes.

    Implements backward migration that restores
    the previous schema state.

    WARNING: Data loss may occur if tables/columns are dropped.
    """
    ${downgrades if downgrades else "pass"}
