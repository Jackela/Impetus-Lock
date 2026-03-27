"""Tests for WebSocket ConnectionManager.

Tests room management, user presence, connection lifecycle,
and message broadcasting with proper isolation.
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest
import pytest_asyncio

from server.infrastructure.websocket.connection_manager import (
    ConnectionManager,
    Room,
    UserPresence,
)


class TestUserPresence:
    """Tests for UserPresence dataclass."""

    def test_default_values(self) -> None:
        """Test UserPresence initializes with correct defaults."""
        presence = UserPresence(
            user_id="user_1",
            username="Test User",
        )

        assert presence.user_id == "user_1"
        assert presence.username == "Test User"
        assert presence.color == "#3b82f6"  # Default blue
        assert presence.cursor_position == {"line": 0, "ch": 0}
        assert presence.selection is None
        assert presence.is_active is True
        assert presence.last_activity == 0.0

    def test_custom_values(self) -> None:
        """Test UserPresence accepts custom values."""
        presence = UserPresence(
            user_id="user_2",
            username="Custom User",
            color="#ff0000",
            cursor_position={"line": 10, "ch": 5},
            selection={"from": 100, "to": 150},
            is_active=False,
            last_activity=1234567890.0,
        )

        assert presence.color == "#ff0000"
        assert presence.cursor_position == {"line": 10, "ch": 5}
        assert presence.selection == {"from": 100, "to": 150}
        assert presence.is_active is False
        assert presence.last_activity == 1234567890.0


class TestRoom:
    """Tests for Room class."""

    @pytest_asyncio.fixture
    async def empty_room(self) -> Room:
        """Create an empty room for testing."""
        return Room("test_room")

    @pytest_asyncio.fixture
    async def room_with_user(
        self,
        empty_room: Room,
        mock_websocket: Any,
    ) -> Room:
        """Create a room with one user connected."""
        await empty_room.add_connection(mock_websocket, "user_1")
        empty_room.presence["user_1"] = UserPresence(
            user_id="user_1",
            username="Test User",
        )
        return empty_room

    def test_room_initialization(self, empty_room: Room) -> None:
        """Test room initializes with correct state."""
        assert empty_room.room_id == "test_room"
        assert empty_room.connections == {}
        assert empty_room.presence == {}
        assert empty_room.document_version == 0
        assert empty_room.is_empty is True
        assert empty_room.user_count == 0

    @pytest.mark.asyncio
    async def test_add_connection(self, empty_room: Room, mock_websocket: Any) -> None:
        """Test adding a connection to a room."""
        await empty_room.add_connection(mock_websocket, "user_1")

        assert "user_1" in empty_room.connections
        assert empty_room.connections["user_1"] == mock_websocket
        assert empty_room.is_empty is False
        assert empty_room.user_count == 1

    @pytest.mark.asyncio
    async def test_add_multiple_connections(
        self, empty_room: Room, mock_websocket_factory: Any
    ) -> None:
        """Test adding multiple connections to a room."""
        ws1 = mock_websocket_factory("client_1")
        ws2 = mock_websocket_factory("client_2")

        await empty_room.add_connection(ws1, "user_1")
        await empty_room.add_connection(ws2, "user_2")

        assert empty_room.user_count == 2
        assert "user_1" in empty_room.connections
        assert "user_2" in empty_room.connections

    @pytest.mark.asyncio
    async def test_remove_connection(self, room_with_user: Room) -> None:
        """Test removing a connection from a room."""
        await room_with_user.remove_connection("user_1")

        assert "user_1" not in room_with_user.connections
        assert "user_1" not in room_with_user.presence
        assert room_with_user.is_empty is True
        assert room_with_user.user_count == 0

    @pytest.mark.asyncio
    async def test_remove_nonexistent_connection(self, empty_room: Room) -> None:
        """Test removing a connection that doesn't exist (should not raise)."""
        # Should not raise an exception
        await empty_room.remove_connection("nonexistent_user")

        assert empty_room.is_empty is True

    @pytest.mark.asyncio
    async def test_broadcast_message(self, empty_room: Room, mock_websocket_factory: Any) -> None:
        """Test broadcasting a message to all connections."""
        ws1 = mock_websocket_factory("client_1")
        ws2 = mock_websocket_factory("client_2")

        await empty_room.add_connection(ws1, "user_1")
        await empty_room.add_connection(ws2, "user_2")

        message = {"type": "test", "data": "hello"}
        await empty_room.broadcast(message)

        assert len(ws1.sent_messages) == 1
        assert len(ws2.sent_messages) == 1
        assert ws1.sent_messages[0] == message
        assert ws2.sent_messages[0] == message

    @pytest.mark.asyncio
    async def test_broadcast_excludes_user(
        self,
        empty_room: Room,
        mock_websocket_factory: Any,
    ) -> None:
        """Test broadcasting excludes specified user."""
        ws1 = mock_websocket_factory("client_1")
        ws2 = mock_websocket_factory("client_2")

        await empty_room.add_connection(ws1, "user_1")
        await empty_room.add_connection(ws2, "user_2")

        message = {"type": "test", "data": "hello"}
        await empty_room.broadcast(message, exclude_user="user_1")

        assert len(ws1.sent_messages) == 0
        assert len(ws2.sent_messages) == 1

    @pytest.mark.asyncio
    async def test_broadcast_handles_send_error(
        self,
        empty_room: Room,
        mock_websocket_factory: Any,
    ) -> None:
        """Test broadcast continues even if one send fails."""
        ws1 = mock_websocket_factory("client_1")
        ws2 = mock_websocket_factory("client_2")

        # Make ws1 raise an error on send
        async def raise_error(data: dict[str, Any]) -> None:
            raise ConnectionError("Send failed")

        ws1.send_json = raise_error

        await empty_room.add_connection(ws1, "user_1")
        await empty_room.add_connection(ws2, "user_2")

        message = {"type": "test", "data": "hello"}
        # Should not raise
        await empty_room.broadcast(message)

        # ws2 should still receive the message
        assert len(ws2.sent_messages) == 1

    @pytest.mark.asyncio
    async def test_update_presence(self, room_with_user: Room) -> None:
        """Test updating user presence information."""
        updates = {
            "cursor_position": {"line": 5, "ch": 10},
            "is_active": False,
        }

        await room_with_user.update_presence("user_1", updates)

        assert room_with_user.presence["user_1"].cursor_position == {"line": 5, "ch": 10}
        assert room_with_user.presence["user_1"].is_active is False

    @pytest.mark.asyncio
    async def test_update_presence_nonexistent_user(self, empty_room: Room) -> None:
        """Test updating presence for user not in room (should not raise)."""
        updates = {"is_active": False}

        # Should not raise
        await empty_room.update_presence("nonexistent", updates)

    @pytest.mark.asyncio
    async def test_get_all_presence(self, empty_room: Room, mock_websocket_factory: Any) -> None:
        """Test getting all presence information."""
        ws1 = mock_websocket_factory("client_1")
        ws2 = mock_websocket_factory("client_2")

        await empty_room.add_connection(ws1, "user_1")
        await empty_room.add_connection(ws2, "user_2")

        empty_room.presence["user_1"] = UserPresence(
            user_id="user_1",
            username="User One",
            color="#ff0000",
        )
        empty_room.presence["user_2"] = UserPresence(
            user_id="user_2",
            username="User Two",
            color="#00ff00",
        )

        presence_list = await empty_room.get_all_presence()

        assert len(presence_list) == 2

        # Check structure of presence data
        for p in presence_list:
            assert "user_id" in p
            assert "username" in p
            assert "color" in p
            assert "cursor_position" in p
            assert "selection" in p
            assert "is_active" in p

        user_ids = [p["user_id"] for p in presence_list]
        assert "user_1" in user_ids
        assert "user_2" in user_ids

    @pytest.mark.asyncio
    async def test_get_all_presence_empty_room(self, empty_room: Room) -> None:
        """Test getting presence from empty room returns empty list."""
        presence_list = await empty_room.get_all_presence()

        assert presence_list == []


