"""PostgreSQL implementation of TaskRepository.

Implements task persistence using SQLAlchemy + PostgreSQL with async support.

Constitutional Compliance:
- Article I (Simplicity): Uses framework-native SQLAlchemy async patterns
- Article IV (SOLID - DIP): Implements TaskRepository abstraction
- Article IV (SOLID - SRP): Single responsibility (task persistence only)
- Article V (Documentation): Complete Google-style docstrings
"""

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

    async def create_task(self, content: str, lock_ids: list[str]) -> Task:
        """Create new task with content and lock IDs.

        Args:
            content: Initial task content (Markdown).
            lock_ids: List of lock IDs for un-deletable blocks.

        Returns:
            Task: Created task domain entity with generated ID and timestamps.

        Example:
            ```python
            task = await repository.create_task(
                content="他打开门，犹豫着要不要进去。",
                lock_ids=["lock_1"]
            )
            await session.commit()
            assert task.id is not None
            ```
        """
        # Create domain entity first (generates ID, timestamps, version)
        entity = Task.create(content, lock_ids)

        # Map to ORM model
        model = TaskModel(
            id=entity.id,
            content=entity.content,
            lock_ids=entity.lock_ids,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
            version=entity.version,
        )

        self._session.add(model)
        await self._session.flush()  # Flush to get DB-generated fields

        return entity

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
                content="> [AI施压 - Muse]: Content",
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
        )

    @staticmethod
    def _action_to_entity(model: InterventionActionModel) -> InterventionAction:
        """Convert InterventionActionModel (ORM) to InterventionAction (domain entity).

        Args:
            model: SQLAlchemy ORM model.

        Returns:
            InterventionAction: Domain entity.
        """
        return InterventionAction(
            id=model.id,
            task_id=model.task_id,
            action_type=model.action_type,  # type: ignore
            action_id=model.action_id,
            lock_id=model.lock_id,
            content=model.content,
            anchor=model.anchor,
            mode=model.mode,  # type: ignore
            context=model.context,
            issued_at=model.issued_at,
            created_at=model.created_at,
        )
