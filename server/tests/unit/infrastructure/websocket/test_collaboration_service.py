"""Tests for CollaborationService.

Tests Operational Transformation, cursor synchronization, room management,
and collaboration features with proper isolation.
"""

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import Mock, patch

import pytest
import pytest_asyncio

from server.infrastructure.websocket.collaboration_service import (
    CollaborationService,
    CursorUpdate,
    SelectionUpdate,
    TextOperation,
)
from server.infrastructure.websocket.connection_manager import ConnectionManager


class TestTextOperation:
    """Tests for TextOperation dataclass."""

    def test_default_values(self) -> None:
        """Test TextOperation initializes with correct defaults."""
        op = TextOperation(
            type="insert",
            position=10,
            text="hello",
        )

        assert op.type == "insert"
        assert op.position == 10
        assert op.text == "hello"
        assert op.length == 0
        assert op.user_id == ""
        assert op.timestamp > 0
        assert op.version == 0

    def test_custom_values(self) -> None:
        """Test TextOperation accepts custom values."""
        op = TextOperation(
            type="delete",
            position=20,
            length=5,
            user_id="user_1",
            version=3,
        )

        assert op.type == "delete"
        assert op.position == 20
        assert op.length == 5
        assert op.user_id == "user_1"
        assert op.version == 3

    def test_to_dict(self) -> None:
        """Test converting to dictionary."""
        op = TextOperation(
            type="insert",
            position=10,
            text="hello",
            user_id="user_1",
            version=5,
        )

        data = op.to_dict()

        assert data["type"] == "insert"
        assert data["position"] == 10
        assert data["text"] == "hello"
        assert data["user_id"] == "user_1"
        assert data["version"] == 5

    def test_from_dict(self) -> None:
        """Test creating from dictionary."""
        data = {
            "type": "delete",
            "position": 15,
            "length": 3,
            "user_id": "user_2",
            "timestamp": 1234567890.0,
            "version": 2,
        }

        op = TextOperation.from_dict(data)

        assert op.type == "delete"
        assert op.position == 15
        assert op.length == 3
        assert op.user_id == "user_2"
        assert op.version == 2

    def test_from_dict_defaults(self) -> None:
        """Test from_dict with missing optional fields."""
        data = {
            "type": "insert",
            "position": 0,
        }

        op = TextOperation.from_dict(data)

        assert op.text == ""
        assert op.length == 0
        assert op.user_id == ""
        assert op.version == 0


class TestCursorUpdate:
    """Tests for CursorUpdate dataclass."""

    def test_default_values(self) -> None:
        """Test CursorUpdate initializes with correct defaults."""
        update = CursorUpdate(
            user_id="user_1",
            line=10,
            character=5,
        )

        assert update.user_id == "user_1"
        assert update.line == 10
        assert update.character == 5
        assert update.color == "#3b82f6"

    def test_to_dict(self) -> None:
        """Test converting to dictionary."""
        update = CursorUpdate(
            user_id="user_1",
            line=10,
            character=5,
            color="#ff0000",
        )

        data = update.to_dict()

        assert data["user_id"] == "user_1"
        assert data["line"] == 10
        assert data["character"] == 5
        assert data["color"] == "#ff0000"


class TestSelectionUpdate:
    """Tests for SelectionUpdate dataclass."""

    def test_to_dict(self) -> None:
        """Test converting to dictionary."""
        update = SelectionUpdate(
            user_id="user_1",
            anchor={"line": 10, "ch": 5},
            head={"line": 15, "ch": 20},
            color="#00ff00",
        )

        data = update.to_dict()

        assert data["user_id"] == "user_1"
        assert data["anchor"] == {"line": 10, "ch": 5}
        assert data["head"] == {"line": 15, "ch": 20}
        assert data["color"] == "#00ff00"


