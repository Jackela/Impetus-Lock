"""API Contract Tests for Tasks Endpoint.

Tests CRUD operations for tasks endpoint (POST, GET, PUT, DELETE).
Validates request/response contract, pagination, and error handling.

Constitutional Compliance:
- Article III (TDD): Tests written for existing API endpoints
- Article V (Documentation): Google-style docstrings for all test functions
"""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from server.api.main import app
from server.api.routes import tasks as tasks_module
from server.infrastructure.persistence.in_memory_task_repository import (
    InMemoryTaskRepository,
)

client = TestClient(app)


@pytest.fixture(autouse=True)
def use_in_memory_repository() -> Generator[None, None, None]:
    """Use in-memory repository for tests (no database required).

    Auto-used for all tests in this module.
    """
    repo = InMemoryTaskRepository()

    async def override_repo() -> InMemoryTaskRepository:
        return repo

    app.dependency_overrides[tasks_module.get_task_repository] = override_repo
    app.dependency_overrides[tasks_module.get_session_optional] = lambda: None

    yield

    app.dependency_overrides.pop(tasks_module.get_task_repository, None)
    app.dependency_overrides.pop(tasks_module.get_session_optional, None)


class TestCreateTask:
    """Test suite for POST /tasks/ endpoint."""

    def test_create_task_returns_201(self) -> None:
        """Test that creating a task returns 201 Created.

        Response should include task ID, content, timestamps, and version.
        """
        response = client.post(
            "/tasks/",
            json={"content": "New task content", "lock_ids": []},
        )

        assert response.status_code == 201
        data = response.json()

        assert "id" in data
        assert data["content"] == "New task content"
        assert data["lock_ids"] == []
        assert data["version"] == 0
        assert "created_at" in data
        assert "updated_at" in data

    def test_create_task_with_lock_ids(self) -> None:
        """Test that creating a task with lock IDs persists them."""
        response = client.post(
            "/tasks/",
            json={
                "content": "Task with locks",
                "lock_ids": ["lock_1", "lock_2"],
            },
        )

        assert response.status_code == 201
        data = response.json()

        assert data["lock_ids"] == ["lock_1", "lock_2"]

    def test_create_task_empty_content_returns_422(self) -> None:
        """Test that empty content returns 422 Unprocessable Entity."""
        response = client.post(
            "/tasks/",
            json={"content": "", "lock_ids": []},
        )

        assert response.status_code == 422

    def test_create_task_missing_content_returns_422(self) -> None:
        """Test that missing content field returns 422."""
        response = client.post(
            "/tasks/",
            json={"lock_ids": []},
        )

        assert response.status_code == 422

    def test_create_task_default_lock_ids_empty(self) -> None:
        """Test that lock_ids defaults to empty list when not provided."""
        response = client.post(
            "/tasks/",
            json={"content": "Task without lock_ids field"},
        )

        assert response.status_code == 201
        data = response.json()

        assert data["lock_ids"] == []


class TestListTasks:
    """Test suite for GET /tasks/ endpoint."""

    def test_list_tasks_returns_200(self) -> None:
        """Test that listing tasks returns 200 OK with pagination metadata."""
        response = client.get("/tasks/")

        assert response.status_code == 200
        data = response.json()

        assert "total" in data
        assert "limit" in data
        assert "offset" in data
        assert "tasks" in data
        assert isinstance(data["tasks"], list)

    def test_list_tasks_with_pagination(self) -> None:
        """Test that pagination params (limit, offset) work correctly."""
        # Create 5 tasks
        for i in range(5):
            client.post(
                "/tasks/",
                json={"content": f"Task {i}", "lock_ids": []},
            )

        # Get first 2 tasks
        response = client.get("/tasks/?limit=2&offset=0")

        assert response.status_code == 200
        data = response.json()

        assert data["total"] >= 5
        assert data["limit"] == 2
        assert data["offset"] == 0
        assert len(data["tasks"]) == 2

    def test_list_tasks_empty_returns_empty_list(self) -> None:
        """Test that listing tasks when none exist returns empty list."""
        response = client.get("/tasks/")

        assert response.status_code == 200
        data = response.json()

        assert data["total"] == 0
        assert data["tasks"] == []


