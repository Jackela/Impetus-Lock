"""In-memory TaskRepository implementation for TESTING/debug modes.

Provides lightweight persistence when PostgreSQL is unavailable.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from server.domain.entities.intervention_action import InterventionAction
from server.domain.entities.task import Task
from server.domain.repositories.task_repository import TaskRepository

ActionType = Literal["provoke", "delete", "rewrite"]
AgentMode = Literal["muse", "loki"]


class InMemoryTaskRepository(TaskRepository):
    """Simple in-memory repository for tasks and intervention actions."""

    def __init__(self) -> None:
        self._tasks: dict[UUID, Task] = {}
        self._actions: dict[UUID, list[InterventionAction]] = {}
        self._task_owners: dict[UUID, UUID | None] = {}  # task_id -> user_id

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
        task = Task.create(
            content=content,
            lock_ids=lock_ids,
            title=title,
            category=category,
            priority=priority,
            due_date=due_date,
            word_count=word_count,
            user_id=user_id,
        )
        self._tasks[task.id] = task
        self._actions.setdefault(task.id, [])
        self._task_owners[task.id] = user_id
        return task

    async def get_task(self, task_id: UUID) -> Task | None:
        return self._tasks.get(task_id)

    async def update_task(self, task: Task) -> Task:
        if task.id not in self._tasks:
            raise ValueError(f"Task {task.id} not found")
        self._tasks[task.id] = task
        return task

    async def delete_task(self, task_id: UUID) -> None:
        if task_id not in self._tasks:
            raise ValueError(f"Task {task_id} not found")
        self._tasks.pop(task_id, None)
        self._actions.pop(task_id, None)
        self._task_owners.pop(task_id, None)

    async def save_action(self, action: InterventionAction) -> InterventionAction:
        self._actions.setdefault(action.task_id, []).append(action)
        return action

    async def get_actions(
        self, task_id: UUID, limit: int = 100, offset: int = 0
    ) -> list[InterventionAction]:
        actions = self._actions.get(task_id, [])
        return actions[offset : offset + limit]

    async def get_action_count(self, task_id: UUID) -> int:
        return len(self._actions.get(task_id, []))

    async def list_tasks(self, limit: int = 100, offset: int = 0) -> list[Task]:
        """List all tasks (paginated).

        Args:
            limit: Maximum number of tasks to return (default 100).
            offset: Number of tasks to skip for pagination (default 0).

        Returns:
            list[Task]: Tasks in reverse chronological order (newest first).
        """
        # Sort by created_at descending (newest first)
        sorted_tasks = sorted(
            self._tasks.values(),
            key=lambda t: t.created_at,
            reverse=True,
        )
        return sorted_tasks[offset : offset + limit]

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
        # Filter tasks by user_id
        user_tasks = [
            task
            for task_id, task in self._tasks.items()
            if self._task_owners.get(task_id) == user_id
        ]
        # Sort by created_at descending (newest first)
        sorted_tasks = sorted(user_tasks, key=lambda t: t.created_at, reverse=True)
        return sorted_tasks[offset : offset + limit]

    async def count_tasks_by_user(self, user_id: UUID) -> int:
        """Count total tasks for a specific user.

        Args:
            user_id: User UUID to count tasks for.

        Returns:
            int: Total number of tasks for this user.
        """
        return sum(1 for task_id, owner_id in self._task_owners.items() if owner_id == user_id)

    async def get_task_by_user(self, task_id: UUID, user_id: UUID) -> Task | None:
        """Get task by ID if it belongs to the specified user.

        Args:
            task_id: Task UUID.
            user_id: User UUID to verify ownership.

        Returns:
            Task | None: Task if found and owned by user, None otherwise.
        """
        if self._task_owners.get(task_id) != user_id:
            return None
        return self._tasks.get(task_id)
