"""Characterization tests pinning the current /tasks API contract.

Frozen safety net for the route-to-service extraction described in
openspec/changes/refactor-route-service-boundaries. These tests pin the CURRENT
external contract byte-for-byte: paths, methods, response fields, optimistic
version semantics, pagination shape, status codes, error details, two-user
isolation, and the no-session in-memory repository fallback. They must pass
UNCHANGED before and after the refactor.
"""

import asyncio
from collections.abc import AsyncGenerator
from typing import Any
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient

from server.api.dependencies import get_task_repository
from server.api.main import app
from server.auth.dependencies import get_current_user
from server.infrastructure.persistence.database import get_session_optional
from server.infrastructure.persistence.in_memory_task_repository import (
    InMemoryTaskRepository,
)
from server.models.user import User

TASK_ITEM_KEYS = {
    "id",
    "content",
    "lock_ids",
    "created_at",
    "updated_at",
    "version",
    "title",
    "category",
    "priority",
    "due_date",
    "word_count",
}

LIST_KEYS = {"total", "limit", "offset", "tasks"}

ACTIONS_KEYS = {"total", "limit", "offset", "actions"}


def _make_user(email: str) -> User:
    """Create a synthetic authenticated user (auth dependency is overridden)."""
    return User(id=uuid4(), email=email, password_hash="mock_hash")


@pytest.fixture
def user_a() -> User:
    """First synthetic user (task owner in isolation tests)."""
    return _make_user("char-a@example.com")


@pytest.fixture
def user_b() -> User:
    """Second synthetic user (foreign user in isolation tests)."""
    return _make_user("char-b@example.com")


@pytest.fixture
def current_user(user_a: User) -> AsyncGenerator[dict[str, User], None]:
    """Override auth with a mutable holder so tests can switch users."""
    holder = {"user": user_a}
    app.dependency_overrides[get_current_user] = lambda: holder["user"]
    yield holder
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def in_memory_backend() -> AsyncGenerator[InMemoryTaskRepository, None]:
    """Route the app to a fresh in-memory repository with no DB session."""
    repository = InMemoryTaskRepository()

    async def override_repository() -> InMemoryTaskRepository:
        return repository

    app.dependency_overrides[get_task_repository] = override_repository
    app.dependency_overrides[get_session_optional] = lambda: None

    yield repository

    app.dependency_overrides.pop(get_task_repository, None)
    app.dependency_overrides.pop(get_session_optional, None)


async def _create_task(
    client: AsyncClient, content: str = "content", **fields: Any
) -> dict[str, Any]:
    """Create a task through the API and return the response body."""
    response = await client.post("/tasks/", json={"content": content, "lock_ids": [], **fields})
    assert response.status_code == 201, response.text
    return response.json()


class TestTaskCreateContract:
    """Pins POST /tasks/ request/response contract."""

    async def test_create_returns_201_with_default_fields(
        self, async_client: AsyncClient, current_user: dict[str, User], in_memory_backend: None
    ) -> None:
        """Creation returns 201 with the exact current field set and version 0."""
        data = await _create_task(async_client, "My task")

        assert set(data.keys()) == TASK_ITEM_KEYS
        assert data["content"] == "My task"
        assert data["lock_ids"] == []
        assert data["version"] == 0
        assert data["title"] == ""
        assert data["category"] == "WRITING"
        assert data["priority"] == "MEDIUM"
        assert data["due_date"] is None
        assert data["word_count"] == 0

    async def test_create_accepts_whitespace_only_content(
        self, async_client: AsyncClient, current_user: dict[str, User], in_memory_backend: None
    ) -> None:
        """Whitespace-only content is ACCEPTED (no stricter empty-content rule)."""
        data = await _create_task(async_client, "   ")

        assert data["content"] == "   "

    async def test_create_content_length_boundaries(
        self, async_client: AsyncClient, current_user: dict[str, User], in_memory_backend: None
    ) -> None:
        """Content of exactly 100000 chars is accepted; 100001 chars is rejected 422."""
        ok = await async_client.post("/tasks/", json={"content": "a" * 100000, "lock_ids": []})
        assert ok.status_code == 201

        too_long = await async_client.post(
            "/tasks/", json={"content": "a" * 100001, "lock_ids": []}
        )
        assert too_long.status_code == 422

    async def test_create_missing_or_empty_content_returns_422(
        self, async_client: AsyncClient, current_user: dict[str, User], in_memory_backend: None
    ) -> None:
        """Missing content field and empty string content both return 422."""
        missing = await async_client.post("/tasks/", json={"lock_ids": []})
        assert missing.status_code == 422

        empty = await async_client.post("/tasks/", json={"content": "", "lock_ids": []})
        assert empty.status_code == 422

    async def test_create_with_metadata_fields(
        self, async_client: AsyncClient, current_user: dict[str, User], in_memory_backend: None
    ) -> None:
        """All metadata fields are echoed back on creation."""
        data = await _create_task(
            async_client,
            "With metadata",
            title="Novel Draft",
            category="FICTION",
            priority="HIGH",
            due_date="2025-12-31T23:59:59+00:00",
            word_count=1200,
        )

        assert data["title"] == "Novel Draft"
        assert data["category"] == "FICTION"
        assert data["priority"] == "HIGH"
        assert data["due_date"] == "2025-12-31T23:59:59+00:00"
        assert data["word_count"] == 1200


