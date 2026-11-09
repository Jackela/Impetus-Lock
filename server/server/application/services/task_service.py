"""Task Service (Business Logic Layer).

Orchestrates task operations with business rules and validation.
Implements use cases for task management while enforcing domain constraints.

Constitutional Compliance:
- Article IV (SOLID - SRP): Business logic separated from API and persistence
- Article IV (SOLID - DIP): Depends on TaskRepository abstraction
- Article V (Documentation): Complete Google-style docstrings
"""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from server.domain.entities.intervention_action import InterventionAction
from server.domain.entities.task import Task
from server.domain.errors import TaskVersionConflictError
from server.domain.repositories.task_repository import TaskRepository
from server.domain.transactions import NullTransaction, TransactionSupport


class TaskServiceError(Exception):
    """Base exception for task service errors."""

    def __init__(self, code: str, message: str) -> None:
        """Initialize error with code and message.

        Args:
            code: Error code for programmatic handling.
            message: Human-readable error message.
        """
        self.code = code
        self.message = message
        super().__init__(message)


class TaskNotFoundError(TaskServiceError):
    """Raised when a task is not found."""

    def __init__(self, task_id: UUID) -> None:
        """Initialize with task ID.

        Args:
            task_id: The task ID that was not found.
        """
        super().__init__(
            code="task_not_found",
            message=f"Task {task_id} not found",
        )


class VersionMismatchError(TaskServiceError):
    """Raised when optimistic locking fails."""

    def __init__(self, expected: int, actual: int) -> None:
        """Initialize with version info.

        Args:
            expected: The expected version.
            actual: The actual version in database.
        """
        super().__init__(
            code="version_mismatch",
            message=f"Version mismatch: expected {expected}, got {actual}",
        )
        self.expected = expected
        self.actual = actual


class ValidationError(TaskServiceError):
    """Raised when input validation fails."""

    def __init__(self, field: str, message: str) -> None:
        """Initialize with field and message.

        Args:
            field: The field that failed validation.
            message: Validation error message.
        """
        super().__init__(
            code=f"validation_error_{field}",
            message=message,
        )
        self.field = field


@dataclass
class TaskDTO:
    """Data transfer object for task responses.

    Attributes:
        id: Task UUID.
        content: Task content.
        lock_ids: List of lock IDs.
        created_at: Creation timestamp (ISO format).
        updated_at: Last update timestamp (ISO format).
        version: Current version number.
    """

    id: str
    content: str
    lock_ids: list[str]
    created_at: str
    updated_at: str
    version: int
    title: str
    category: str
    priority: str
    due_date: str | None
    word_count: int

    @classmethod
    def from_entity(cls, task: Task) -> "TaskDTO":
        """Convert Task entity to DTO.

        Args:
            task: Domain entity to convert.

        Returns:
            TaskDTO with string-formatted fields.
        """
        return cls(
            id=str(task.id),
            content=task.content,
            lock_ids=task.lock_ids,
            created_at=task.created_at.isoformat(),
            updated_at=task.updated_at.isoformat(),
            version=task.version,
            title=task.title,
            category=task.category,
            priority=task.priority,
            due_date=task.due_date.isoformat() if task.due_date else None,
            word_count=task.word_count,
        )


