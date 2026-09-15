"""Unit tests for the user-scoped TaskService route-facing methods.

Written BEFORE extraction (openspec/changes/refactor-route-service-boundaries
task 1.3) and kept as the service regression suite afterwards. They pin the
route-compatible behavior: ownership before access or history reads, optimistic
version checks, no content validation stricter than the HTTP schema, single
commit per write, and persistence failures never returned as success.
"""

from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from server.application.services.task_service import (
    TaskNotFoundError,
    TaskService,
    VersionMismatchError,
)
from server.domain.entities.task import Task
from server.domain.transactions import TransactionSupport

pytestmark = pytest.mark.asyncio


class RecordingTransaction(TransactionSupport):
    """Transaction support double that counts commits and can fail on demand."""

    def __init__(self) -> None:
        self.commits = 0
        self.fail = False

    async def commit(self) -> None:
        """Record the commit, optionally raising to simulate a broken database."""
        if self.fail:
            raise RuntimeError("commit failed")
        self.commits += 1


@pytest.fixture
def repository() -> Mock:
    """Mock TaskRepository with async methods."""
    mock = Mock(spec="server.domain.repositories.task_repository.TaskRepository")
    mock.create_task = AsyncMock()
    mock.get_task_by_user = AsyncMock()
    mock.update_task = AsyncMock()
    mock.delete_task = AsyncMock()
    mock.list_tasks_by_user = AsyncMock()
    mock.count_tasks_by_user = AsyncMock()
    mock.get_actions = AsyncMock()
    mock.get_action_count = AsyncMock()
    return mock


@pytest.fixture
def transaction() -> RecordingTransaction:
    """Recording transaction support."""
    return RecordingTransaction()


@pytest.fixture
def service(repository: Mock, transaction: RecordingTransaction) -> TaskService:
    """TaskService wired to the mock repository and recording transaction."""
    return TaskService(repository, transaction=transaction)


@pytest.fixture
def user_id() -> Any:
    """Synthetic owner user id."""
    return uuid4()


def _owned_task(user_id: Any) -> Task:
    """Real task entity owned by the given user at version 0."""
    return Task.create(content="original", lock_ids=[], user_id=user_id)


class TestCreateTaskForUser:
    """create_task_for_user writes with the authenticated user and commits once."""

    async def test_delegates_fields_and_commits_once(
        self,
        service: TaskService,
        repository: Mock,
        transaction: RecordingTransaction,
        user_id: Any,
    ) -> None:
        """All request fields flow to the repository; exactly one commit follows."""
        created = _owned_task(user_id)
        repository.create_task.return_value = created
        due = datetime(2026, 1, 31, tzinfo=UTC)

        result = await service.create_task_for_user(
            user_id,
            "content",
            ["lock_1"],
            title="T",
            category="FICTION",
            priority="HIGH",
            due_date=due,
            word_count=42,
        )

        assert result is created
        repository.create_task.assert_awaited_once_with(
            content="content",
            lock_ids=["lock_1"],
            user_id=user_id,
            title="T",
            category="FICTION",
            priority="HIGH",
            due_date=due,
            word_count=42,
        )
        assert transaction.commits == 1

    async def test_accepts_whitespace_content(
        self, service: TaskService, repository: Mock, user_id: Any
    ) -> None:
        """Route-compatible validation: whitespace-only content is accepted."""
        created = Task.create(content="   ", lock_ids=[], user_id=user_id)
        repository.create_task.return_value = created

        result = await service.create_task_for_user(user_id, "   ", [])

        assert result.content == "   "
        repository.create_task.assert_awaited_once_with(
            content="   ",
            lock_ids=[],
            user_id=user_id,
            title="",
            category="WRITING",
            priority="MEDIUM",
            due_date=None,
            word_count=0,
        )


class TestListTasksForUser:
    """list_tasks_for_user is scoped to the requesting user."""

    async def test_returns_page_and_user_total(
        self, service: TaskService, repository: Mock, user_id: Any
    ) -> None:
        """The page comes from list_tasks_by_user, the total from the user count."""
        tasks = [_owned_task(user_id)]
        repository.list_tasks_by_user.return_value = tasks
        repository.count_tasks_by_user.return_value = 3

        result, total = await service.list_tasks_for_user(user_id, limit=2, offset=1)

        assert result == tasks
        assert total == 3
        repository.list_tasks_by_user.assert_awaited_once_with(user_id=user_id, limit=2, offset=1)
        repository.count_tasks_by_user.assert_awaited_once_with(user_id=user_id)


class TestGetTaskForUser:
    """get_task_for_user enforces ownership before returning data."""

    async def test_returns_owned_task(
        self, service: TaskService, repository: Mock, user_id: Any
    ) -> None:
        """Owned tasks are returned."""
        task = _owned_task(user_id)
        repository.get_task_by_user.return_value = task

        assert await service.get_task_for_user(user_id, task.id) is task

    async def test_missing_or_foreign_task_raises(
        self, service: TaskService, repository: Mock, user_id: Any
    ) -> None:
        """Missing or foreign tasks raise TaskNotFoundError with the route detail."""
        repository.get_task_by_user.return_value = None
        task_id = uuid4()

        with pytest.raises(TaskNotFoundError) as excinfo:
            await service.get_task_for_user(user_id, task_id)

        assert str(excinfo.value) == f"Task {task_id} not found"