class TestTaskListContract:
    """Pins GET /tasks/ pagination shape, ordering and scoping."""

    async def test_list_response_shape(
        self, async_client: AsyncClient, current_user: dict[str, User], in_memory_backend: None
    ) -> None:
        """List response has exactly {total, limit, offset, tasks} with defaults echoed."""
        response = await async_client.get("/tasks/")

        assert response.status_code == 200
        data = response.json()
        assert set(data.keys()) == LIST_KEYS
        assert data == {"total": 0, "limit": 100, "offset": 0, "tasks": []}

    async def test_list_scoped_to_user_and_reverse_chronological(
        self, async_client: AsyncClient, current_user: dict[str, User], in_memory_backend: None
    ) -> None:
        """List only shows the current user's tasks, newest first."""
        first = await _create_task(async_client, "first")
        await asyncio.sleep(0.01)
        second = await _create_task(async_client, "second")
        await asyncio.sleep(0.01)
        third = await _create_task(async_client, "third")

        data = (await async_client.get("/tasks/")).json()

        assert data["total"] == 3
        assert [t["id"] for t in data["tasks"]] == [third["id"], second["id"], first["id"]]

    async def test_list_pagination_slice(
        self, async_client: AsyncClient, current_user: dict[str, User], in_memory_backend: None
    ) -> None:
        """limit/offset slice the newest-first list while total stays global."""
        oldest = await _create_task(async_client, "oldest")
        await asyncio.sleep(0.01)
        middle = await _create_task(async_client, "middle")
        await asyncio.sleep(0.01)
        newest = await _create_task(async_client, "newest")

        data = (await async_client.get("/tasks/?limit=1&offset=1")).json()

        assert data["total"] == 3
        assert data["limit"] == 1
        assert data["offset"] == 1
        assert [t["id"] for t in data["tasks"]] == [middle["id"]]
        assert newest["id"] != oldest["id"]

    @pytest.mark.parametrize(
        "query",
        ["?limit=0", "?limit=101", "?limit=-1", "?offset=-1", "?limit=abc"],
    )
    async def test_list_pagination_bounds_return_422(
        self,
        async_client: AsyncClient,
        current_user: dict[str, User],
        in_memory_backend: None,
        query: str,
    ) -> None:
        """Out-of-bounds pagination params are rejected with 422."""
        response = await async_client.get(f"/tasks/{query}")

        assert response.status_code == 422


class TestTaskGetContract:
    """Pins GET /tasks/{task_id}."""

    async def test_get_returns_created_task(
        self, async_client: AsyncClient, current_user: dict[str, User], in_memory_backend: None
    ) -> None:
        """GET returns the same field set and values as creation."""
        created = await _create_task(async_client, "retrieve me")

        response = await async_client.get(f"/tasks/{created['id']}")

        assert response.status_code == 200
        assert response.json() == created

    async def test_get_missing_task_returns_404_with_exact_detail(
        self, async_client: AsyncClient, current_user: dict[str, User], in_memory_backend: None
    ) -> None:
        """Missing task returns 404 with detail 'Task {id} not found'."""
        missing_id = "00000000-0000-0000-0000-000000000000"

        response = await async_client.get(f"/tasks/{missing_id}")

        assert response.status_code == 404
        assert response.json() == {"detail": f"Task {missing_id} not found"}

    async def test_get_invalid_uuid_returns_422(
        self, async_client: AsyncClient, current_user: dict[str, User], in_memory_backend: None
    ) -> None:
        """Malformed UUID path parameter returns 422."""
        response = await async_client.get("/tasks/not-a-uuid")

        assert response.status_code == 422


