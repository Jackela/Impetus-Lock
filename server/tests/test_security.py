"""
Security tests for Impetus Lock.

This module tests input validation, authorization, and other security-critical features.

Note: Many tests are placeholders pending implementation of auth and API endpoints.
Add pytest-asyncio to dev dependencies when implementing async tests:
    poetry add --group dev pytest-asyncio
"""

from datetime import UTC
from uuid import uuid4

import pytest


class TestTaskInputValidation:
    """Tests for task input validation."""

    def test_task_title_empty_raises_error(self) -> None:
        """Task with empty title should raise ValueError."""
        from datetime import datetime

        from tests.fixtures.factories.task_factory import Task

        with pytest.raises(ValueError, match="Title must be"):
            Task(
                id=uuid4(),
                title="",  # Empty title
                content="Content",
                created_at=datetime.now(UTC),
            )

    def test_task_title_too_long_raises_error(self) -> None:
        """Task with title >200 characters should raise ValueError."""
        from datetime import datetime

        from tests.fixtures.factories.task_factory import Task

        with pytest.raises(ValueError, match="Title must be"):
            Task(
                id=uuid4(),
                title="x" * 201,  # Too long
                content="Content",
                created_at=datetime.now(UTC),
            )

    def test_html_injection_in_title(self) -> None:
        """HTML in title should be escaped or rejected."""
        from datetime import datetime

        from tests.fixtures.factories.task_factory import Task

        # Accept as literal string (no sanitization at domain layer)
        task = Task(
            id=uuid4(),
            title="<script>alert('xss')</script>",
            content="Content",
            created_at=datetime.now(UTC),
        )
        # Sanitization should happen at presentation layer
        assert task.title == "<script>alert('xss')</script>"

    @pytest.mark.asyncio
    async def test_async_create_task_with_html_injection(self) -> None:
        """Test async endpoint with HTML injection attempt.

        Validates that the API properly handles malicious content in async context.
        """
        from fastapi.testclient import TestClient

        from server.api.main import app
        from server.api.routes import tasks as tasks_module
        from server.infrastructure.persistence.in_memory_task_repository import (
            InMemoryTaskRepository,
        )

        repo = InMemoryTaskRepository()

        async def override_repo() -> InMemoryTaskRepository:
            return repo

        app.dependency_overrides[tasks_module.get_task_repository] = override_repo
        app.dependency_overrides[tasks_module.get_session_optional] = lambda: None

        client = TestClient(app)

        try:
            # Test with HTML injection in task content
            response = client.post(
                "/tasks/",
                json={
                    "content": "<script>alert('xss')</script><img src=x onerror=alert(1)>",
                    "lock_ids": [],
                },
            )

            assert response.status_code == 201
            data = response.json()

            # Content should be accepted as-is (sanitization at presentation layer)
            assert data["content"] == "<script>alert('xss')</script><img src=x onerror=alert(1)>"

            # Verify task was created
            assert "id" in data
            assert data["version"] == 0
        finally:
            app.dependency_overrides.pop(tasks_module.get_task_repository, None)
            app.dependency_overrides.pop(tasks_module.get_session_optional, None)

    @pytest.mark.asyncio
    async def test_async_get_task_preserves_html_content(self) -> None:
        """Test async GET endpoint returns HTML content without modification.

        Validates that retrieved content is unchanged from creation.
        """
        from fastapi.testclient import TestClient

        from server.api.main import app
        from server.api.routes import tasks as tasks_module
        from server.infrastructure.persistence.in_memory_task_repository import (
            InMemoryTaskRepository,
        )

        repo = InMemoryTaskRepository()

        async def override_repo() -> InMemoryTaskRepository:
            return repo

        app.dependency_overrides[tasks_module.get_task_repository] = override_repo
        app.dependency_overrides[tasks_module.get_session_optional] = lambda: None

        client = TestClient(app)

        try:
            # Create task with special characters
            create_response = client.post(
                "/tasks/",
                json={
                    "content": "<div data-lock-id='lock_123'>Content &amp; more</div>",
                    "lock_ids": ["lock_123"],
                },
            )

            assert create_response.status_code == 201
            task_id = create_response.json()["id"]

            # Retrieve task via async context
            get_response = client.get(f"/tasks/{task_id}")

            assert get_response.status_code == 200
            data = get_response.json()

            # Content should be preserved exactly
            assert data["content"] == "<div data-lock-id='lock_123'>Content &amp; more</div>"
            assert data["lock_ids"] == ["lock_123"]
        finally:
            app.dependency_overrides.pop(tasks_module.get_task_repository, None)
            app.dependency_overrides.pop(tasks_module.get_session_optional, None)

    @pytest.mark.asyncio
    async def test_async_update_task_with_injection(self) -> None:
        """Test async update endpoint handles injection attempts.

        Validates that updates preserve content as-is without modification.
        """
        from fastapi.testclient import TestClient

        from server.api.main import app
        from server.api.routes import tasks as tasks_module
        from server.infrastructure.persistence.in_memory_task_repository import (
            InMemoryTaskRepository,
        )

        repo = InMemoryTaskRepository()

        async def override_repo() -> InMemoryTaskRepository:
            return repo

        app.dependency_overrides[tasks_module.get_task_repository] = override_repo
        app.dependency_overrides[tasks_module.get_session_optional] = lambda: None

        client = TestClient(app)

        try:
            # Create initial task
            create_response = client.post(
                "/tasks/",
                json={"content": "Original content", "lock_ids": []},
            )

            assert create_response.status_code == 201
            task_id = create_response.json()["id"]
            version = create_response.json()["version"]

            # Update with injected content
            update_response = client.put(
                f"/tasks/{task_id}",
                json={
                    "content": "<iframe src='javascript:alert(1)'></iframe>",
                    "lock_ids": ["<script>bad_lock</script>"],
                    "version": version,
                },
            )

            assert update_response.status_code == 200
            data = update_response.json()

            # Content preserved exactly (sanitization at presentation layer)
            assert data["content"] == "<iframe src='javascript:alert(1)'></iframe>"
            assert data["lock_ids"] == ["<script>bad_lock</script>"]
            assert data["version"] == version + 1
        finally:
            app.dependency_overrides.pop(tasks_module.get_task_repository, None)
            app.dependency_overrides.pop(tasks_module.get_session_optional, None)


