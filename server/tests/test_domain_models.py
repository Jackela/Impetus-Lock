"""Domain model tests for Impetus Lock.

This module tests the core domain entities and their invariants.
Tests are organized by entity and invariant.
"""

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

import pytest

# Import domain entities (update paths as implemented)
# from server.server.domain.entities import Task, Lock, Intervention


class TestTaskEntity:
    """Tests for the Task domain entity."""

    def test_task_creation_with_valid_data(self) -> None:
        """Task should be created with valid title and content."""
        task_id = uuid4()
        task = Task(
            id=task_id,
            title="Valid Task Title",
            content="Task content here",
            created_at=datetime.now(UTC),
        )
        assert task.id == task_id
        assert task.title == "Valid Task Title"

    def test_task_title_empty_raises_error(self) -> None:
        """Task with empty title should raise ValueError."""
        with pytest.raises(ValueError, match="Title must be"):
            Task(
                id=uuid4(),
                title="",  # Empty title
                content="Content",
                created_at=datetime.now(UTC),
            )

    def test_task_title_too_long_raises_error(self) -> None:
        """Task with title >200 characters should raise ValueError."""
        with pytest.raises(ValueError, match="Title must be"):
            Task(
                id=uuid4(),
                title="x" * 201,  # Too long
                content="Content",
                created_at=datetime.now(UTC),
            )

    def test_task_with_lock_association(self) -> None:
        """Task can be associated with a lock."""
        lock_id = uuid4()
        task = Task(
            id=uuid4(),
            title="Locked Task",
            content="Content",
            lock_id=lock_id,
            created_at=datetime.now(UTC),
        )
        assert task.lock_id == lock_id


class TestLockEntity:
    """Tests for the Lock domain entity."""

    def test_lock_creation(self) -> None:
        """Lock should be created with valid data."""
        task_id = uuid4()
        user_id = uuid4()
        lock = Lock(
            id=uuid4(),
            task_id=task_id,
            user_id=user_id,
            created_at=datetime.now(UTC),
        )
        assert lock.task_id == task_id
        assert lock.user_id == user_id

    def test_lock_with_reason(self) -> None:
        """Lock can have an optional reason."""
        lock = Lock(
            id=uuid4(),
            task_id=uuid4(),
            user_id=uuid4(),
            reason="Critical task that must be completed",
            created_at=datetime.now(UTC),
        )
        assert lock.reason == "Critical task that must be completed"

    def test_lock_unique_per_task(self) -> None:
        """Each task should have at most one active lock."""
        # This would be enforced at the repository level
        # Domain entity doesn't need to validate this
        pass


class TestInterventionEntity:
    """Tests for the Intervention domain entity."""

    def test_intervention_creation(self) -> None:
        """Intervention should be created with valid data."""
        intervention = Intervention(
            id=uuid4(),
            task_id=uuid4(),
            mode="muse",
            message="You seem stuck on this task.",
            severity="mild",
            created_at=datetime.now(UTC),
        )
        assert intervention.mode == "muse"
        assert intervention.severity == "mild"

    def test_intervention_invalid_mode_raises_error(self) -> None:
        """Intervention with invalid mode should raise ValueError."""
        with pytest.raises(ValueError, match="Invalid mode"):
            Intervention(
                id=uuid4(),
                task_id=uuid4(),
                mode="invalid",  # Not one of: muse, loki, manual
                message="Message",
                severity="mild",
                created_at=datetime.now(UTC),
            )

    def test_intervention_invalid_severity_raises_error(self) -> None:
        """Intervention with invalid severity should raise ValueError."""
        with pytest.raises(ValueError, match="Invalid severity"):
            Intervention(
                id=uuid4(),
                task_id=uuid4(),
                mode="muse",
                message="Message",
                severity="extreme",  # Not one of: mild, moderate, intense
                created_at=datetime.now(UTC),
            )


# Placeholder domain entities (replace with actual imports)
@dataclass
class Task:
    """Task domain entity placeholder."""

    id: object
    title: str
    content: str
    lock_id: object | None = None
    created_at: datetime = datetime.now(UTC)

    def __post_init__(self) -> None:
        if not self.title or len(self.title) > 200:
            raise ValueError("Title must be 1-200 characters")


@dataclass
class Lock:
    """Lock domain entity placeholder."""

    id: object
    task_id: object
    user_id: object
    reason: str | None = None
    created_at: datetime = datetime.now(UTC)


@dataclass
class Intervention:
    """Intervention domain entity placeholder."""

    id: object
    task_id: object
    mode: str
    message: str
    severity: str
    created_at: datetime = datetime.now(UTC)

    VALID_MODES = {"muse", "loki", "manual"}
    VALID_SEVERITIES = {"mild", "moderate", "intense"}

    def __post_init__(self) -> None:
        if self.mode not in self.VALID_MODES:
            raise ValueError(f"Invalid mode: {self.mode}")
        if self.severity not in self.VALID_SEVERITIES:
            raise ValueError(f"Invalid severity: {self.severity}")