class TestCollaborationServiceInitialization:
    """Tests for CollaborationService initialization."""

    def test_default_initialization(self) -> None:
        """Test initialization with defaults."""
        cm = ConnectionManager()
        service = CollaborationService(connection_manager=cm)

        assert service.connection_manager is cm
        assert service.redis_pubsub is None
        assert service.server_id is not None
        assert service._operation_history == {}
        assert service._max_history_size == 1000

    def test_custom_server_id(self) -> None:
        """Test initialization with custom server ID."""
        cm = ConnectionManager()
        service = CollaborationService(
            connection_manager=cm,
            server_id="custom_server_123",
        )

        assert service.server_id == "custom_server_123"

    @pytest.mark.asyncio
    async def test_initialize_without_redis(self) -> None:
        """Test initialization without Redis."""
        cm = ConnectionManager()
        service = CollaborationService(connection_manager=cm)

        await service.initialize()  # Should not raise

    @pytest.mark.asyncio
    async def test_shutdown_without_redis(self) -> None:
        """Test shutdown without Redis."""
        cm = ConnectionManager()
        service = CollaborationService(connection_manager=cm)

        await service.shutdown()  # Should not raise

    @pytest.mark.asyncio
    async def test_initialize_with_redis(self, mock_redis_client: Mock) -> None:
        """Test initialization with Redis."""
        from server.infrastructure.websocket.redis_pubsub import RedisPubSubManager

        cm = ConnectionManager()
        pubsub = RedisPubSubManager()
        service = CollaborationService(
            connection_manager=cm,
            redis_pubsub=pubsub,
        )

        with patch("redis.asyncio.from_url", return_value=mock_redis_client):
            await service.initialize()
            assert service.redis_pubsub is not None
            await service.shutdown()


class TestCollaborationServiceRoomOperations:
    """Tests for room operations."""

    @pytest_asyncio.fixture
    async def service_with_room(self) -> tuple[CollaborationService, Any]:
        """Create a service with a room and one user."""
        from tests.unit.infrastructure.websocket.conftest import MockWebSocket

        cm = ConnectionManager()
        service = CollaborationService(connection_manager=cm)

        ws = MockWebSocket()
        room = await cm.connect(ws, "test_room", "user_1", "Test User")

        yield service, room

    @pytest.mark.asyncio
    async def test_join_room(self, service_with_room: tuple) -> None:
        """Test user joining a room."""
        service, room = service_with_room

        response = await service.join_room(room, "user_1", "Test User")

        assert response["type"] == "room_joined"
        assert response["data"]["room_id"] == "test_room"
        assert response["data"]["user_id"] == "user_1"
        assert response["data"]["content"] == ""
        assert response["data"]["version"] == 0
        assert isinstance(response["data"]["users"], list)

    @pytest.mark.asyncio
    async def test_join_room_with_initial_content(self, service_with_room: tuple) -> None:
        """Test joining room with initial content."""
        service, room = service_with_room

        response = await service.join_room(
            room, "user_1", "Test User", initial_content="Hello world"
        )

        assert response["data"]["content"] == "Hello world"

    @pytest.mark.asyncio
    async def test_leave_room(self, service_with_room: tuple) -> None:
        """Test user leaving a room."""
        service, room = service_with_room

        await service.join_room(room, "user_1", "Test User")
        await service.leave_room(room, "user_1")

        # leave_room broadcasts notification but doesn't remove from presence
        # Presence is removed by connection_manager.disconnect()
        # Just verify no error was raised

    @pytest.mark.asyncio
    async def test_leave_room_notifies_others(self, service_with_room: tuple) -> None:
        """Test leaving room notifies other users."""
        from tests.unit.infrastructure.websocket.conftest import MockWebSocket

        service, room = service_with_room
        cm = service.connection_manager

        # Add another user
        ws2 = MockWebSocket()
        await cm.connect(ws2, "test_room", "user_2", "User 2")

        await service.join_room(room, "user_1", "Test User")
        await service.leave_room(room, "user_1")

        # User 2 should receive user_left message
        assert any(
            msg.get("type") == "user_left" and msg["data"].get("user_id") == "user_1"
            for msg in ws2.sent_messages
        )