class TestGetTask:
    """Test suite for GET /tasks/{task_id} endpoint."""

    def test_get_task_returns_200(self) -> None:
        """Test that getting a task by ID returns 200 OK."""
        # Create a task first
        create_response = client.post(
            "/tasks/",
            json={"content": "Task to retrieve", "lock_ids": []},
        )
        task_id = create_response.json()["id"]

        # Get the task
        response = client.get(f"/tasks/{task_id}")

        assert response.status_code == 200
        data = response.json()

        assert data["id"] == task_id
        assert data["content"] == "Task to retrieve"

    def test_get_task_not_found_returns_404(self) -> None:
        """Test that getting non-existent task returns 404."""
        response = client.get("/tasks/00000000-0000-0000-0000-000000000000")

        assert response.status_code == 404

    def test_get_task_invalid_uuid_returns_422(self) -> None:
        """Test that invalid UUID returns 422."""
        response = client.get("/tasks/invalid-uuid")

        assert response.status_code == 422


class TestUpdateTask:
    """Test suite for PUT /tasks/{task_id} endpoint."""

    def test_update_task_returns_200(self) -> None:
        """Test that updating a task returns 200 OK."""
        # Create a task first
        create_response = client.post(
            "/tasks/",
            json={"content": "Original content", "lock_ids": []},
        )
        task_id = create_response.json()["id"]
        version = create_response.json()["version"]

        # Update the task
        response = client.put(
            f"/tasks/{task_id}",
            json={
                "content": "Updated content",
                "lock_ids": ["lock_1"],
                "version": version,
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert data["id"] == task_id
        assert data["content"] == "Updated content"
        assert data["lock_ids"] == ["lock_1"]
        assert data["version"] == version + 1

    def test_update_task_not_found_returns_404(self) -> None:
        """Test that updating non-existent task returns 404."""
        response = client.put(
            "/tasks/00000000-0000-0000-0000-000000000000",
            json={
                "content": "Updated",
                "lock_ids": [],
                "version": 0,
            },
        )

        assert response.status_code == 404

    def test_update_task_version_mismatch_returns_409(self) -> None:
        """Test that optimistic locking returns 409 on version mismatch."""
        # Create a task
        create_response = client.post(
            "/tasks/",
            json={"content": "Original", "lock_ids": []},
        )
        task_id = create_response.json()["id"]

        # Try to update with wrong version
        response = client.put(
            f"/tasks/{task_id}",
            json={
                "content": "Updated",
                "lock_ids": [],
                "version": 999,  # Wrong version
            },
        )

        assert response.status_code == 409


class TestDeleteTask:
    """Test suite for DELETE /tasks/{task_id} endpoint."""

    def test_delete_task_returns_204(self) -> None:
        """Test that deleting a task returns 204 No Content."""
        # Create a task first
        create_response = client.post(
            "/tasks/",
            json={"content": "Task to delete", "lock_ids": []},
        )
        task_id = create_response.json()["id"]

        # Delete the task
        response = client.delete(f"/tasks/{task_id}")

        assert response.status_code == 204
        assert response.content == b""

        # Verify task is gone
        get_response = client.get(f"/tasks/{task_id}")
        assert get_response.status_code == 404

    def test_delete_task_not_found_returns_404(self) -> None:
        """Test that deleting non-existent task returns 404."""
        response = client.delete("/tasks/00000000-0000-0000-0000-000000000000")

        assert response.status_code == 404

    def test_delete_task_invalid_uuid_returns_422(self) -> None:
        """Test that invalid UUID returns 422."""
        response = client.delete("/tasks/invalid-uuid")

        assert response.status_code == 422


class TestGetInterventionHistory:
    """Test suite for GET /tasks/{task_id}/actions endpoint."""

    def test_get_actions_returns_200(self) -> None:
        """Test that getting intervention history returns 200 OK."""
        # Create a task first
        create_response = client.post(
            "/tasks/",
            json={"content": "Task with actions", "lock_ids": []},
        )
        task_id = create_response.json()["id"]

        # Get actions (empty list)
        response = client.get(f"/tasks/{task_id}/actions")

        assert response.status_code == 200
        data = response.json()

        assert "total" in data
        assert "limit" in data
        assert "offset" in data
        assert "actions" in data
        assert data["total"] == 0
        assert data["actions"] == []

    def test_get_actions_not_found_returns_404(self) -> None:
        """Test that getting actions for non-existent task returns 404."""
        response = client.get("/tasks/00000000-0000-0000-0000-000000000000/actions")

        assert response.status_code == 404
