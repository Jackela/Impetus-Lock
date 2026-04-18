"""Task repository abstraction.

Defines interface for task and intervention action persistence.
Implementations can use PostgreSQL, SQLite, or in-memory storage.

Constitutional Compliance:
- Article I (Simplicity): Minimal interface, only essential operations
- Article IV (SOLID - DIP): Application layer depends on this abstraction
- Article IV (SOLID - ISP): Interface segregation (focused on task operations)
- Article V (Documentation): Complete Google-style docstrings
"""

from abc import ABC, abstractmethod
from datetime import datetime
from uuid import UUID

from server.domain.entities.intervention_action import InterventionAction
from server.domain.entities.task import Task


class TaskRepository(ABC):
    """Repository abstraction for task and intervention action persistence.

    Defines contract for data access operations without specifying implementation.
    Application services depend on this abstraction (Dependency Inversion Principle).

    Implementations:
        - PostgreSQLTaskRepository: Production persistence with PostgreSQL
        - InMemoryTaskRepository: Testing/development with in-memory storage

    Example:
        ```python
        # Application service depends on abstraction
        class InterventionService:
            def __init__(self, repository: TaskRepository):
                self._repository = repository

            async def save_task(self, content: str) -> Task:
                return await self._repository.create_task(content, [])
        ```
    """

    @abstractmethod
    async def get_task(self, task_id: UUID) -> Task | None:
        """Get task by ID.

        Args:
            task_id: Task UUID.

        Returns:
            Task | None: Task if found, None otherwise.

        Example:
            ```python
            task = await repository.get_task(task_id)
            if task:
                print(f"Found task: {task.content}")
            ```
        """
        pass

    @abstractmethod
    async def update_task(self, task: Task) -> Task:
        """Update existing task (optimistic locking).

        Args:
            task: Task entity with updated content and lock_ids.

        Returns:
            Task: Updated task with incremented version.

        Raises:
            ValueError: If task not found or version mismatch (optimistic locking).

        Example:
            ```python
            task = await repository.get_task(task_id)
            task.update_content("New content", ["lock_1", "lock_2"])
            updated = await repository.update_task(task)
            assert updated.version == task.version
            ```
        """
        pass

    @abstractmethod
    async def delete_task(self, task_id: UUID) -> None:
        """Delete task and all associated intervention actions.

        Args:
            task_id: Task UUID to delete.

        Raises:
            ValueError: If task not found.

        Example:
            ```python
            await repository.delete_task(task_id)
            task = await repository.get_task(task_id)
            assert task is None
            ```
        """
        pass

    @abstractmethod
    async def save_action(self, action: InterventionAction) -> InterventionAction:
        """Save intervention action to history (audit log).

        Args:
            action: InterventionAction entity to persist.

        Returns:
            InterventionAction: Saved action (may include generated fields).

        Example:
            ```python
            action = InterventionAction.create(
                task_id=task.id,
                action_type="provoke",
                action_id="act_001",
                lock_id="lock_001",
                content="门后忽然传来潮湿的呼吸声。",
                anchor={"type": "pos", "from": 123},
                mode="muse",
                context="User context",
                issued_at=datetime.now(UTC),
            )
            saved = await repository.save_action(action)
            assert saved.id == action.id
            ```
        """
        pass

    @abstractmethod
    async def get_actions(
        self, task_id: UUID, limit: int = 100, offset: int = 0
    ) -> list[InterventionAction]:
        """Get intervention action history for task (paginated).

        Args:
            task_id: Task UUID.
            limit: Maximum number of actions to return (default 100).
            offset: Number of actions to skip for pagination (default 0).

        Returns:
            list[InterventionAction]: Actions in reverse chronological order (newest first).

        Example:
            ```python
            # Get most recent 10 actions
            actions = await repository.get_actions(task_id, limit=10)
            for action in actions:
                print(f"{action.issued_at}: {action.action_type}")

            # Get next page
            next_actions = await repository.get_actions(task_id, limit=10, offset=10)
            ```
        """
        pass

    @abstractmethod
    async def get_action_count(self, task_id: UUID) -> int:
        """Get total count of intervention actions for task.

        Args:
            task_id: Task UUID.

        Returns:
            int: Total number of actions for this task.

        Example:
            ```python
            count = await repository.get_action_count(task_id)
            pages = (count + 99) // 100  # Calculate number of pages (100 per page)
            ```
        """
        pass

    @abstractmethod
    async def list_tasks(self, limit: int = 100, offset: int = 0) -> list[Task]:
        """List all tasks (paginated).

        Args:
            limit: Maximum number of tasks to return (default 100).
            offset: Number of tasks to skip for pagination (default 0).

        Returns:
            list[Task]: Tasks in reverse chronological order (newest first).

        Example:
            ```python
            # Get most recent 10 tasks
            tasks = await repository.list_tasks(limit=10)
            for task in tasks:
                print(f"{task.created_at}: {task.content[:50]}...")

            # Get next page
            next_tasks = await repository.list_tasks(limit=10, offset=10)
            ```
        """
        pass

    @abstractmethod
    async def list_tasks_by_user(
        self, user_id: UUID, limit: int = 100, offset: int = 0
    ) -> list[Task]:
        """List tasks for a specific user (paginated).

        Args:
            user_id: User UUID to filter by.
            limit: Maximum number of tasks to return (default 100).
            offset: Number of tasks to skip for pagination (default 0).

        Returns:
            list[Task]: User's tasks in reverse chronological order (newest first).
        """
        pass

    @abstractmethod
    async def count_tasks_by_user(self, user_id: UUID) -> int:
        """Count total tasks for a specific user.

        Args:
            user_id: User UUID to count tasks for.

        Returns:
            int: Total number of tasks for this user.
        """
        pass

    @abstractmethod
    async def get_task_by_user(self, task_id: UUID, user_id: UUID) -> Task | None:
        """Get task by ID if it belongs to the specified user.

        Args:
            task_id: Task UUID.
            user_id: User UUID to verify ownership.

        Returns:
            Task | None: Task if found and owned by user, None otherwise.
        """
        pass

    @abstractmethod
    async def create_task(
        self,
        content: str,
        lock_ids: list[str],
        user_id: UUID | None = None,
        title: str = "",
        category: str = "WRITING",
        priority: str = "MEDIUM",
        due_date: datetime | None = None,
        word_count: int = 0,
    ) -> Task:
        """Create new task with content, lock IDs, and optional user ID.

        Args:
            content: Initial task content (Markdown).
            lock_ids: List of lock IDs for un-deletable blocks.
            user_id: Optional user ID to associate with the task.
            title: Optional task title (defaults to empty string).
            category: Optional task category (defaults to "WRITING").
            priority: Optional task priority (defaults to "MEDIUM").
            due_date: Optional task due date.
            word_count: Optional initial word count (defaults to 0).

        Returns:
            Task: Created task with generated ID and timestamps.
        """
        pass