class TestTaskUpdateContract:
    """Pins PUT /tasks/{task_id} optimistic version semantics."""

    async def test_update_returns_200_and_increments_version(
        self, async_client: AsyncClient, current_user: dict[str, User], in_memory_backend: None
    ) -> None:
        """Matching-version update returns 200 with version+1 and new values."""
        created = await _create_task(async_client, "original")

        response = await async_client.put(
            f"/tasks/{created['id']}",
            json={
                "content": "updated",
                "lock_ids": ["lock_1"],
                "version": created["version"],
                "title": "New title",
                "category": "POETRY",
                "priority": "LOW",
                "due_date": "2026-01-31T23:59:59+00:00",
                "word_count": 42,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["version"] == created["version"] + 1
        assert data["content"] == "updated"
        assert data["lock_ids"] == ["lock_1"]
        assert data["title"] == "New title"
        assert data["category"] == "POETRY"
        assert data["priority"] == "LOW"
        assert data["due_date"] == "2026-01-31T23:59:59+00:00"
        assert data["word_count"] == 42

    async def test_update_version_mismatch_returns_409_with_exact_detail_and_no_mutation(
        self, async_client: AsyncClient, current_user: dict[str, User], in_memory_backend: None
    ) -> None:
        """Version mismatch returns 409 with the exact detail and does not mutate."""
        created = await _create_task(async_client, "original")

        response = await async_client.put(
            f"/tasks/{created['id']}",
            json={"content": "hijack", "lock_ids": [], "version": 999},
        )

        assert response.status_code == 409
        assert response.json() == {"detail": "Version mismatch: expected 999, got 0"}

        unchanged = await async_client.get(f"/tasks/{created['id']}")
        assert unchanged.status_code == 200
        assert unchanged.json()["content"] == "original"
        assert unchanged.json()["version"] == 0

    async def test_update_missing_task_returns_404(
        self, async_client: AsyncClient, current_user: dict[str, User], in_memory_backend: None
    ) -> None:
        """Updating a non-existent task returns 404."""
        response = await async_client.put(
            "/tasks/00000000-0000-0000-0000-000000000000",
            json={"content": "x", "lock_ids": [], "version": 0},
        )

        assert response.status_code == 404

    async def test_update_missing_version_returns_422(
        self, async_client: AsyncClient, current_user: dict[str, User], in_memory_backend: None
    ) -> None:
        """Omitting the version field returns 422."""
        created = await _create_task(async_client, "original")

        response = await async_client.put(
            f"/tasks/{created['id']}", json={"content": "x", "lock_ids": []}
        )

        assert response.status_code == 422


class TestTaskDeleteContract:
    """Pins DELETE /tasks/{task_id}."""

    async def test_delete_returns_204_empty_body_then_404(
        self, async_client: AsyncClient, current_user: dict[str, User], in_memory_backend: None
    ) -> None:
        """Delete returns 204 with empty body; the task is gone afterwards."""
        created = await _create_task(async_client, "doomed")

        response = await async_client.delete(f"/tasks/{created['id']}")

        assert response.status_code == 204
        assert response.content == b""

        assert (await async_client.get(f"/tasks/{created['id']}")).status_code == 404

    async def test_delete_missing_task_returns_404(
        self, async_client: AsyncClient, current_user: dict[str, User], in_memory_backend: None
    ) -> None:
        """Deleting a non-existent task returns 404."""
        response = await async_client.delete("/tasks/00000000-0000-0000-0000-000000000000")

        assert response.status_code == 404


class TestInterventionHistoryContract:
    """Pins GET /tasks/{task_id}/actions."""

    async def test_actions_response_shape(
        self, async_client: AsyncClient, current_user: dict[str, User], in_memory_backend: None
    ) -> None:
        """History response has exactly {total, limit, offset, actions}."""
        created = await _create_task(async_client, "with history")

        response = await async_client.get(f"/tasks/{created['id']}/actions")

        assert response.status_code == 200
        data = response.json()
        assert set(data.keys()) == ACTIONS_KEYS
        assert data == {"total": 0, "limit": 100, "offset": 0, "actions": []}

    async def test_actions_missing_task_returns_404(
        self, async_client: AsyncClient, current_user: dict[str, User], in_memory_backend: None
    ) -> None:
        """History for a non-existent task returns 404."""
        response = await async_client.get("/tasks/00000000-0000-0000-0000-000000000000/actions")

        assert response.status_code == 404

    @pytest.mark.parametrize("query", ["?limit=0", "?limit=101", "?offset=-1"])
    async def test_actions_pagination_bounds_return_422(
        self,
        async_client: AsyncClient,
        current_user: dict[str, User],
        in_memory_backend: None,
        query: str,
    ) -> None:
        """Out-of-bounds history pagination params are rejected with 422."""
        created = await _create_task(async_client, "with history")

        response = await async_client.get(f"/tasks/{created['id']}/actions{query}")

        assert response.status_code == 422


class TestTaskTwoUserIsolation:
    """Pins cross-user denial for every task endpoint."""

    async def test_foreign_task_is_invisible_for_read_update_delete_history(
        self,
        async_client: AsyncClient,
        current_user: dict[str, User],
        in_memory_backend: None,
        user_a: User,
        user_b: User,
    ) -> None:
        """Foreign tasks yield 404 (never data), and the owner keeps access."""
        created = await _create_task(async_client, "owned by A")
        task_id: str = created["id"]
        not_found = {"detail": f"Task {task_id} not found"}

        current_user["user"] = user_b

        assert (await async_client.get(f"/tasks/{task_id}")).json() == not_found
        assert (
            await async_client.put(
                f"/tasks/{task_id}", json={"content": "steal", "lock_ids": [], "version": 0}
            )
        ).json() == not_found
        assert (await async_client.delete(f"/tasks/{task_id}")).json() == not_found
        assert (await async_client.get(f"/tasks/{task_id}/actions")).json() == not_found

        listing = await async_client.get("/tasks/")
        assert listing.json()["total"] == 0
        assert listing.json()["tasks"] == []

        current_user["user"] = user_a
        assert (await async_client.get(f"/tasks/{task_id}")).status_code == 200

    async def test_lists_are_scoped_per_user(
        self,
        async_client: AsyncClient,
        current_user: dict[str, User],
        in_memory_backend: None,
        user_a: User,
        user_b: User,
    ) -> None:
        """Each user's list and count only include their own tasks."""
        await _create_task(async_client, "A task 1")
        await _create_task(async_client, "A task 2")

        current_user["user"] = user_b
        await _create_task(async_client, "B task 1")

        data_b = (await async_client.get("/tasks/")).json()
        assert data_b["total"] == 1
        assert [t["content"] for t in data_b["tasks"]] == ["B task 1"]

        current_user["user"] = user_a
        data_a = (await async_client.get("/tasks/")).json()
        assert data_a["total"] == 2


class TestTaskAuthAndFallbackContract:
    """Pins authentication failure and no-session fallback behavior."""

    async def test_unauthenticated_requests_return_401(self, async_client: AsyncClient) -> None:
        """Without authentication every task endpoint returns 401."""
        for method, path in [
            ("GET", "/tasks/"),
            ("POST", "/tasks/"),
            ("GET", "/tasks/00000000-0000-0000-0000-000000000000"),
            (
                "PUT",
                "/tasks/00000000-0000-0000-0000-000000000000",
            ),
            ("DELETE", "/tasks/00000000-0000-0000-0000-000000000000"),
            ("GET", "/tasks/00000000-0000-0000-0000-000000000000/actions"),
        ]:
            response = await async_client.request(method, path, json={"content": "x"})
            assert response.status_code == 401, (method, path)
            assert response.json()["detail"] == "Not authenticated"

    async def test_absent_session_falls_back_to_in_memory_repository(
        self, async_client: AsyncClient, current_user: dict[str, User], in_memory_backend: None
    ) -> None:
        """With no DB session the in-memory fallback still serves writes and reads."""
        created = await _create_task(async_client, "fallback")

        assert UUID(created["id"])
        assert (await async_client.get(f"/tasks/{created['id']}")).status_code == 200
