"""PostgreSQL implementation of TaskRepository.

Implements task persistence using SQLAlchemy + PostgreSQL with async support.

Constitutional Compliance:
- Article I (Simplicity): Uses framework-native SQLAlchemy async patterns
- Article IV (SOLID - DIP): Implements TaskRepository abstraction
- Article IV (SOLID - SRP): Single responsibility (task persistence only)
- Article V (Documentation): Complete Google-style docstrings
"""

from datetime import datetime
from typing import Literal, cast
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from server.domain.entities.intervention_action import InterventionAction
from server.domain.entities.task import Task
from server.domain.repositories.task_repository import TaskRepository
from server.infrastructure.persistence.models import (
    InterventionActionModel,
    TaskModel,
)

# Type aliases for literal types (used for casting ORM strings to domain literals)
ActionType = Literal["provoke", "delete", "rewrite"]
AgentMode = Literal["muse", "loki"]


class PostgreSQLTaskRepository(TaskRepository):
    """PostgreSQL implementation of TaskRepository using SQLAlchemy async.

    Provides persistent storage for tasks and intervention actions with:
    - Async database operations
    - Optimistic locking (version-based)
    - Cascade delete (task → actions)
    - Pagination support

    Attributes:
        _session: SQLAlchemy async session (injected via constructor).

    Example:
        ```python
        async with async_session() as session:
            repository = PostgreSQLTaskRepository(session)
            task = await repository.create_task("Content", [])
            await session.commit()
        ```
    """

    def __init__(self, session: AsyncSession):
        """Initialize repository with async session.

        Args:
            session: SQLAlchemy async session (constructor injection for DIP).
        """
        self._session = session

    async def get_task(self, task_id: UUID) -> Task | None:
        """Get task by ID.

        Args:
            task_id: Task UUID.

        Returns:
            Task | None: Task domain entity if found, None otherwise.

        Example:
            ```python
            task = await repository.get_task(task_id)
            if task:
                print(f"Found: {task.content}")
            ```
        """
        result = await self._session.execute(select(TaskModel).where(TaskModel.id == task_id))
        model = result.scalar_one_or_none()

        return self._to_entity(model) if model else None

    async def update_task(self, task: Task) -> Task:
        """Update existing task with optimistic locking.

        Args:
            task: Task domain entity with updated content and lock_ids.

        Returns:
            Task: Updated task entity with incremented version.

        Raises:
            ValueError: If task not found or version mismatch (optimistic locking).

        Example:
            ```python
            task = await repository.get_task(task_id)
            task.update_content("New content", ["lock_1", "lock_2"])
            updated = await repository.update_task(task)
            await session.commit()
            ```
        """
        # Fetch current model
        result = await self._session.execute(select(TaskModel).where(TaskModel.id == task.id))
        model = result.scalar_one_or_none()

        if not model:
            raise ValueError(f"Task {task.id} not found")

        # Update model fields (version already validated and incremented by entity)
        model.content = task.content
        model.lock_ids = task.lock_ids
        model.title = task.title
        model.category = task.category
        model.priority = task.priority
        model.due_date = task.due_date
        model.word_count = task.word_count
        model.updated_at = task.updated_at
        model.version = task.version

        await self._session.flush()

        return self._to_entity(model)

    async def delete_task(self, task_id: UUID) -> None:
        """Delete task and cascade delete all associated intervention actions.

        Args:
            task_id: Task UUID to delete.

        Raises:
            ValueError: If task not found.

        Example:
            ```python
            await repository.delete_task(task_id)
            await session.commit()

            task = await repository.get_task(task_id)
            assert task is None
            ```
        """
        result = await self._session.execute(select(TaskModel).where(TaskModel.id == task_id))
        model = result.scalar_one_or_none()

        if not model:
            raise ValueError(f"Task {task_id} not found")

        await self._session.delete(model)
        await self._session.flush()

    async def save_action(self, action: InterventionAction) -> InterventionAction:
        """Save intervention action to history (audit log).

        Args:
            action: InterventionAction domain entity to persist.

        Returns:
            InterventionAction: Saved action entity.

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
            await session.commit()
            ```
        """
        model = InterventionActionModel(
            id=action.id,
            task_id=action.task_id,
            action_type=action.action_type,
            action_id=action.action_id,
            lock_id=action.lock_id,
            content=action.content,
            anchor=action.anchor,
            mode=action.mode,
            context=action.context,
            issued_at=action.issued_at,
            created_at=action.created_at,
        )

        self._session.add(model)
        await self._session.flush()

        return action

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
            ```
        """
        result = await self._session.execute(
            select(InterventionActionModel)
            .where(InterventionActionModel.task_id == task_id)
            .order_by(InterventionActionModel.issued_at.desc())
            .limit(limit)
            .offset(offset)
        )

        return [self._action_to_entity(m) for m in result.scalars().all()]

    async def get_action_count(self, task_id: UUID) -> int:
        """Get total count of intervention actions for task.

        Args:
            task_id: Task UUID.

        Returns:
            int: Total number of actions for this task.

        Example:
            ```python
            count = await repository.get_action_count(task_id)
            print(f"Total actions: {count}")
            ```
        """
        result = await self._session.execute(
            select(func.count(InterventionActionModel.id)).where(
                InterventionActionModel.task_id == task_id
            )
        )

        return result.scalar() or 0

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
            ```
        """
        result = await self._session.execute(
            select(TaskModel).order_by(TaskModel.created_at.desc()).limit(limit).offset(offset)
        )

        return [self._to_entity(m) for m in result.scalars().all()]

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
        result = await self._session.execute(
            select(TaskModel)
            .where(TaskModel.user_id == user_id)
            .order_by(TaskModel.created_at.desc())
            .limit(limit)
            .offset(offset)
        )

        return [self._to_entity(m) for m in result.scalars().all()]

    async def count_tasks_by_user(self, user_id: UUID) -> int:
        """Count total tasks for a specific user.

        Args:
            user_id: User UUID to count tasks for.

        Returns:
            int: Total number of tasks for this user.
        """
        result = await self._session.execute(
            select(func.count(TaskModel.id)).where(TaskModel.user_id == user_id)
        )

        return result.scalar() or 0

    async def get_task_by_user(self, task_id: UUID, user_id: UUID) -> Task | None:
        """Get task by ID if it belongs to the specified user.

        Args:
            task_id: Task UUID.
            user_id: User UUID to verify ownership.

        Returns:
            Task | None: Task if found and owned by user, None otherwise.
        """
        result = await self._session.execute(
            select(TaskModel).where(
                TaskModel.id == task_id,
                TaskModel.user_id == user_id,
            )
        )
        model = result.scalar_one_or_none()

        return self._to_entity(model) if model else None

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
            Task: Created task domain entity with generated ID and timestamps.
        """
        # Create domain entity first (generates ID, timestamps, version)
        entity = Task.create(
            content=content,
            lock_ids=lock_ids,
            title=title,
            category=category,
            priority=priority,
            due_date=due_date,
            word_count=word_count,
            user_id=user_id,
        )

        # Map to ORM model
        model = TaskModel(
            id=entity.id,
            user_id=user_id,
            content=entity.content,
            lock_ids=entity.lock_ids,
            title=entity.title,
            category=entity.category,
            priority=entity.priority,
            due_date=entity.due_date,
            word_count=entity.word_count,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
            version=entity.version,
        )

        self._session.add(model)
        await self._session.flush()  # Flush to get DB-generated fields

        return entity

    @staticmethod
    def _to_entity(model: TaskModel) -> Task:
        """Convert TaskModel (ORM) to Task (domain entity).

        Args:
            model: SQLAlchemy ORM model.

        Returns:
            Task: Domain entity.
        """
        return Task(
            id=model.id,
            content=model.content,
            lock_ids=model.lock_ids,
            created_at=model.created_at,
            updated_at=model.updated_at,
            version=model.version,
            title=model.title,
            category=model.category,
            priority=model.priority,
            due_date=model.due_date,
            word_count=model.word_count,
            user_id=model.user_id,
        )

    @staticmethod
    def _action_to_entity(model: InterventionActionModel) -> InterventionAction:
        """Convert InterventionActionModel (ORM) to InterventionAction (domain entity).

        Args:
            model: SQLAlchemy ORM model.

        Returns:
            InterventionAction: Domain entity.
        """
        # Cast ORM string types to domain Literal types
        # DB CHECK constraints guarantee valid values, so casts are safe
        return InterventionAction(
            id=model.id,
            task_id=model.task_id,
            action_type=cast(ActionType, model.action_type),
            action_id=model.action_id,
            lock_id=model.lock_id,
            content=model.content,
            anchor=model.anchor,
            mode=cast(AgentMode, model.mode),
            context=model.context,
            issued_at=model.issued_at,
            created_at=model.created_at,
        )
