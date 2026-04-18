"""Tests for PostgreSQL TaskRepository with Sprint 2 fields.

These tests are expected to fail (red phase) until the repository
implementation is updated to handle the new Sprint 2 fields.
"""

from __future__ import annotations

from uuid import uuid4

import pytest

from server.infrastructure.persistence.in_memory_task_repository import (
    InMemoryTaskRepository,
)


@pytest.fixture
def repository():
    """Create fresh in-memory repository for each test."""
    return InMemoryTaskRepository()


@pytest.mark.anyio
async def test_create_task_with_sprint2_fields(repository: InMemoryTaskRepository) -> None:
    """Task creation should persist all Sprint 2 fields."""
    task = await repository.create_task(
        content="Write chapter 1",
        lock_ids=["lock_1"],
        user_id=uuid4(),
        title="Novel Draft",
        category="WRITING",
        priority="HIGH",
        due_date=None,
        word_count=1200,
    )

    assert task.title == "Novel Draft"
    assert task.category == "WRITING"
    assert task.priority == "HIGH"
    assert task.word_count == 1200


@pytest.mark.anyio
async def test_get_task_returns_sprint2_fields(repository: InMemoryTaskRepository) -> None:
    """Retrieving a task should return all Sprint 2 fields."""
    created = await repository.create_task(
        content="Research notes",
        lock_ids=[],
        title="World Building",
        category="RESEARCH",
        priority="MEDIUM",
        word_count=500,
    )

    fetched = await repository.get_task(created.id)

    assert fetched is not None
    assert fetched.title == "World Building"
    assert fetched.category == "RESEARCH"
    assert fetched.priority == "MEDIUM"
    assert fetched.word_count == 500


@pytest.mark.anyio
async def test_update_task_preserves_sprint2_fields(repository: InMemoryTaskRepository) -> None:
    """Updating a task should persist Sprint 2 fields via update()."""
    task = await repository.create_task(
        content="Initial draft",
        lock_ids=[],
        title="Draft",
        category="WRITING",
        priority="LOW",
        word_count=100,
    )

    task.update(
        content="Final draft",
        lock_ids=["lock_2"],
        title="Final",
        category="REVIEW",
        priority="HIGH",
        word_count=1000,
    )

    updated = await repository.update_task(task)

    assert updated.title == "Final"
    assert updated.category == "REVIEW"
    assert updated.priority == "HIGH"
    assert updated.word_count == 1000
    assert updated.version == 1
