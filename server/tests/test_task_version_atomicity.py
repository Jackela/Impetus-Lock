"""Regression tests for task repository optimistic version conflicts (R07)."""

from copy import deepcopy
from datetime import UTC, datetime
from uuid import uuid4

import pytest

from server.infrastructure.persistence.in_memory_task_repository import InMemoryTaskRepository


@pytest.mark.asyncio
@pytest.mark.parametrize("read", ["create", "get", "get_by_user", "list", "list_by_user"])
async def test_task_snapshots_cannot_mutate_persisted_version(read: str) -> None:
    """Editing any returned snapshot must not bypass persistence/version checks."""
    repository = InMemoryTaskRepository()
    owner = uuid4()
    created = await repository.create_task("Original draft", ["original-lock"], user_id=owner)
    if read == "create":
        snapshot = created
    elif read == "get":
        snapshot = await repository.get_task(created.id)
    elif read == "get_by_user":
        snapshot = await repository.get_task_by_user(created.id, owner)
    elif read == "list":
        snapshot = (await repository.list_tasks())[0]
    else:
        snapshot = (await repository.list_tasks_by_user(owner))[0]
    assert snapshot is not None
    snapshot.lock_ids.append("unsaved-lock")
    snapshot.update(content="Unsaved draft")

    persisted = await repository.get_task(created.id)
    assert persisted is not None
    assert persisted.content == "Original draft"
    assert persisted.lock_ids == ["original-lock"]
    assert persisted.version == 0


@pytest.mark.asyncio
async def test_update_task_rejects_second_write_from_same_version() -> None:
    """Only the first of two independent version-zero snapshots may be saved."""
    repository = InMemoryTaskRepository()
    due_date = datetime(2026, 10, 1, tzinfo=UTC)
    created = await repository.create_task(
        content="Original draft",
        lock_ids=["original-lock"],
        title="Draft title",
        category="WRITING",
        priority="HIGH",
        due_date=due_date,
        word_count=2,
    )

    # Separate callers read before either writes. Copies avoid sharing the
    # mutable entity returned by the in-memory repository.
    first_read = await repository.get_task(created.id)
    second_read = await repository.get_task(created.id)
    assert first_read is not None
    assert second_read is not None
    first_writer = deepcopy(first_read)
    second_writer = deepcopy(second_read)
    assert first_writer.version == second_writer.version == 0

    first_writer.update_content("Winning draft", ["winning-lock"])
    second_writer.update_content("Stale draft", ["stale-lock"])

    saved = await repository.update_task(first_writer)
    assert saved.version == 1

    # The repository contract promises ValueError for a version mismatch.
    with pytest.raises(ValueError, match="(?i)version"):
        await repository.update_task(second_writer)

    persisted = await repository.get_task(created.id)
    assert persisted is not None
    assert persisted.content == "Winning draft"
    assert persisted.lock_ids == ["winning-lock"]
    assert persisted.version == 1
    assert persisted.title == "Draft title"
    assert persisted.category == "WRITING"
    assert persisted.priority == "HIGH"
    assert persisted.due_date == due_date
    assert persisted.word_count == 2
    assert persisted.created_at == created.created_at
    assert persisted.updated_at == first_writer.updated_at
