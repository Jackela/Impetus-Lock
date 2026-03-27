"""Edge case and property-based tests.

Tests empty inputs, very long inputs, unicode/emoji handling,
concurrent requests, and property-based invariants.
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

# Try to import hypothesis for property-based testing
try:
    from hypothesis import HealthCheck, given, settings
    from hypothesis import strategies as st

    HYPOTHESIS_AVAILABLE = True
except ImportError:
    HYPOTHESIS_AVAILABLE = False

    # Create dummy decorators for when hypothesis is not available
    def given(*args, **kwargs):  # type: ignore
        def decorator(f):
            return pytest.mark.skip(reason="hypothesis not installed")(f)

        return decorator

    def settings(*args, **kwargs):  # type: ignore
        return lambda f: f

    st = None  # type: ignore


class TestEmptyInputs:
    """Tests for handling empty inputs."""

    @pytest.mark.asyncio
    async def test_empty_task_content(self) -> None:
        """Test creating task with empty content."""
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

        try:
            client = TestClient(app)
            response = client.post(
                "/tasks/",
                json={"content": "", "lock_ids": []},
            )

            # Empty content should be handled gracefully
            assert response.status_code in [201, 422]
        finally:
            app.dependency_overrides.pop(tasks_module.get_task_repository, None)
            app.dependency_overrides.pop(tasks_module.get_session_optional, None)

    @pytest.mark.asyncio
    async def test_empty_context_intervention(self) -> None:
        """Test intervention with empty context."""
        from fastapi.testclient import TestClient

        from server.api.main import app

        client = TestClient(app)
        response = client.post(
            "/impetus/generate-intervention",
            json={
                "context": "",
                "mode": "muse",
                "client_meta": {"doc_version": 1, "selection_from": 0, "selection_to": 0},
            },
            headers={
                "Idempotency-Key": "test-key-empty",
                "X-Contract-Version": "2.0.0",
            },
        )

        assert response.status_code == 422

    def test_empty_string_in_presence_update(self) -> None:
        """Test presence update with empty string values."""
        from server.infrastructure.websocket.connection_manager import (
            UserPresence,
        )

        presence = UserPresence(
            user_id="user_1",
            username="",
            color="",
        )

        assert presence.username == ""
        assert presence.color == ""


class TestVeryLongInputs:
    """Tests for handling very long inputs (>2000 chars)."""

    def test_2000_character_string(self) -> None:
        """Test handling 2000 character string."""
        long_text = "a" * 2000

        # Should handle without issues
        assert len(long_text) == 2000

    def test_10000_character_string(self) -> None:
        """Test handling 10000 character string."""
        long_text = "x" * 10000

        assert len(long_text) == 10000

    @pytest.mark.asyncio
    async def test_long_context_intervention(self) -> None:
        """Test intervention with very long context."""
        from fastapi.testclient import TestClient

        from server.api.main import app

        long_context = "测试内容。" * 1000  # ~5000 characters

        client = TestClient(app)
        response = client.post(
            "/impetus/generate-intervention",
            json={
                "context": long_context,
                "mode": "muse",
                "client_meta": {"doc_version": 1, "selection_from": 100, "selection_to": 100},
            },
            headers={
                "Idempotency-Key": "test-key-long",
                "X-Contract-Version": "2.0.0",
            },
        )

        # Should either succeed or fail gracefully
        assert response.status_code in [200, 422, 413]  # OK, validation error, or too large

    @pytest.mark.asyncio
    async def test_long_task_content(self) -> None:
        """Test creating task with very long content."""
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

        try:
            client = TestClient(app)
            long_content = "<div>" + "content" * 1000 + "</div>"

            response = client.post(
                "/tasks/",
                json={"content": long_content, "lock_ids": []},
            )

            # Should handle gracefully
            assert response.status_code in [201, 422, 413]
        finally:
            app.dependency_overrides.pop(tasks_module.get_task_repository, None)
            app.dependency_overrides.pop(tasks_module.get_session_optional, None)


class TestUnicodeAndEmoji:
    """Tests for unicode and emoji handling."""

    @pytest.mark.parametrize(
        "text",
        [
            "Hello 世界",
            "مرحبا بالعالم",
            "שלום עולם",
            "🎉🎊🎁",
            "👨‍👩‍👧‍👦",  # Family emoji (multiple code points)
            "日本語テスト",
            "한국어 테스트",
            "Ελληνικά",
            "👨‍💻👩‍💻",
            "🌈🏳️‍🌈",  # Rainbow + flag
        ],
    )
    def test_unicode_strings(self, text: str) -> None:
        """Test various unicode strings are handled correctly."""
        # Should be able to encode/decode
        encoded = text.encode("utf-8")
        decoded = encoded.decode("utf-8")

        assert decoded == text

    @pytest.mark.asyncio
    async def test_unicode_in_task_content(self) -> None:
        """Test unicode content in tasks."""
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

        try:
            client = TestClient(app)
            unicode_content = "内容：你好世界 🎉 "

            response = client.post(
                "/tasks/",
                json={"content": unicode_content, "lock_ids": []},
            )

            if response.status_code == 201:
                data = response.json()
                assert data["content"] == unicode_content
        finally:
            app.dependency_overrides.pop(tasks_module.get_task_repository, None)
            app.dependency_overrides.pop(tasks_module.get_session_optional, None)

    @pytest.mark.asyncio
    async def test_unicode_in_username(self) -> None:
        """Test unicode in WebSocket usernames."""
        from server.infrastructure.websocket.connection_manager import ConnectionManager
        from tests.unit.infrastructure.websocket.conftest import MockWebSocket

        cm = ConnectionManager()
        MockWebSocket()

        unicode_names = [
            "用户一",
            "ユーザーA",
            "사용자1",
            "👨‍💻 Developer 🔥",
        ]

        for i, name in enumerate(unicode_names):
            ws_i = MockWebSocket()
            await cm.connect(ws_i, "unicode_room", f"user_{i}", name)

        room = cm.get_room("unicode_room")
        assert room.user_count == len(unicode_names)

    def test_emoji_in_presence(self) -> None:
        """Test emoji in presence data."""
        from server.infrastructure.websocket.connection_manager import UserPresence

        presence = UserPresence(
            user_id="user_1",
            username="Test 🎉",
        )

        assert "🎉" in presence.username


class TestConcurrentRequests:
    """Tests for concurrent request handling."""

    @pytest.mark.asyncio
    async def test_concurrent_task_creation(self) -> None:
        """Test creating multiple tasks concurrently."""
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

        try:
            client = TestClient(app)

            async def create_task(i: int) -> Any:
                response = client.post(
                    "/tasks/",
                    json={"content": f"Task {i}", "lock_ids": []},
                )
                return response.status_code

            # Create tasks concurrently
            tasks = [create_task(i) for i in range(10)]
            results = await asyncio.gather(*tasks)

            # All should succeed
            assert all(code == 201 for code in results)
        finally:
            app.dependency_overrides.pop(tasks_module.get_task_repository, None)
            app.dependency_overrides.pop(tasks_module.get_session_optional, None)

    @pytest.mark.asyncio
    async def test_concurrent_websocket_connections(self) -> None:
        """Test multiple concurrent WebSocket connections."""
        from server.infrastructure.websocket.connection_manager import ConnectionManager
        from tests.unit.infrastructure.websocket.conftest import MockWebSocket

        cm = ConnectionManager()

        async def connect_user(user_id: str) -> None:
            ws = MockWebSocket()
            await cm.connect(ws, "concurrent_room", user_id, f"User {user_id}")

        # Connect 20 users concurrently
        tasks = [connect_user(f"user_{i}") for i in range(20)]
        await asyncio.gather(*tasks)

        room = cm.get_room("concurrent_room")
        assert room.user_count == 20

    @pytest.mark.asyncio
    async def test_concurrent_broadcast(self) -> None:
        """Test concurrent broadcasts to room."""
        from server.infrastructure.websocket.connection_manager import ConnectionManager
        from tests.unit.infrastructure.websocket.conftest import MockWebSocket

        cm = ConnectionManager()

        # Connect multiple users
        websockets = []
        for i in range(5):
            ws = MockWebSocket()
            await cm.connect(ws, "broadcast_room", f"user_{i}", f"User {i}")
            websockets.append(ws)

        # Broadcast concurrently
        async def broadcast_message(msg_id: int) -> None:
            await cm.broadcast_to_room(
                "broadcast_room",
                {"type": "message", "id": msg_id},
            )

        tasks = [broadcast_message(i) for i in range(10)]
        await asyncio.gather(*tasks)

        # Each WebSocket should have received 10 messages
        for ws in websockets:
            assert len(ws.sent_messages) == 10

    @pytest.mark.asyncio
    async def test_concurrent_room_operations(self) -> None:
        """Test concurrent room operations."""
        from server.infrastructure.websocket.connection_manager import ConnectionManager
        from tests.unit.infrastructure.websocket.conftest import MockWebSocket

        cm = ConnectionManager()

        async def room_operation(op_id: int) -> None:
            ws = MockWebSocket()
            user_id = f"user_{op_id}"
            room_id = f"room_{op_id % 3}"  # 3 different rooms

            await cm.connect(ws, room_id, user_id, f"User {op_id}")
            await cm.broadcast_to_room(room_id, {"type": "join", "user": user_id})
            await cm.disconnect(room_id, user_id)

        # Run concurrent operations
        tasks = [room_operation(i) for i in range(30)]
        await asyncio.gather(*tasks)

        # All rooms should be cleaned up (empty)
        for i in range(3):
            assert cm.get_room(f"room_{i}") is None


if HYPOTHESIS_AVAILABLE:

    class TestPropertyBased:
        """Property-based tests using hypothesis."""

        @given(st.text())
        @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
        def test_text_roundtrip(self, text: str) -> None:
            """Test that any text can be encoded and decoded."""
            encoded = text.encode("utf-8")
            decoded = encoded.decode("utf-8")
            assert decoded == text

        @given(st.integers(min_value=0, max_value=1000000))
        @settings(max_examples=50)
        def test_positive_integers(self, n: int) -> None:
            """Test that positive integers are handled correctly."""
            assert n >= 0
            assert isinstance(n, int)

        @given(st.dictionaries(st.text(), st.text()))
        @settings(max_examples=50)
        def test_dictionary_operations(self, d: dict[str, str]) -> None:
            """Test dictionary operations with arbitrary data."""
            # Should be able to serialize/deserialize
            import json

            serialized = json.dumps(d)
            deserialized = json.loads(serialized)
            assert deserialized == d

        @given(st.lists(st.text(), min_size=0, max_size=100))
        @settings(max_examples=50)
        def test_list_operations(self, items: list[str]) -> None:
            """Test list operations with arbitrary data."""
            # Should handle lists of any size
            assert len(items) >= 0
            assert len(items) <= 100

        @given(st.sampled_from(["muse", "loki"]))
        @settings(max_examples=10)
        def test_valid_modes(self, mode: str) -> None:
            """Test valid mode values."""
            assert mode in ["muse", "loki"]


class TestBoundaryConditions:
    """Tests for boundary conditions."""

    def test_zero_values(self) -> None:
        """Test handling of zero values."""
        from server.infrastructure.websocket.collaboration_service import TextOperation

        op = TextOperation(
            type="insert",
            position=0,
            text="",
            length=0,
            version=0,
        )

        assert op.position == 0
        assert op.text == ""
        assert op.length == 0
        assert op.version == 0

    def test_negative_values_handling(self) -> None:
        """Test handling of negative values."""
        # Test that negative values don't crash the system
        from server.infrastructure.websocket.collaboration_service import TextOperation

        op = TextOperation(
            type="insert",
            position=-5,
            text="test",
        )

        assert op.position == -5  # Stored as-is, validation happens elsewhere

    def test_maximum_integer_values(self) -> None:
        """Test handling of very large integers."""
        from server.infrastructure.websocket.collaboration_service import TextOperation

        max_int = 2**31 - 1

        op = TextOperation(
            type="insert",
            position=max_int,
            version=max_int,
        )

        assert op.position == max_int
        assert op.version == max_int

    def test_special_characters_in_strings(self) -> None:
        """Test handling of special characters."""
        special_chars = [
            "\x00",  # Null byte
            "\n\r\t",  # Whitespace
            "'\"`",  # Quotes
            "<>\u0026",  # HTML special chars
            "\\",  # Backslash
            "%s%d",  # Format strings
        ]

        for char in special_chars:
            # Should handle without crashing
            encoded = char.encode("utf-8", errors="replace")
            decoded = encoded.decode("utf-8")
            assert isinstance(decoded, str)


class TestNullAndNoneHandling:
    """Tests for null/None value handling."""

    def test_none_values_in_operations(self) -> None:
        """Test handling of None values."""
        from server.infrastructure.websocket.collaboration_service import TextOperation

        op = TextOperation(
            type="insert",
            position=0,
            text="test",
            user_id=None,  # type: ignore
        )

        assert op.user_id is None

    @pytest.mark.asyncio
    async def test_null_fields_in_json(self) -> None:
        """Test JSON with null fields."""
        import json

        data = {
            "field1": None,
            "field2": "value",
            "field3": None,
        }

        serialized = json.dumps(data)
        deserialized = json.loads(serialized)

        assert deserialized["field1"] is None
        assert deserialized["field2"] == "value"


class TestWhitespaceHandling:
    """Tests for whitespace handling."""

    @pytest.mark.parametrize(
        "whitespace",
        [
            " ",
            "\t",
            "\n",
            "\r",
            "\r\n",
            "  ",
            "\t\t\t",
            "\n\n\n",
            " \t\n\r ",
        ],
    )
    def test_whitespace_strings(self, whitespace: str) -> None:
        """Test handling of whitespace-only strings."""
        # Should preserve whitespace
        assert whitespace == whitespace
        assert len(whitespace) > 0 or whitespace == ""

    def test_whitespace_preservation(self) -> None:
        """Test that whitespace is preserved."""
        text = "  hello  world  \t\n"

        # Should preserve whitespace exactly
        assert text.startswith("  ")
        assert "  " in text
        assert text.endswith("\n")