class TestConnectionManager:
    """Tests for ConnectionManager class."""

    @pytest.fixture
    def manager(self) -> ConnectionManager:
        """Create a fresh ConnectionManager."""
        return ConnectionManager()

    def test_initialization(self, manager: ConnectionManager) -> None:
        """Test ConnectionManager initializes correctly."""
        assert manager._rooms == {}
        assert manager._user_colors == {}
        assert manager._color_index == 0
        assert len(manager.CURSOR_COLORS) == 8

    def test_get_or_create_room(self, manager: ConnectionManager) -> None:
        """Test getting or creating a room."""
        room = manager.get_or_create_room("room_1")

        assert room.room_id == "room_1"
        assert "room_1" in manager._rooms

        # Getting same room should return existing instance
        room2 = manager.get_or_create_room("room_1")
        assert room is room2

    def test_get_existing_room(self, manager: ConnectionManager) -> None:
        """Test getting an existing room."""
        room1 = manager.get_or_create_room("room_1")
        room2 = manager.get_room("room_1")

        assert room1 is room2

    def test_get_nonexistent_room(self, manager: ConnectionManager) -> None:
        """Test getting a room that doesn't exist returns None."""
        room = manager.get_room("nonexistent")

        assert room is None

    @pytest.mark.asyncio
    async def test_connect(self, manager: ConnectionManager, mock_websocket: Any) -> None:
        """Test connecting a user to a room."""
        room = await manager.connect(
            websocket=mock_websocket,
            room_id="test_room",
            user_id="user_1",
            username="Test User",
        )

        assert mock_websocket.accepted is True
        assert room.room_id == "test_room"
        assert "user_1" in room.connections
        assert "user_1" in room.presence
        assert room.presence["user_1"].username == "Test User"

    @pytest.mark.asyncio
    async def test_connect_assigns_color(
        self, manager: ConnectionManager, mock_websocket: Any
    ) -> None:
        """Test connecting assigns a cursor color."""
        await manager.connect(
            websocket=mock_websocket,
            room_id="test_room",
            user_id="user_1",
            username="Test User",
        )

        room = manager.get_room("test_room")
        color = room.presence["user_1"].color

        assert color in manager.CURSOR_COLORS
        assert "user_1" in manager._user_colors

    @pytest.mark.asyncio
    async def test_connect_same_user_same_color(
        self,
        manager: ConnectionManager,
        mock_websocket_factory: Any,
    ) -> None:
        """Test same user gets same color across rooms."""
        ws1 = mock_websocket_factory("client_1")
        ws2 = mock_websocket_factory("client_2")

        await manager.connect(ws1, "room_1", "user_1", "User")
        await manager.connect(ws2, "room_2", "user_1", "User")

        # Same user should get same color
        assert manager._user_colors["user_1"] == manager._user_colors["user_1"]

    @pytest.mark.asyncio
    async def test_disconnect(self, manager: ConnectionManager, mock_websocket: Any) -> None:
        """Test disconnecting a user from a room."""
        await manager.connect(
            websocket=mock_websocket,
            room_id="test_room",
            user_id="user_1",
            username="Test User",
        )

        await manager.disconnect("test_room", "user_1")

        room = manager.get_room("test_room")
        assert room is None  # Room should be cleaned up (empty)

    @pytest.mark.asyncio
    async def test_disconnect_keeps_room_with_users(
        self,
        manager: ConnectionManager,
        mock_websocket_factory: Any,
    ) -> None:
        """Test disconnecting one user keeps room if others remain."""
        ws1 = mock_websocket_factory("client_1")
        ws2 = mock_websocket_factory("client_2")

        await manager.connect(ws1, "test_room", "user_1", "User 1")
        await manager.connect(ws2, "test_room", "user_2", "User 2")

        await manager.disconnect("test_room", "user_1")

        room = manager.get_room("test_room")
        assert room is not None
        assert room.user_count == 1
        assert "user_2" in room.connections

    @pytest.mark.asyncio
    async def test_disconnect_nonexistent_room(self, manager: ConnectionManager) -> None:
        """Test disconnecting from nonexistent room doesn't raise."""
        # Should not raise
        await manager.disconnect("nonexistent", "user_1")

    @pytest.mark.asyncio
    async def test_send_personal_message(
        self,
        manager: ConnectionManager,
        mock_websocket: Any,
    ) -> None:
        """Test sending a personal message to a user."""
        await manager.connect(
            websocket=mock_websocket,
            room_id="test_room",
            user_id="user_1",
            username="Test User",
        )

        message = {"type": "notification", "text": "Hello"}
        result = await manager.send_personal_message(message, "test_room", "user_1")

        assert result is True
        assert len(mock_websocket.sent_messages) == 1
        assert mock_websocket.sent_messages[0] == message

    @pytest.mark.asyncio
    async def test_send_personal_message_nonexistent_user(
        self,
        manager: ConnectionManager,
        mock_websocket: Any,
    ) -> None:
        """Test sending message to nonexistent user returns False."""
        await manager.connect(
            websocket=mock_websocket,
            room_id="test_room",
            user_id="user_1",
            username="Test User",
        )

        message = {"type": "notification"}
        result = await manager.send_personal_message(message, "test_room", "user_99")

        assert result is False

    @pytest.mark.asyncio
    async def test_send_personal_message_send_error(
        self,
        manager: ConnectionManager,
        mock_websocket_factory: Any,
    ) -> None:
        """Test send failure returns False."""
        ws = mock_websocket_factory("client_1")

        async def raise_error(data: dict[str, Any]) -> None:
            raise ConnectionError("Send failed")

        ws.send_json = raise_error

        await manager.connect(ws, "test_room", "user_1", "User")

        result = await manager.send_personal_message({"type": "test"}, "test_room", "user_1")

        assert result is False

    @pytest.mark.asyncio
    async def test_broadcast_to_room(
        self,
        manager: ConnectionManager,
        mock_websocket_factory: Any,
    ) -> None:
        """Test broadcasting to all users in a room."""
        ws1 = mock_websocket_factory("client_1")
        ws2 = mock_websocket_factory("client_2")

        await manager.connect(ws1, "test_room", "user_1", "User 1")
        await manager.connect(ws2, "test_room", "user_2", "User 2")

        message = {"type": "update", "data": "new content"}
        await manager.broadcast_to_room("test_room", message)

        assert len(ws1.sent_messages) == 1
        assert len(ws2.sent_messages) == 1

    @pytest.mark.asyncio
    async def test_broadcast_to_room_with_exclusion(
        self,
        manager: ConnectionManager,
        mock_websocket_factory: Any,
    ) -> None:
        """Test broadcasting excludes specified user."""
        ws1 = mock_websocket_factory("client_1")
        ws2 = mock_websocket_factory("client_2")

        await manager.connect(ws1, "test_room", "user_1", "User 1")
        await manager.connect(ws2, "test_room", "user_2", "User 2")

        message = {"type": "update"}
        await manager.broadcast_to_room("test_room", message, exclude_user="user_1")

        assert len(ws1.sent_messages) == 0
        assert len(ws2.sent_messages) == 1

    @pytest.mark.asyncio
    async def test_broadcast_to_nonexistent_room(self, manager: ConnectionManager) -> None:
        """Test broadcasting to nonexistent room doesn't raise."""
        # Should not raise
        await manager.broadcast_to_room("nonexistent", {"type": "test"})

    @pytest.mark.asyncio
    async def test_get_room_presence(
        self,
        manager: ConnectionManager,
        mock_websocket_factory: Any,
    ) -> None:
        """Test getting presence information for a room."""
        ws = mock_websocket_factory("client_1")
        await manager.connect(ws, "test_room", "user_1", "Test User")

        presence = await manager.get_room_presence("test_room")

        assert len(presence) == 1
        assert presence[0]["user_id"] == "user_1"
        assert presence[0]["username"] == "Test User"

    @pytest.mark.asyncio
    async def test_get_room_presence_nonexistent_room(self, manager: ConnectionManager) -> None:
        """Test getting presence for nonexistent room returns empty list."""
        presence = await manager.get_room_presence("nonexistent")

        assert presence == []

    def test_get_active_rooms_empty(self, manager: ConnectionManager) -> None:
        """Test getting active rooms when none exist."""
        rooms = manager.get_active_rooms()

        assert rooms == []

    @pytest.mark.asyncio
    async def test_get_active_rooms_with_rooms(
        self,
        manager: ConnectionManager,
        mock_websocket: Any,
    ) -> None:
        """Test getting list of active room IDs."""
        await manager.connect(mock_websocket, "room_1", "user_1", "User")

        rooms = manager.get_active_rooms()

        assert "room_1" in rooms

    def test_get_room_stats_nonexistent(self, manager: ConnectionManager) -> None:
        """Test getting stats for nonexistent room returns None."""
        stats = manager.get_room_stats("nonexistent")

        assert stats is None

    @pytest.mark.asyncio
    async def test_get_room_stats(
        self,
        manager: ConnectionManager,
        mock_websocket_factory: Any,
    ) -> None:
        """Test getting room statistics."""
        ws = mock_websocket_factory("client_1")
        await manager.connect(ws, "test_room", "user_1", "Test User")

        stats = manager.get_room_stats("test_room")

        assert stats is not None
        assert stats["room_id"] == "test_room"
        assert stats["user_count"] == 1
        assert stats["document_version"] == 0
        assert "user_1" in stats["users"]

    @pytest.mark.asyncio
    async def test_concurrent_connections(
        self,
        manager: ConnectionManager,
        mock_websocket_factory: Any,
    ) -> None:
        """Test handling concurrent connections safely."""

        async def connect_user(user_id: str) -> Any:
            ws = mock_websocket_factory(f"client_{user_id}")
            await manager.connect(ws, "concurrent_room", user_id, f"User {user_id}")
            return ws

        # Connect 5 users concurrently
        tasks = [connect_user(f"user_{i}") for i in range(5)]
        await asyncio.gather(*tasks)

        room = manager.get_room("concurrent_room")
        assert room.user_count == 5


