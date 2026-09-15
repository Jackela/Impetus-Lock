"""Template domain entity.

Framework-agnostic representation of a user-owned task template.
Persistence details (ORM mapping) live in the infrastructure layer.

Constitutional Compliance:
- Article IV (SOLID - SRP): Entity carries data, no persistence concerns
- Article V (Documentation): Complete Google-style docstrings
"""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass
class Template:
    """A reusable task template owned by a user.

    Attributes:
        id: Template UUID.
        name: Human-readable template name (max 100 chars).
        content: Initial task content in Markdown.
        user_id: Owning user's UUID.
        created_at: Creation timestamp (UTC).
        updated_at: Last update timestamp (UTC).
    """

    id: UUID
    name: str
    content: str
    user_id: UUID
    created_at: datetime
    updated_at: datetime
