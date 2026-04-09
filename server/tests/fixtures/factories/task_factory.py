"""Task factory for security testing.

Provides a Task dataclass for testing task input validation.

Example:
    >>> from datetime import UTC, datetime
    >>> from uuid import uuid4
    >>> task = Task(
    ...     id=uuid4(),
    ...     title="Test Task",
    ...     content="Task content",
    ...     created_at=datetime.now(UTC),
    ... )
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime


@dataclass
class Task:
    """Task entity for testing.

    Attributes:
        id: Unique task identifier
        title: Task title (1-200 characters)
        content: Task content/body
        lock_id: Optional associated lock ID
        created_at: Timestamp when task was created

    Raises:
        ValueError: If title is empty or exceeds 200 characters
    """

    id: object
    title: str
    content: str
    lock_id: object | None = None
    created_at: datetime = datetime.now(UTC)

    def __post_init__(self) -> None:
        """Validate task title after initialization."""
        if not self.title or len(self.title) > 200:
            raise ValueError("Title must be 1-200 characters")
