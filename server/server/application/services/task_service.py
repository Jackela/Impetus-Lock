"""Task Service (Business Logic Layer).

Orchestrates task operations with business rules and validation.
Implements use cases for task management while enforcing domain constraints.

Constitutional Compliance:
- Article IV (SOLID - SRP): Business logic separated from API and persistence
- Article IV (SOLID - DIP): Depends on TaskRepository abstraction
- Article V (Documentation): Complete Google-style docstrings
"""

from dataclasses import dataclass
from uuid import UUID

from server.domain.entities.task import Task
from server.domain.repositories.task_repository import TaskRepository


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
class CreateTaskCommand:
    """Command to create a new task.

    Attributes:
        content: Initial task content (Markdown).
        lock_ids: Optional list of lock IDs for un-deletable blocks.
    """

    content: str
    lock_ids: list[str] | None = None


@dataclass
class UpdateTaskCommand:
    """Command to update an existing task.

    Attributes:
        task_id: Task UUID to update.
        content: New task content.
        lock_ids: New list of lock IDs.
        version: Expected current version (optimistic locking).
    """

    task_id: UUID
    content: str
    lock_ids: list[str]
    version: int


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
        )


class TaskService:
    """Service layer for task management operations.

    Implements business rules and orchestrates persistence operations.
    All methods are async and depend on TaskRepository abstraction.

    Attributes:
        _repository: Task repository for persistence operations.

    Example:
        ```python
        # Constructor injection (DIP)
        repository = PostgreSQLTaskRepository(session)
        service = TaskService(repository)

        # Create task
        task = await service.create_task(
            CreateTaskCommand(content="My content", lock_ids=["lock_1"])
        )

        # Update with optimistic locking
        updated = await service.update_task(
            UpdateTaskCommand(
                task_id=task.id,
                content="Updated content",
                lock_ids=["lock_1", "lock_2"],
                version=task.version
            )
        )
        ```
    """

    def __init__(self, repository: TaskRepository) -> None:
        """Initialize service with repository.

        Args:
            repository: Task repository implementation (constructor injection).
        """
        self._repository = repository

    async def create_task(self, command: CreateTaskCommand) -> TaskDTO:
        """Create a new task.

        Validates input and delegates persistence to repository.

        Args:
            command: Create task command with content and optional lock IDs.

        Returns:
            TaskDTO representing the created task.

        Raises:
            ValidationError: If content is empty or invalid.

        Example:
            ```python
            command = CreateTaskCommand(
                content="他打开门，犹豫着要不要进去。",
                lock_ids=["lock_01"]
            )
            task = await service.create_task(command)
            assert task.version == 0
            ```
        """
        # Business rule: content must not be empty
        if not command.content or not command.content.strip():
            raise ValidationError("content", "Content cannot be empty")

        # Business rule: content max length
        if len(command.content) > 100000:
            raise ValidationError("content", "Content exceeds maximum length of 100000")

        # Delegate to repository
        entity = await self._repository.create_task(
            content=command.content,
            lock_ids=command.lock_ids or [],
        )

        return TaskDTO.from_entity(entity)

    async def get_task(self, task_id: UUID) -> TaskDTO:
        """Get task by ID.

        Args:
            task_id: Task UUID.

        Returns:
            TaskDTO representing the task.

        Raises:
            TaskNotFoundError: If task not found.

        Example:
            ```python
            task = await service.get_task(task_id)
            print(f"Found: {task.content}")
            ```
        """
        entity = await self._repository.get_task(task_id)

        if entity is None:
            raise TaskNotFoundError(task_id)

        return TaskDTO.from_entity(entity)

    async def update_task(self, command: UpdateTaskCommand) -> TaskDTO:
        """Update existing task with optimistic locking.

        Validates version before updating to prevent concurrent modification conflicts.

        Args:
            command: Update command with new content, lock IDs, and expected version.

        Returns:
            TaskDTO representing the updated task.

        Raises:
            TaskNotFoundError: If task not found.
            VersionMismatchError: If version doesn't match (optimistic locking).
            ValidationError: If content is empty or invalid.

        Example:
            ```python
            command = UpdateTaskCommand(
                task_id=task.id,
                content="Updated content",
                lock_ids=["lock_1"],
                version=task.version  # Must match current version
            )
            updated = await service.update_task(command)
            assert updated.version == task.version + 1
            ```
        """
        # Business rule: content validation
        if not command.content or not command.content.strip():
            raise ValidationError("content", "Content cannot be empty")

        if len(command.content) > 100000:
            raise ValidationError("content", "Content exceeds maximum length of 100000")

        # Fetch current task
        entity = await self._repository.get_task(command.task_id)

        if entity is None:
            raise TaskNotFoundError(command.task_id)

        # Optimistic locking check
        if entity.version != command.version:
            raise VersionMismatchError(command.version, entity.version)

        # Update entity
        entity.update_content(command.content, command.lock_ids)

        # Persist changes
        updated = await self._repository.update_task(entity)

        return TaskDTO.from_entity(updated)

    async def delete_task(self, task_id: UUID) -> None:
        """Delete task by ID.

        Args:
            task_id: Task UUID to delete.

        Raises:
            TaskNotFoundError: If task not found.

        Example:
            ```python
            await service.delete_task(task_id)
            # Task is now deleted
            ```
        """
        # Verify task exists first
        entity = await self._repository.get_task(task_id)

        if entity is None:
            raise TaskNotFoundError(task_id)

        await self._repository.delete_task(task_id)

    async def list_tasks(
        self,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[TaskDTO], int]:
        """List tasks with pagination.

        Args:
            limit: Maximum number of tasks to return (default 100, max 100).
            offset: Number of tasks to skip.

        Returns:
            Tuple of (list of TaskDTO, total count).

        Raises:
            ValidationError: If pagination params are invalid.

        Example:
            ```python
            tasks, total = await service.list_tasks(limit=10, offset=0)
            print(f"Showing {len(tasks)} of {total} tasks")
            ```
        """
        # Validate pagination
        if limit < 1 or limit > 100:
            raise ValidationError("limit", "Limit must be between 1 and 100")

        if offset < 0:
            raise ValidationError("offset", "Offset must be non-negative")

        # Fetch tasks
        entities = await self._repository.list_tasks(limit=limit, offset=offset)

        # Get total count (fetch all and count)
        all_tasks = await self._repository.list_tasks(limit=10000, offset=0)
        total = len(all_tasks)

        dtos = [TaskDTO.from_entity(e) for e in entities]
        return dtos, total
