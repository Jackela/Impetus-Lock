"""Unit tests for the TaskService DTO helpers.

The legacy non user-scoped TaskService CRUD methods were deleted; route-facing
behaviour is covered by ``test_task_service_scoped.py`` and the task route
characterization tests. This module keeps the ``TaskDTO`` entity mapping tests.

Constitutional Compliance:
- Article III (TDD): Tests follow Red-Green-Refactor cycle
- Article IV (SOLID): Tests verify DIP (mocked repository)
- Article V (Documentation): Complete Google-style docstrings
"""

from __future__ import annotations

import pytest

from server.application.services.task_service import TaskDTO
from server.domain.entities.task import Task


@pytest.fixture
def sample_task() -> Task:
    """Create a sample Task entity.

    Returns:
        Task entity with known values.
    """
    return Task.create(
        content="Sample task content",
        lock_ids=["lock_1", "lock_2"],
    )


class TestTaskDTO:
    """Test suite for TaskDTO."""

    def test_task_dto_from_entity(self, sample_task: Task) -> None:
        """Test conversion from Task entity to TaskDTO."""
        dto = TaskDTO.from_entity(sample_task)

        assert dto.id == str(sample_task.id)
        assert dto.content == sample_task.content
        assert dto.lock_ids == sample_task.lock_ids
        assert dto.version == sample_task.version
        assert dto.created_at == sample_task.created_at.isoformat()
        assert dto.updated_at == sample_task.updated_at.isoformat()

    def test_task_dto_id_is_string(self, sample_task: Task) -> None:
        """Test that TaskDTO.id is a string (not UUID)."""
        dto = TaskDTO.from_entity(sample_task)

        assert isinstance(dto.id, str)
        assert dto.id == str(sample_task.id)