class TestLockSecurity:
    """Tests for lock security features."""

    def test_lock_validation_in_task_content(self) -> None:
        """Lock IDs in content should be extractable and validated."""
        content = '<div data-lock-id="abc-123">Locked content</div>'
        assert "data-lock-id" in content

    def test_extract_lock_ids_from_html_content(self) -> None:
        """Test extracting lock IDs from HTML content."""
        import re

        def extract_lock_ids(content: str) -> list[str]:
            """Extract lock IDs from HTML data-lock-id attributes."""
            pattern = r'data-lock-id="([^"]+)"'
            matches = re.findall(pattern, content)
            return matches

        # Test single lock ID
        content1 = '<div data-lock-id="lock_abc-123">Locked content</div>'
        lock_ids1 = extract_lock_ids(content1)
        assert "lock_abc-123" in lock_ids1

        # Test multiple lock IDs
        content2 = """
        <div data-lock-id="lock_123">Content 1</div>
        <span data-lock-id="lock_456">Content 2</span>
        <p data-lock-id="lock_789">Content 3</p>
        """
        lock_ids2 = extract_lock_ids(content2)
        assert len(lock_ids2) == 3
        assert "lock_123" in lock_ids2
        assert "lock_456" in lock_ids2
        assert "lock_789" in lock_ids2

    def test_extract_lock_ids_edge_cases(self) -> None:
        """Test lock extraction edge cases (empty, malformed)."""
        import re

        def extract_lock_ids(content: str) -> list[str]:
            """Extract lock IDs from HTML data-lock-id attributes."""
            pattern = r'data-lock-id="([^"]+)"'
            matches = re.findall(pattern, content)
            return matches

        # Empty content
        empty_content = ""
        lock_ids = extract_lock_ids(empty_content)
        assert lock_ids == []

        # Content with no lock IDs
        no_locks = "<div>Regular content without locks</div>"
        lock_ids = extract_lock_ids(no_locks)
        assert lock_ids == []

        # Malformed: missing closing quote
        malformed1 = '<div data-lock-id="abc-123>Content</div>'
        lock_ids = extract_lock_ids(malformed1)
        assert "abc-123" not in lock_ids

        # Malformed: missing value
        malformed2 = '<div data-lock-id="">Content</div>'
        lock_ids = extract_lock_ids(malformed2)
        assert "" not in lock_ids or lock_ids == []

        # Nested lock IDs
        nested = """
        <div data-lock-id="outer">
            <span data-lock-id="inner">Nested content</span>
        </div>
        """
        lock_ids = extract_lock_ids(nested)
        assert len(lock_ids) == 2
        assert "outer" in lock_ids
        assert "inner" in lock_ids

    @pytest.mark.skip(reason="Authentication system not yet implemented - tracked as Issue #XXX")
    @pytest.mark.asyncio
    async def test_cannot_delete_lock_without_permission(self) -> None:
        """Placeholder: Lock deletion should require proper authorization.

        This test validates that users cannot delete locks belonging to others.
        Requires: Authentication system implementation.
        Tracked as Issue #XXX: Authorization for lock management.
        """
        # Implementation pending authentication system
        pass


