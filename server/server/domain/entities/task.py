"""Task domain entity.

Represents a user's writing task with content and lock IDs.
Pure domain model with no framework dependencies.

Constitutional Compliance:
- Article I (Simplicity): Uses Python dataclass (framework-native)
- Article IV (SOLID): No dependencies on infrastructure or API layers
- Article V (Documentation): Complete Google-style docstrings
"""

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID, uuid4


@dataclass
class Task:
    """Task domain entity.

    Represents a writing task with un-deletable locked content blocks.
    Tasks persist across sessions and track their intervention history.

    Attributes:
        id: Unique task identifier (UUID v4).
        content: Current task content (Markdown format).
        lock_ids: List of lock IDs for un-deletable content blocks.
        created_at: Task creation timestamp (UTC).
        updated_at: Last update timestamp (UTC).
        version: Optimistic locking version number (increments on each update).
        title: Task title.
        category: Task category (e.g., "WRITING").
        priority: Task priority (e.g., "MEDIUM").
        due_date: Optional task due date (UTC).
        word_count: Current word count.
        user_id: Optional user identifier (UUID v4).

    Example:
        ```python
        task = Task.create(
            content="他打开门，犹豫着要不要进去。",
            lock_ids=["lock_01j4z3m8a6q3qz2x8j4z3m8a"]
        )
        print(task.id)  # UUID('550e8400-e29b-41d4-a716-446655440000')
        print(task.version)  # 0
        ```
    """

    id: UUID
    content: str
    lock_ids: list[str]
    created_at: datetime
    updated_at: datetime
    version: int = 0
    title: str = ""
    category: str = "WRITING"
    priority: str = "MEDIUM"
    due_date: datetime | None = None
    word_count: int = 0
    user_id: UUID | None = None

    @classmethod
    def create(
        cls,
        content: str,
        lock_ids: list[str] | None = None,
        title: str = "",
        category: str = "WRITING",
        priority: str = "MEDIUM",
        due_date: datetime | None = None,
        word_count: int = 0,
        user_id: UUID | None = None,
    ) -> "Task":
        """Create new task with generated ID and timestamps.

        Args:
            content: Initial task content (Markdown).
            lock_ids: Optional list of lock IDs (defaults to empty list).
            title: Optional task title (defaults to empty string).
            category: Optional task category (defaults to "WRITING").
            priority: Optional task priority (defaults to "MEDIUM").
            due_date: Optional task due date.
            word_count: Optional initial word count (defaults to 0).
            user_id: Optional user identifier.

        Returns:
            Task: New task instance with version 0.

        Example:
            ```python
            task = Task.create("My content", ["lock_1"])
            assert task.version == 0
            assert task.id is not None
            ```
        """
        now = datetime.now(UTC)
        return cls(
            id=uuid4(),
            content=content,
            lock_ids=lock_ids or [],
            created_at=now,
            updated_at=now,
            version=0,
            title=title,
            category=category,
            priority=priority,
            due_date=due_date,
            word_count=word_count,
            user_id=user_id,
        )

    def update_content(self, content: str, lock_ids: list[str]) -> None:
        """Update task content and increment version (optimistic locking).

        Args:
            content: New content (Markdown).
            lock_ids: New list of lock IDs.

        Example:
            ```python
            task = Task.create("Old content", [])
            old_version = task.version
            task.update_content("New content", ["lock_1"])
            assert task.version == old_version + 1
            ```
        """
        self.content = content
        self.lock_ids = lock_ids
        self.updated_at = datetime.now(UTC)
        self.version += 1

    def update(
        self,
        content: str | None = None,
        lock_ids: list[str] | None = None,
        title: str | None = None,
        category: str | None = None,
        priority: str | None = None,
        due_date: datetime | None = None,
        word_count: int | None = None,
    ) -> None:
        """Update task fields and increment version (optimistic locking).

        Only provided fields are updated.

        Args:
            content: New content (Markdown).
            lock_ids: New list of lock IDs.
            title: New task title.
            category: New task category.
            priority: New task priority.
            due_date: New task due date.
            word_count: New word count.

        Example:
            ```python
            task = Task.create("Old content", [])
            old_version = task.version
            task.update(title="New Title")
            assert task.version == old_version + 1
            ```
        """
        if content is not None:
            self.content = content
        if lock_ids is not None:
            self.lock_ids = lock_ids
        if title is not None:
            self.title = title
        if category is not None:
            self.category = category
        if priority is not None:
            self.priority = priority
        if due_date is not None:
            self.due_date = due_date
        if word_count is not None:
            self.word_count = word_count
        self.updated_at = datetime.now(UTC)
        self.version += 1