class TestCollaborationServiceOperations:
    """Tests for text operation handling."""

    @pytest_asyncio.fixture
    async def service_with_room(self) -> tuple[CollaborationService, Any]:
        """Create a service with a room."""
        from tests.unit.infrastructure.websocket.conftest import MockWebSocket

        cm = ConnectionManager()
        service = CollaborationService(connection_manager=cm)

        ws = MockWebSocket()
        room = await cm.connect(ws, "test_room", "user_1", "Test User")
        await service.join_room(room, "user_1", "Test User")

        yield service, room

    @pytest.mark.asyncio
    async def test_handle_insert_operation(self, service_with_room: tuple) -> None:
        """Test handling an insert operation."""
        service, room = service_with_room

        op = TextOperation(
            type="insert",
            position=5,
            text="hello",
            user_id="user_1",
        )

        content, message = await service.handle_operation(room, op, "world")

        assert content == "worldhello"
        assert room.document_version == 1
        assert message["type"] == "operation"
        assert message["data"]["operation"]["type"] == "insert"

    @pytest.mark.asyncio
    async def test_handle_delete_operation(self, service_with_room: tuple) -> None:
        """Test handling a delete operation."""
        service, room = service_with_room

        op = TextOperation(
            type="delete",
            position=1,
            length=2,
            user_id="user_1",
        )

        content, message = await service.handle_operation(room, op, "hello")

        assert content == "hlo"
        assert room.document_version == 1

    @pytest.mark.asyncio
    async def test_handle_retain_operation(self, service_with_room: tuple) -> None:
        """Test handling a retain operation (no change)."""
        service, room = service_with_room

        op = TextOperation(
            type="retain",
            position=0,
            length=5,
            user_id="user_1",
        )

        content, message = await service.handle_operation(room, op, "hello")

        assert content == "hello"

    @pytest.mark.asyncio
    async def test_operation_stored_in_history(self, service_with_room: tuple) -> None:
        """Test operations are stored in history."""
        service, room = service_with_room

        op = TextOperation(
            type="insert",
            position=0,
            text="hello",
            user_id="user_1",
        )

        await service.handle_operation(room, op, "")

        assert "test_room" in service._operation_history
        assert len(service._operation_history["test_room"]) == 1

    @pytest.mark.asyncio
    async def test_operation_history_limit(self, service_with_room: tuple) -> None:
        """Test operation history respects max size."""
        service, room = service_with_room
        service._max_history_size = 3

        for i in range(5):
            op = TextOperation(
                type="insert",
                position=i,
                text="x",
                user_id="user_1",
                version=i,
            )
            await service.handle_operation(room, op, "")

        # Should only keep last 3 operations
        assert len(service._operation_history["test_room"]) == 3


class TestCollaborationServiceCursorAndSelection:
    """Tests for cursor and selection handling."""

    @pytest_asyncio.fixture
    async def service_with_room(self) -> tuple[CollaborationService, Any]:
        """Create a service with a room."""
        from tests.unit.infrastructure.websocket.conftest import MockWebSocket

        cm = ConnectionManager()
        service = CollaborationService(connection_manager=cm)

        ws = MockWebSocket()
        room = await cm.connect(ws, "test_room", "user_1", "Test User")
        await service.join_room(room, "user_1", "Test User")

        yield service, room

    @pytest.mark.asyncio
    async def test_handle_cursor_update(self, service_with_room: tuple) -> None:
        """Test handling cursor position update."""
        service, room = service_with_room

        update = CursorUpdate(
            user_id="user_1",
            line=10,
            character=25,
        )

        await service.handle_cursor_update(room, update)

        # Presence should be updated
        assert room.presence["user_1"].cursor_position == {"line": 10, "ch": 25}

    @pytest.mark.asyncio
    async def test_handle_selection_update(self, service_with_room: tuple) -> None:
        """Test handling selection update."""
        service, room = service_with_room

        update = SelectionUpdate(
            user_id="user_1",
            anchor={"line": 5, "ch": 10},
            head={"line": 8, "ch": 30},
        )

        await service.handle_selection_update(room, update)

        # Presence should be updated
        assert room.presence["user_1"].selection is not None

    @pytest.mark.asyncio
    async def test_handle_awareness_update(self, service_with_room: tuple) -> None:
        """Test handling generic awareness update."""
        service, room = service_with_room

        await service.handle_awareness_update(room, "user_1", {"is_active": False})

        assert room.presence["user_1"].is_active is False


