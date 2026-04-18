"""Task API Schema definitions.

Pydantic models for Task API request/response validation.

Constitutional Compliance:
- Article I (Simplicity): Direct field definitions, no meta-abstractions
- Article V (Documentation): Complete docstrings for all schemas
"""

from datetime import datetime

from pydantic import BaseModel, Field, TypeAdapter

from server.domain.entities.intervention_action import InterventionAction
from server.domain.entities.task import Task
from server.domain.models.anchor import Anchor

# TypeAdapter for validating Anchor union type
_anchor_adapter: TypeAdapter[Anchor] = TypeAdapter(Anchor)


class TaskCreateRequest(BaseModel):
    """Request schema for creating a task.

    Attributes:
        content: Task content in Markdown format (1-100000 chars).
        lock_ids: List of lock IDs for un-deletable content blocks.
        title: Task title.
        category: Task category.
        priority: Task priority.
        due_date: Optional ISO format due date.
        word_count: Initial word count.

    Example:
        ```python
        request = TaskCreateRequest(
            content="# My Task\\n\\nContent here",
            lock_ids=["lock_01j4z3m8a6q3qz2x8j4z3m8a"]
        )
        ```
    """

    content: str = Field(
        ..., min_length=1, max_length=100000, description="Task content (Markdown)"
    )
    lock_ids: list[str] = Field(default_factory=list, description="List of lock IDs")
    title: str = Field(default="", description="Task title")
    category: str = Field(default="WRITING", description="Task category")
    priority: str = Field(default="MEDIUM", description="Task priority")
    due_date: datetime | None = Field(default=None, description="Optional ISO format due date")
    word_count: int = Field(default=0, ge=0, description="Initial word count")


class TaskUpdateRequest(BaseModel):
    """Request schema for updating a task.

    Attributes:
        content: Updated task content in Markdown format (1-100000 chars).
        lock_ids: Updated list of lock IDs.
        version: Current version for optimistic locking (must match server).
        title: Updated task title.
        category: Updated task category.
        priority: Updated task priority.
        due_date: Updated ISO format due date.
        word_count: Updated word count.

    Example:
        ```python
        request = TaskUpdateRequest(
            content="# Updated Task",
            lock_ids=["lock_1"],
            version=0
        )
        ```
    """

    content: str = Field(..., min_length=1, max_length=100000, description="Updated task content")
    lock_ids: list[str] = Field(..., description="Updated list of lock IDs")
    version: int = Field(..., ge=0, description="Current version (for optimistic locking)")
    title: str | None = Field(default=None, description="Updated task title")
    category: str | None = Field(default=None, description="Updated task category")
    priority: str | None = Field(default=None, description="Updated task priority")
    due_date: datetime | None = Field(default=None, description="Updated ISO format due date")
    word_count: int | None = Field(default=None, ge=0, description="Updated word count")


class TaskResponse(BaseModel):
    """Response schema for task operations.

    Attributes:
        id: Task UUID as string.
        content: Task content in Markdown format.
        lock_ids: List of lock IDs.
        created_at: ISO format creation timestamp.
        updated_at: ISO format last update timestamp.
        version: Current version number.
        title: Task title.
        category: Task category.
        priority: Task priority.
        due_date: Optional ISO format due date.
        word_count: Current word count.

    Example:
        ```python
        task = Task.create("Content", ["lock_1"])
        response = TaskResponse.from_entity(task)
        print(response.id)  # "550e8400-e29b-41d4-a716-446655440000"
        ```
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
    def from_entity(cls, task: Task) -> "TaskResponse":
        """Convert Task entity to response model.

        Args:
            task: Task domain entity.

        Returns:
            TaskResponse: API response model.
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


class TaskListResponse(BaseModel):
    """Response schema for task list query.

    Attributes:
        total: Total number of tasks available.
        limit: Maximum number of tasks returned in this response.
        offset: Number of tasks skipped.
        tasks: List of task responses.

    Example:
        ```python
        response = TaskListResponse(
            total=100,
            limit=10,
            offset=0,
            tasks=[TaskResponse.from_entity(task)]
        )
        ```
    """

    total: int
    limit: int
    offset: int
    tasks: list[TaskResponse]


class InterventionActionResponse(BaseModel):
    """Response schema for intervention action.

    Attributes:
        id: Action UUID as string.
        task_id: Parent task UUID as string.
        action_type: Type of intervention (e.g., "insert", "replace").
        action_id: Unique action identifier.
        lock_id: Optional lock ID associated with action.
        content: Optional content payload.
        anchor: Position anchor (offset or selection tuple).
        mode: Intervention mode ("muse" or "loki").
        context: Context text that triggered intervention.
        issued_at: ISO format issue timestamp.
        created_at: ISO format creation timestamp.

    Example:
        ```python
        action = InterventionAction.create(...)
        response = InterventionActionResponse.from_entity(action)
        ```
    """

    id: str
    task_id: str
    action_type: str
    action_id: str
    lock_id: str | None
    content: str | None
    anchor: Anchor
    mode: str
    context: str
    issued_at: str
    created_at: str

    @classmethod
    def from_entity(cls, action: InterventionAction) -> "InterventionActionResponse":
        """Convert InterventionAction entity to response model.

        Args:
            action: InterventionAction domain entity.

        Returns:
            InterventionActionResponse: API response model.
        """
        return cls(
            id=str(action.id),
            task_id=str(action.task_id),
            action_type=action.action_type,
            action_id=action.action_id,
            lock_id=action.lock_id,
            content=action.content,
            anchor=_anchor_adapter.validate_python(action.anchor),
            mode=action.mode,
            context=action.context,
            issued_at=action.issued_at.isoformat(),
            created_at=action.created_at.isoformat(),
        )


class InterventionHistoryResponse(BaseModel):
    """Response schema for intervention history query.

    Attributes:
        total: Total number of actions available.
        limit: Maximum number of actions returned in this response.
        offset: Number of actions skipped.
        actions: List of intervention action responses.

    Example:
        ```python
        response = InterventionHistoryResponse(
            total=50,
            limit=10,
            offset=0,
            actions=[InterventionActionResponse.from_entity(action)]
        )
        ```
    """

    total: int
    limit: int
    offset: int
    actions: list[InterventionActionResponse]
