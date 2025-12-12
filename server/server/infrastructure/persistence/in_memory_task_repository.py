"""In-memory TaskRepository implementation for TESTING/debug modes.

Provides lightweight persistence when PostgreSQL is unavailable.
"""

from __future__ import annotations

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

    async def create_task(self, content: str, lock_ids: list[str]) -> Task:
        task = Task.create(content, lock_ids)
        self._tasks[task.id] = task
        self._actions.setdefault(task.id, [])
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
