"""Unit tests for TaskService.

Tests business logic, validation rules, and error handling.
Uses mocked repository for fast, isolated tests.

Constitutional Compliance:
- Article III (TDD): Tests follow Red-Green-Refactor cycle
- Article IV (SOLID): Tests verify DIP (mocked repository)
- Article V (Documentation): Complete Google-style docstrings
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from server.application.services.task_service import (
    CreateTaskCommand,
    TaskDTO,
    TaskNotFoundError,
    TaskService,
    UpdateTaskCommand,
    ValidationError,
    VersionMismatchError,
)
from server.domain.entities.task import Task

if TYPE_CHECKING:
    pass


pytestmark = pytest.mark.asyncio


@pytest.fixture
def mock_repository() -> Mock:
    """Create a mock TaskRepository.

    Returns:
        Mock configured as TaskRepository with async methods.
    """
    mock = Mock(spec="server.domain.repositories.task_repository.TaskRepository")
    mock.create_task = AsyncMock()
    mock.get_task = AsyncMock()
    mock.update_task = AsyncMock()
    mock.delete_task = AsyncMock()
    mock.list_tasks = AsyncMock()
    return mock


@pytest.fixture
def task_service(mock_repository: Mock) -> TaskService:
    """Create TaskService with mocked repository.

    Args:
        mock_repository: Mocked repository fixture.

    Returns:
        TaskService instance with injected mock.
    """
    return TaskService(mock_repository)


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


class TestCreateTask:
    """Test suite for create_task method."""

    async def test_create_task_success(
        self, task_service: TaskService, mock_repository: Mock
    ) -> None:
        """Test successful task creation.

        Verifies that:
        - Repository create_task is called with correct args
        - Returns TaskDTO with correct values
        - Version starts at 0
        """
        # Arrange
        expected_task = Task.create(content="Test content", lock_ids=["lock_1"])
        mock_repository.create_task.return_value = expected_task

        command = CreateTaskCommand(content="Test content", lock_ids=["lock_1"])

        # Act
        result = await task_service.create_task(command)

        # Assert
        assert isinstance(result, TaskDTO)
        assert result.content == "Test content"
        assert result.lock_ids == ["lock_1"]
        assert result.version == 0

        mock_repository.create_task.assert_called_once_with(
            content="Test content",
            lock_ids=["lock_1"],
        )

    async def test_create_task_empty_lock_ids_defaults_to_empty_list(
        self, task_service: TaskService, mock_repository: Mock
    ) -> None:
        """Test that None lock_ids defaults to empty list."""
        # Arrange
        expected_task = Task.create(content="Test content", lock_ids=[])
        mock_repository.create_task.return_value = expected_task

        command = CreateTaskCommand(content="Test content", lock_ids=None)

        # Act
        await task_service.create_task(command)

        # Assert
        mock_repository.create_task.assert_called_once_with(
            content="Test content",
            lock_ids=[],
        )

    async def test_create_task_empty_content_raises_validation_error(
        self, task_service: TaskService, mock_repository: Mock
    ) -> None:
        """Test that empty content raises ValidationError."""
        command = CreateTaskCommand(content="", lock_ids=[])

        with pytest.raises(ValidationError) as exc_info:
            await task_service.create_task(command)

        assert exc_info.value.code == "validation_error_content"
        assert "empty" in exc_info.value.message.lower()
        mock_repository.create_task.assert_not_called()

    async def test_create_task_whitespace_only_content_raises_validation_error(
        self, task_service: TaskService, mock_repository: Mock
    ) -> None:
        """Test that whitespace-only content raises ValidationError."""
        command = CreateTaskCommand(content="   \n\t  ", lock_ids=[])

        with pytest.raises(ValidationError) as exc_info:
            await task_service.create_task(command)

        assert exc_info.value.code == "validation_error_content"
        mock_repository.create_task.assert_not_called()

    async def test_create_task_content_too_long_raises_validation_error(
        self, task_service: TaskService, mock_repository: Mock
    ) -> None:
        """Test that content exceeding max length raises ValidationError."""
        command = CreateTaskCommand(content="x" * 100001, lock_ids=[])

        with pytest.raises(ValidationError) as exc_info:
            await task_service.create_task(command)

        assert exc_info.value.code == "validation_error_content"
        assert "100000" in exc_info.value.message
        mock_repository.create_task.assert_not_called()


class TestGetTask:
    """Test suite for get_task method."""

    async def test_get_task_success(
        self, task_service: TaskService, mock_repository: Mock, sample_task: Task
    ) -> None:
        """Test successful task retrieval."""
        # Arrange
        mock_repository.get_task.return_value = sample_task

        # Act
        result = await task_service.get_task(sample_task.id)

        # Assert
        assert isinstance(result, TaskDTO)
        assert result.id == str(sample_task.id)
        assert result.content == sample_task.content
        assert result.lock_ids == sample_task.lock_ids
        assert result.version == sample_task.version

        mock_repository.get_task.assert_called_once_with(sample_task.id)

    async def test_get_task_not_found_raises_error(
        self, task_service: TaskService, mock_repository: Mock
    ) -> None:
        """Test that missing task raises TaskNotFoundError."""
        # Arrange
        task_id = uuid4()
        mock_repository.get_task.return_value = None

        # Act & Assert
        with pytest.raises(TaskNotFoundError) as exc_info:
            await task_service.get_task(task_id)

        assert exc_info.value.code == "task_not_found"
        assert str(task_id) in exc_info.value.message


class TestUpdateTask:
    """Test suite for update_task method."""

    async def test_update_task_success(
        self, task_service: TaskService, mock_repository: Mock, sample_task: Task
    ) -> None:
        """Test successful task update with optimistic locking."""
        # Arrange
        original_version = sample_task.version
        mock_repository.get_task.return_value = sample_task

        # The service calls entity.update_content() which increments version
        # Then repository.update_task() returns the updated entity
        # So we need to capture what the entity looks like after update_content
        def capture_updated_task(task):
            return task  # Return the task as-is (already updated by service)

        mock_repository.update_task.side_effect = capture_updated_task

        command = UpdateTaskCommand(
            task_id=sample_task.id,
            content="Updated content",
            lock_ids=["lock_3"],
            version=original_version,
        )

        # Act
        result = await task_service.update_task(command)

        # Assert
        assert result.content == "Updated content"
        assert result.lock_ids == ["lock_3"]
        # Version is incremented by update_content() in the entity
        assert result.version == original_version + 1

        mock_repository.get_task.assert_called_once_with(sample_task.id)
        mock_repository.update_task.assert_called_once()

    async def test_update_task_not_found_raises_error(
        self, task_service: TaskService, mock_repository: Mock
    ) -> None:
        """Test that updating non-existent task raises TaskNotFoundError."""
        # Arrange
        task_id = uuid4()
        mock_repository.get_task.return_value = None

        command = UpdateTaskCommand(
            task_id=task_id,
            content="Updated content",
            lock_ids=[],
            version=0,
        )

        # Act & Assert
        with pytest.raises(TaskNotFoundError) as exc_info:
            await task_service.update_task(command)

        assert exc_info.value.code == "task_not_found"

    async def test_update_task_version_mismatch_raises_error(
        self, task_service: TaskService, mock_repository: Mock, sample_task: Task
    ) -> None:
        """Test that version mismatch raises VersionMismatchError."""
        # Arrange
        mock_repository.get_task.return_value = sample_task

        command = UpdateTaskCommand(
            task_id=sample_task.id,
            content="Updated content",
            lock_ids=[],
            version=999,  # Wrong version
        )

        # Act & Assert
        with pytest.raises(VersionMismatchError) as exc_info:
            await task_service.update_task(command)

        assert exc_info.value.code == "version_mismatch"
        assert exc_info.value.expected == 999
        assert exc_info.value.actual == sample_task.version

    async def test_update_task_empty_content_raises_validation_error(
        self, task_service: TaskService, mock_repository: Mock
    ) -> None:
        """Test that empty content in update raises ValidationError."""
        command = UpdateTaskCommand(
            task_id=uuid4(),
            content="",
            lock_ids=[],
            version=0,
        )

        with pytest.raises(ValidationError) as exc_info:
            await task_service.update_task(command)

        assert exc_info.value.code == "validation_error_content"


class TestDeleteTask:
    """Test suite for delete_task method."""

    async def test_delete_task_success(
        self, task_service: TaskService, mock_repository: Mock, sample_task: Task
    ) -> None:
        """Test successful task deletion."""
        # Arrange
        mock_repository.get_task.return_value = sample_task
        mock_repository.delete_task.return_value = None

        # Act
        await task_service.delete_task(sample_task.id)

        # Assert
        mock_repository.get_task.assert_called_once_with(sample_task.id)
        mock_repository.delete_task.assert_called_once_with(sample_task.id)

    async def test_delete_task_not_found_raises_error(
        self, task_service: TaskService, mock_repository: Mock
    ) -> None:
        """Test that deleting non-existent task raises TaskNotFoundError."""
        # Arrange
        task_id = uuid4()
        mock_repository.get_task.return_value = None

        # Act & Assert
        with pytest.raises(TaskNotFoundError) as exc_info:
            await task_service.delete_task(task_id)

        assert exc_info.value.code == "task_not_found"
        mock_repository.delete_task.assert_not_called()


class TestListTasks:
    """Test suite for list_tasks method."""

    async def test_list_tasks_success(
        self, task_service: TaskService, mock_repository: Mock
    ) -> None:
        """Test successful task listing with pagination."""
        # Arrange
        tasks = [Task.create(content=f"Task {i}", lock_ids=[]) for i in range(3)]
        mock_repository.list_tasks.side_effect = [
            tasks,  # First call for paginated results
            tasks,  # Second call for total count
        ]

        # Act
        result, total = await task_service.list_tasks(limit=10, offset=0)

        # Assert
        assert len(result) == 3
        assert total == 3
        assert all(isinstance(dto, TaskDTO) for dto in result)

    async def test_list_tasks_invalid_limit_raises_validation_error(
        self, task_service: TaskService, mock_repository: Mock
    ) -> None:
        """Test that invalid limit raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            await task_service.list_tasks(limit=0, offset=0)

        assert exc_info.value.code == "validation_error_limit"

    async def test_list_tasks_limit_too_high_raises_validation_error(
        self, task_service: TaskService, mock_repository: Mock
    ) -> None:
        """Test that limit > 100 raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            await task_service.list_tasks(limit=101, offset=0)

        assert exc_info.value.code == "validation_error_limit"

    async def test_list_tasks_negative_offset_raises_validation_error(
        self, task_service: TaskService, mock_repository: Mock
    ) -> None:
        """Test that negative offset raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            await task_service.list_tasks(limit=10, offset=-1)

        assert exc_info.value.code == "validation_error_offset"


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