class TaskService:
    """Service layer for task management operations.

    Implements business rules and orchestrates persistence operations.
    All methods are async and depend on TaskRepository abstraction.

    Attributes:
        _repository: Task repository for persistence operations.
        _transaction: Transaction support used to commit route-facing writes.

    Example:
        ```python
        # Constructor injection (DIP)
        repository = PostgreSQLTaskRepository(session)
        service = TaskService(repository, SqlAlchemyTransaction(session))

        # Create a task owned by the authenticated user
        task = await service.create_task_for_user(
            user_id, "My content", lock_ids=["lock_1"]
        )

        # Update with optimistic locking
        updated = await service.update_task_for_user(
            user_id,
            task.id,
            content="Updated content",
            lock_ids=["lock_1", "lock_2"],
            version=task.version,
        )
        ```
    """

    def __init__(
        self,
        repository: TaskRepository,
        transaction: TransactionSupport | None = None,
    ) -> None:
        """Initialize service with repository.

        Args:
            repository: Task repository implementation (constructor injection).
            transaction: Optional transaction support used by the user-scoped
                write operations to finish exactly one commit; defaults to a
                no-op for session-less (fallback) repositories.
        """
        self._repository = repository
        self._transaction: TransactionSupport = transaction or NullTransaction()

    # ------------------------------------------------------------------
    # User-scoped, route-facing operations
    #
    # Added by openspec/changes/refactor-route-service-boundaries. These
    # methods back the authenticated /tasks routes: they take the
    # authenticated user_id, apply route-compatible validation only (no
    # extra content rules), verify ownership before reads/mutations, and
    # finish each write with exactly one commit through the injected
    # transaction support. The legacy unscoped CRUD methods were removed
    # once every route used the user-scoped variants.
    # ------------------------------------------------------------------

    async def list_tasks_for_user(
        self,
        user_id: UUID,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[Task], int]:
        """List the user's tasks newest-first with their total.

        Args:
            user_id: Authenticated user's UUID.
            limit: Maximum number of tasks to return.
            offset: Number of tasks to skip.

        Returns:
            tuple[list[Task], int]: Newest-first page and the user's total.
        """
        tasks = await self._repository.list_tasks_by_user(
            user_id=user_id, limit=limit, offset=offset
        )
        total = await self._repository.count_tasks_by_user(user_id=user_id)
        return tasks, total

    async def get_task_for_user(self, user_id: UUID, task_id: UUID) -> Task:
        """Get a task owned by the user.

        Args:
            user_id: Authenticated user's UUID.
            task_id: Task UUID.

        Returns:
            Task: The owned task entity.

        Raises:
            TaskNotFoundError: If the task is missing or owned by another user.
        """
        task = await self._repository.get_task_by_user(task_id, user_id=user_id)

        if task is None:
            raise TaskNotFoundError(task_id)

        return task

    async def create_task_for_user(
        self,
        user_id: UUID,
        content: str,
        lock_ids: list[str],
        *,
        title: str = "",
        category: str = "WRITING",
        priority: str = "MEDIUM",
        due_date: datetime | None = None,
        word_count: int = 0,
    ) -> Task:
        """Create a task owned by the user with route-compatible validation.

        Validation is the HTTP schema's job; this method intentionally does
        NOT apply stricter content rules (e.g. whitespace rejection).

        Args:
            user_id: Authenticated user's UUID.
            content: Task content (Markdown).
            lock_ids: Lock IDs for un-deletable blocks.
            title: Task title.
            category: Task category.
            priority: Task priority.
            due_date: Optional due date.
            word_count: Initial word count.

        Returns:
            Task: Created task entity (version 0).
        """
        task = await self._repository.create_task(
            content=content,
            lock_ids=lock_ids,
            user_id=user_id,
            title=title,
            category=category,
            priority=priority,
            due_date=due_date,
            word_count=word_count,
        )
        await self._transaction.commit()
        return task

    async def update_task_for_user(
        self,
        user_id: UUID,
        task_id: UUID,
        *,
        content: str,
        lock_ids: list[str],
        version: int,
        title: str | None = None,
        category: str | None = None,
        priority: str | None = None,
        due_date: datetime | None = None,
        word_count: int | None = None,
    ) -> Task:
        """Update a task owned by the user with optimistic locking.

        Args:
            user_id: Authenticated user's UUID.
            task_id: Task UUID.
            content: New task content.
            lock_ids: New lock IDs.
            version: Expected current version (must match).
            title: New task title.
            category: New task category.
            priority: New task priority.
            due_date: New due date.
            word_count: New word count.

        Returns:
            Task: Updated task entity with the incremented version.

        Raises:
            TaskNotFoundError: If the task is missing or owned by another user.
            VersionMismatchError: If the expected version does not match.
            ValueError: If the repository fails to persist the update.
        """
        task = await self._repository.get_task_by_user(task_id, user_id=user_id)

        if task is None:
            raise TaskNotFoundError(task_id)

        if task.version != version:
            raise VersionMismatchError(version, task.version)

        task.update(
            content=content,
            lock_ids=lock_ids,
            title=title,
            category=category,
            priority=priority,
            due_date=due_date,
            word_count=word_count,
        )

        try:
            updated_task = await self._repository.update_task(task)
        except TaskVersionConflictError as conflict:
            raise VersionMismatchError(conflict.expected, conflict.actual) from conflict
        await self._transaction.commit()
        return updated_task

    async def delete_task_for_user(self, user_id: UUID, task_id: UUID) -> None:
        """Delete a task owned by the user (cascades intervention actions).

        Args:
            user_id: Authenticated user's UUID.
            task_id: Task UUID.

        Raises:
            TaskNotFoundError: If the task is missing or owned by another user.
            ValueError: If the repository fails to delete the task.
        """
        task = await self._repository.get_task_by_user(task_id, user_id=user_id)

        if task is None:
            raise TaskNotFoundError(task_id)

        await self._repository.delete_task(task_id)
        await self._transaction.commit()

    async def get_intervention_history_for_user(
        self,
        user_id: UUID,
        task_id: UUID,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[InterventionAction], int]:
        """Get intervention history for a task owned by the user.

        Ownership is verified before any history row is read.

        Args:
            user_id: Authenticated user's UUID.
            task_id: Task UUID.
            limit: Maximum number of actions to return.
            offset: Number of actions to skip.

        Returns:
            tuple[list[InterventionAction], int]: Newest-first page and total.

        Raises:
            TaskNotFoundError: If the task is missing or owned by another user.
        """
        task = await self._repository.get_task_by_user(task_id, user_id=user_id)

        if task is None:
            raise TaskNotFoundError(task_id)

        actions = await self._repository.get_actions(task_id, limit=limit, offset=offset)
        total = await self._repository.get_action_count(task_id)
        return actions, total