class TestUpdateTaskForUser:
    """update_task_for_user checks ownership and version before mutating."""

    async def test_updates_and_commits_once(
        self,
        service: TaskService,
        repository: Mock,
        transaction: RecordingTransaction,
        user_id: Any,
    ) -> None:
        """A matching version updates fields, persists and commits once."""
        task = _owned_task(user_id)
        repository.get_task_by_user.return_value = task
        repository.update_task.return_value = task
        due = datetime(2026, 2, 1, tzinfo=UTC)

        result = await service.update_task_for_user(
            user_id,
            task.id,
            content="updated",
            lock_ids=["lock_9"],
            version=0,
            title="T2",
            category="POETRY",
            priority="LOW",
            due_date=due,
            word_count=7,
        )

        assert result is task
        assert task.content == "updated"
        assert task.lock_ids == ["lock_9"]
        assert task.title == "T2"
        assert task.category == "POETRY"
        assert task.priority == "LOW"
        assert task.due_date == due
        assert task.word_count == 7
        assert task.version == 1
        repository.update_task.assert_awaited_once_with(task)
        assert transaction.commits == 1

    async def test_version_mismatch_raises_without_mutation(
        self,
        service: TaskService,
        repository: Mock,
        transaction: RecordingTransaction,
        user_id: Any,
    ) -> None:
        """Version mismatch raises the typed error and mutates nothing."""
        task = _owned_task(user_id)
        repository.get_task_by_user.return_value = task

        with pytest.raises(VersionMismatchError) as excinfo:
            await service.update_task_for_user(
                user_id, task.id, content="x", lock_ids=[], version=999
            )

        assert str(excinfo.value) == "Version mismatch: expected 999, got 0"
        repository.update_task.assert_not_awaited()
        assert transaction.commits == 0
        assert task.content == "original"
        assert task.version == 0

    async def test_missing_or_foreign_task_raises_before_mutation(
        self, service: TaskService, repository: Mock, user_id: Any
    ) -> None:
        """Missing or foreign tasks raise and never reach the repository write."""
        repository.get_task_by_user.return_value = None

        with pytest.raises(TaskNotFoundError):
            await service.update_task_for_user(
                user_id, uuid4(), content="x", lock_ids=[], version=0
            )

        repository.update_task.assert_not_awaited()

    async def test_repository_value_error_propagates_without_commit(
        self,
        service: TaskService,
        repository: Mock,
        transaction: RecordingTransaction,
        user_id: Any,
    ) -> None:
        """A repository write failure surfaces and nothing is committed."""
        task = _owned_task(user_id)
        repository.get_task_by_user.return_value = task
        repository.update_task.side_effect = ValueError("boom")

        with pytest.raises(ValueError, match="boom"):
            await service.update_task_for_user(
                user_id, task.id, content="x", lock_ids=[], version=0
            )

        assert transaction.commits == 0


class TestDeleteTaskForUser:
    """delete_task_for_user verifies ownership before deleting."""

    async def test_deletes_and_commits_once(
        self,
        service: TaskService,
        repository: Mock,
        transaction: RecordingTransaction,
        user_id: Any,
    ) -> None:
        """Owned tasks are deleted and committed exactly once."""
        task = _owned_task(user_id)
        repository.get_task_by_user.return_value = task

        await service.delete_task_for_user(user_id, task.id)

        repository.delete_task.assert_awaited_once_with(task.id)
        assert transaction.commits == 1

    async def test_missing_or_foreign_task_raises(
        self, service: TaskService, repository: Mock, user_id: Any
    ) -> None:
        """Missing or foreign deletions raise and never delete."""
        repository.get_task_by_user.return_value = None
        task_id = uuid4()

        with pytest.raises(TaskNotFoundError):
            await service.delete_task_for_user(user_id, task_id)

        repository.delete_task.assert_not_awaited()

    async def test_repository_value_error_maps_to_not_found_semantics(
        self, service: TaskService, repository: Mock, user_id: Any
    ) -> None:
        """A racy repository delete failure propagates (route maps it to 404)."""
        task = _owned_task(user_id)
        repository.get_task_by_user.return_value = task
        repository.delete_task.side_effect = ValueError(f"Task {task.id} not found")

        with pytest.raises(ValueError, match="not found"):
            await service.delete_task_for_user(user_id, task.id)


class TestInterventionHistoryForUser:
    """get_intervention_history_for_user checks ownership before history reads."""

    async def test_returns_actions_and_total(
        self, service: TaskService, repository: Mock, user_id: Any
    ) -> None:
        """Owned tasks return the action page and total."""
        task = _owned_task(user_id)
        repository.get_task_by_user.return_value = task
        repository.get_actions.return_value = []
        repository.get_action_count.return_value = 0

        actions, total = await service.get_intervention_history_for_user(
            user_id, task.id, limit=10, offset=5
        )

        assert actions == []
        assert total == 0
        repository.get_actions.assert_awaited_once_with(task.id, limit=10, offset=5)
        repository.get_action_count.assert_awaited_once_with(task.id)

    async def test_foreign_task_never_reads_history(
        self, service: TaskService, repository: Mock, user_id: Any
    ) -> None:
        """History is not read for a task the user does not own."""
        repository.get_task_by_user.return_value = None

        with pytest.raises(TaskNotFoundError):
            await service.get_intervention_history_for_user(user_id, uuid4())

        repository.get_actions.assert_not_awaited()
        repository.get_action_count.assert_not_awaited()