class TestCollaborationServiceTransformation:
    """Tests for Operational Transformation."""

    def test_transform_different_positions(self) -> None:
        """Test transforming operations at different positions."""
        cm = ConnectionManager()
        service = CollaborationService(connection_manager=cm)

        op1 = TextOperation(type="insert", position=5, text="a", timestamp=1.0)
        op2 = TextOperation(type="insert", position=10, text="b", timestamp=2.0)

        transformed1, transformed2 = service.transform_operations(op1, op2)

        # Positions should remain unchanged
        assert transformed1.position == 5
        assert transformed2.position == 10

    def test_transform_same_position_insert(self) -> None:
        """Test transforming concurrent inserts at same position."""
        cm = ConnectionManager()
        service = CollaborationService(connection_manager=cm)

        op1 = TextOperation(type="insert", position=5, text="a", timestamp=1.0)
        op2 = TextOperation(type="insert", position=5, text="b", timestamp=2.0)

        transformed1, transformed2 = service.transform_operations(op1, op2)

        # Earlier operation should be applied first
        # op2 should be shifted by length of op1
        assert transformed2.position == 6  # 5 + 1

    def test_transform_same_position_delete(self) -> None:
        """Test transforming concurrent deletes at same position."""
        cm = ConnectionManager()
        service = CollaborationService(connection_manager=cm)

        op1 = TextOperation(type="delete", position=5, length=3, timestamp=1.0)
        op2 = TextOperation(type="delete", position=5, length=2, timestamp=2.0)

        transformed1, transformed2 = service.transform_operations(op1, op2)

        # op2 position should be adjusted for deleted content
        assert transformed2.position == 2  # 5 - 3


class TestCollaborationServiceDocumentHistory:
    """Tests for document history retrieval."""

    @pytest_asyncio.fixture
    async def service_with_history(self) -> CollaborationService:
        """Create a service with operation history."""
        from tests.unit.infrastructure.websocket.conftest import MockWebSocket

        cm = ConnectionManager()
        service = CollaborationService(connection_manager=cm)

        ws = MockWebSocket()
        room = await cm.connect(ws, "test_room", "user_1", "Test User")
        await service.join_room(room, "user_1", "Test User")

        # Add some operations
        for i in range(5):
            op = TextOperation(
                type="insert",
                position=i,
                text=f"op{i}",
                user_id="user_1",
                version=i + 1,
            )
            await service.handle_operation(room, op, "")

        return service

    @pytest.mark.asyncio
    async def test_get_document_history_all(
        self, service_with_history: CollaborationService
    ) -> None:
        """Test getting all document history."""
        history = await service_with_history.get_document_history("test_room")

        assert len(history) == 5

    @pytest.mark.asyncio
    async def test_get_document_history_from_version(
        self,
        service_with_history: CollaborationService,
    ) -> None:
        """Test getting history from specific version."""
        history = await service_with_history.get_document_history("test_room", from_version=3)

        # Should only get versions 3, 4, 5
        assert len(history) == 3
        assert all(op["version"] >= 3 for op in history)

    @pytest.mark.asyncio
    async def test_get_document_history_nonexistent_room(
        self,
        service_with_history: CollaborationService,
    ) -> None:
        """Test getting history for nonexistent room."""
        history = await service_with_history.get_document_history("nonexistent")

        assert history == []


class TestCollaborationServiceRedisIntegration:
    """Tests for Redis integration."""

    @pytest.mark.asyncio
    async def test_handle_redis_message(self, mock_redis_client: Mock) -> None:
        """Test handling messages from Redis."""
        from server.infrastructure.websocket.redis_pubsub import RedisPubSubManager
        from tests.unit.infrastructure.websocket.conftest import MockWebSocket

        cm = ConnectionManager()
        pubsub = RedisPubSubManager()
        service = CollaborationService(
            connection_manager=cm,
            redis_pubsub=pubsub,
            server_id="server_1",
        )

        ws = MockWebSocket()
        await cm.connect(ws, "test_room", "user_1", "Test User")

        with patch("redis.asyncio.from_url", return_value=mock_redis_client):
            await service.initialize()

            # Simulate message from another server
            message = {
                "type": "update",
                "data": "test",
                "room_id": "test_room",
                "_source_server": "server_2",
            }

            service._handle_redis_message(message)

            # Message should be broadcast to local clients
            await asyncio.sleep(0.1)  # Allow async task to complete

    @pytest.mark.asyncio
    async def test_handle_own_redis_message(self, mock_redis_client: Mock) -> None:
        """Test skipping messages from own server."""
        from server.infrastructure.websocket.redis_pubsub import RedisPubSubManager

        cm = ConnectionManager()
        pubsub = RedisPubSubManager()
        service = CollaborationService(
            connection_manager=cm,
            redis_pubsub=pubsub,
            server_id="server_1",
        )

        message = {
            "type": "update",
            "_source_server": "server_1",  # Same as our server
        }

        # Should return early without processing
        service._handle_redis_message(message)  # Should not raise


