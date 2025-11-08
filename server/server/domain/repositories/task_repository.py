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
    async def create_task(self, content: str, lock_ids: list[str]) -> Task:
        """Create new task with content and lock IDs.

        Args:
            content: Initial task content (Markdown).
            lock_ids: List of lock IDs for un-deletable blocks.

        Returns:
            Task: Created task with generated ID and timestamps.

        Example:
            ```python
            task = await repository.create_task(
                content="他打开门",
                lock_ids=["lock_1"]
            )
            assert task.id is not None
            assert task.version == 0
            ```
        """
        pass

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
                content="> AI content",
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