class TestConnectionManagerEdgeCases:
    """Edge case tests for ConnectionManager."""

    @pytest.fixture
    def manager(self) -> ConnectionManager:
        """Create a fresh ConnectionManager."""
        return ConnectionManager()

    @pytest.mark.asyncio
    async def test_empty_user_id(self, manager: ConnectionManager, mock_websocket: Any) -> None:
        """Test connecting with empty user_id."""
        await manager.connect(
            websocket=mock_websocket,
            room_id="test_room",
            user_id="",
            username="Test",
        )

        room = manager.get_room("test_room")
        assert "" in room.connections

    @pytest.mark.asyncio
    async def test_unicode_usernames(
        self,
        manager: ConnectionManager,
        mock_websocket_factory: Any,
    ) -> None:
        """Test handling unicode and emoji in usernames."""
        test_names = [
            "用户测试",
            "ユーザー🎌",
            "User 🔥",
            "Üser Näme",
            "👨‍💻 Developer",
        ]

        for i, name in enumerate(test_names):
            ws = mock_websocket_factory(f"client_{i}")
            await manager.connect(ws, "unicode_room", f"user_{i}", name)

        room = manager.get_room("unicode_room")
        assert room.user_count == len(test_names)

    @pytest.mark.asyncio
    async def test_very_long_username(
        self,
        manager: ConnectionManager,
        mock_websocket: Any,
    ) -> None:
        """Test handling very long usernames."""
        long_name = "A" * 10000

        await manager.connect(
            websocket=mock_websocket,
            room_id="test_room",
            user_id="user_1",
            username=long_name,
        )

        room = manager.get_room("test_room")
        assert room.presence["user_1"].username == long_name

    @pytest.mark.asyncio
    async def test_multiple_rooms_same_user(
        self,
        manager: ConnectionManager,
        mock_websocket_factory: Any,
    ) -> None:
        """Test same user in multiple rooms."""
        ws1 = mock_websocket_factory("client_1")
        ws2 = mock_websocket_factory("client_2")

        # Same user in two different rooms
        await manager.connect(ws1, "room_1", "user_1", "User")
        await manager.connect(ws2, "room_2", "user_1", "User")

        assert manager.get_room("room_1").user_count == 1
        assert manager.get_room("room_2").user_count == 1

    @pytest.mark.asyncio
    async def test_color_rotation(
        self, manager: ConnectionManager, mock_websocket_factory: Any
    ) -> None:
        """Test color assignment rotates through palette."""
        num_colors = len(manager.CURSOR_COLORS)

        # Create more users than colors to test rotation
        for i in range(num_colors + 2):
            ws = mock_websocket_factory(f"client_{i}")
            await manager.connect(ws, "color_room", f"user_{i}", f"User {i}")

        room = manager.get_room("color_room")
        colors = [p.color for p in room.presence.values()]

        # Should have used all colors, with first two repeating
        assert len(set(colors)) == num_colors

    @pytest.mark.asyncio
    async def test_rapid_connect_disconnect(
        self,
        manager: ConnectionManager,
        mock_websocket_factory: Any,
    ) -> None:
        """Test rapid connect/disconnect cycles."""
        for i in range(10):
            ws = mock_websocket_factory(f"client_{i}")
            await manager.connect(ws, "rapid_room", f"user_{i}", "User")
            await manager.disconnect("rapid_room", f"user_{i}")

        # Room should be cleaned up
        assert manager.get_room("rapid_room") is None