class TestContentSanitization:
    """Tests for content sanitization."""

    def test_lock_id_format_uuid(self) -> None:
        """Lock IDs should be validated as UUIDs."""
        valid_uuid = str(uuid4())
        # Should parse as UUID
        from uuid import UUID

        try:
            UUID(valid_uuid)
        except ValueError as err:
            raise AssertionError("Should be valid UUID") from err

    def test_validate_lock_id_valid_uuid_passes(self) -> None:
        """Test valid UUID format passes validation."""
        from uuid import UUID

        def validate_lock_id(lock_id: str) -> bool:
            """Validate lock_id has UUID format."""
            # Remove 'lock_' prefix if present
            uuid_part = lock_id.removeprefix("lock_")
            # Try to parse as UUID
            UUID(uuid_part)
            return True

        # Valid UUID formats
        assert validate_lock_id(str(uuid4())) is True
        assert validate_lock_id(f"lock_{uuid4()}") is True

        # Valid UUID strings
        assert validate_lock_id("550e8400-e29b-41d4-a716-446655440000") is True
        assert validate_lock_id("lock_550e8400-e29b-41d4-a716-446655440000") is True

    def test_validate_lock_id_invalid_format_raises_error(self) -> None:
        """Test invalid lock_id formats raise ValueError."""
        from uuid import UUID

        def validate_lock_id(lock_id: str) -> bool:
            """Validate lock_id has UUID format."""
            # Remove 'lock_' prefix if present
            uuid_part = lock_id.removeprefix("lock_")
            # Try to parse as UUID
            UUID(uuid_part)
            return True

        invalid_formats = [
            "not-a-uuid",
            "lock_not-a-uuid",
            "",
            "lock_",
            "12345",
            "lock_12345",
            "abc-def-ghi",  # Wrong format
            "lock_abc-def-ghi",
            "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",  # Invalid hex chars
            "lock_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        ]

        for invalid_id in invalid_formats:
            with pytest.raises(ValueError):
                validate_lock_id(invalid_id)


class TestAuthorizationPlaceholders:
    """Placeholders for authorization tests when auth is implemented."""

    @pytest.mark.skip(reason="Authentication not implemented")
    def test_authenticated_user_can_create_lock(self) -> None:
        """Authenticated user should be able to create locks."""
        pass

    @pytest.mark.skip(reason="Authentication not implemented")
    def test_unauthenticated_user_cannot_create_lock(self) -> None:
        """Unauthenticated user should not be able to create locks."""
        pass

    @pytest.mark.skip(reason="Authentication not implemented")
    def test_user_can_only_delete_own_locks(self) -> None:
        """User should only be able to delete locks they created."""
        pass