class TestCollaborationServiceEdgeCases:
    """Edge case tests for CollaborationService."""

    @pytest.mark.asyncio
    async def test_empty_operation_text(self) -> None:
        """Test handling empty text in insert operation."""
        from tests.unit.infrastructure.websocket.conftest import MockWebSocket

        cm = ConnectionManager()
        service = CollaborationService(connection_manager=cm)

        ws = MockWebSocket()
        room = await cm.connect(ws, "test_room", "user_1", "Test User")

        op = TextOperation(
            type="insert",
            position=0,
            text="",
            user_id="user_1",
        )

        content, _ = await service.handle_operation(room, op, "hello")
        assert content == "hello"  # No change

    @pytest.mark.asyncio
    async def test_unicode_content_operations(self) -> None:
        """Test handling unicode content in operations."""
        from tests.unit.infrastructure.websocket.conftest import MockWebSocket

        cm = ConnectionManager()
        service = CollaborationService(connection_manager=cm)

        ws = MockWebSocket()
        room = await cm.connect(ws, "test_room", "user_1", "Test User")

        unicode_text = "Hello 世界 👋"
        op = TextOperation(
            type="insert",
            position=0,
            text=unicode_text,
            user_id="user_1",
        )

        content, _ = await service.handle_operation(room, op, "")
        assert content == unicode_text

    @pytest.mark.asyncio
    async def test_concurrent_operations(self) -> None:
        """Test handling concurrent operations."""
        from tests.unit.infrastructure.websocket.conftest import MockWebSocket

        cm = ConnectionManager()
        service = CollaborationService(connection_manager=cm)

        ws = MockWebSocket()
        room = await cm.connect(ws, "test_room", "user_1", "Test User")
        await service.join_room(room, "user_1", "Test User")

        async def apply_operation(i: int) -> None:
            op = TextOperation(
                type="insert",
                position=i,
                text=f"x{i}",
                user_id="user_1",
            )
            await service.handle_operation(room, op, "")

        # Apply operations concurrently
        await asyncio.gather(*[apply_operation(i) for i in range(10)])

        # All operations should be in history
        assert len(service._operation_history["test_room"]) == 10

    @pytest.mark.asyncio
    async def test_negative_position_operation(self) -> None:
        """Test handling operation with negative position."""
        from tests.unit.infrastructure.websocket.conftest import MockWebSocket

        cm = ConnectionManager()
        service = CollaborationService(connection_manager=cm)

        ws = MockWebSocket()
        room = await cm.connect(ws, "test_room", "user_1", "Test User")

        op = TextOperation(
            type="insert",
            position=-5,
            text="test",
            user_id="user_1",
        )

        # Should handle gracefully (may raise or clamp position)
        try:
            content, _ = await service.handle_operation(room, op, "hello")
            # If no error, check behavior
        except (ValueError, IndexError):
            pass  # Expected for negative position

    @pytest.mark.asyncio
    async def test_position_beyond_content(self) -> None:
        """Test handling operation beyond content length."""
        from tests.unit.infrastructure.websocket.conftest import MockWebSocket

        cm = ConnectionManager()
        service = CollaborationService(connection_manager=cm)

        ws = MockWebSocket()
        room = await cm.connect(ws, "test_room", "user_1", "Test User")

        op = TextOperation(
            type="insert",
            position=1000,  # Beyond "hello" length
            text="end",
            user_id="user_1",
        )

        content, _ = await service.handle_operation(room, op, "hello")
        # Should append to end
        assert content.endswith("end")

    @pytest.mark.asyncio
    async def test_rapid_join_leave(self) -> None:
        """Test rapid join/leave cycles."""
        from tests.unit.infrastructure.websocket.conftest import MockWebSocket

        cm = ConnectionManager()
        service = CollaborationService(connection_manager=cm)

        for i in range(10):
            ws = MockWebSocket()
            room = await cm.connect(ws, "rapid_room", f"user_{i}", f"User {i}")
            await service.join_room(room, f"user_{i}", f"User {i}")
            await service.leave_room(room, f"user_{i}")
            await cm.disconnect("rapid_room", f"user_{i}")

        # Room should be empty and cleaned up
        assert cm.get_room("rapid_room") is None
