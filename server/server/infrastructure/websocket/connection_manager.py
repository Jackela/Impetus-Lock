"""WebSocket connection manager with room-based isolation.

Manages client connections, rooms, and presence tracking for real-time collaboration.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


@dataclass
class UserPresence:
    """User presence information in a collaboration room.

    Attributes:
        user_id: Unique user identifier
        username: Display name
        color: User's assigned cursor color
        cursor_position: Current cursor position (line, character)
        selection: Current text selection (start, end)
        is_active: Whether user is currently active
        last_activity: Timestamp of last activity
    """

    user_id: str
    username: str
    color: str = "#3b82f6"
    cursor_position: dict[str, int] = field(default_factory=lambda: {"line": 0, "ch": 0})
    selection: dict[str, int] | None = None
    is_active: bool = True
    last_activity: float = field(default_factory=lambda: 0.0)


class Room:
    """A collaboration room for real-time editing.

    Manages connections and state for a single document.
    """

    def __init__(self, room_id: str) -> None:
        """Initialize a new collaboration room.

        Args:
            room_id: Unique identifier for the room (typically document ID)
        """
        self.room_id = room_id
        self.connections: dict[str, WebSocket] = {}
        self.presence: dict[str, UserPresence] = {}
        self.document_version: int = 0
        self._lock = asyncio.Lock()

    async def add_connection(self, websocket: WebSocket, user_id: str) -> None:
        """Add a new connection to the room.

        Args:
            websocket: The WebSocket connection
            user_id: User identifier
        """
        async with self._lock:
            self.connections[user_id] = websocket
        logger.info(f"User {user_id} joined room {self.room_id}")

    async def remove_connection(self, user_id: str) -> None:
        """Remove a connection from the room.

        Args:
            user_id: User identifier
        """
        async with self._lock:
            if user_id in self.connections:
                del self.connections[user_id]
            if user_id in self.presence:
                del self.presence[user_id]
        logger.info(f"User {user_id} left room {self.room_id}")

    async def broadcast(self, message: dict[str, Any], exclude_user: str | None = None) -> None:
        """Broadcast a message to all connected clients.

        Args:
            message: Message to broadcast
            exclude_user: Optional user ID to exclude from broadcast
        """
        for user_id, websocket in self.connections.items():
            if user_id != exclude_user:
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    logger.error(f"Failed to send message to {user_id}: {e}")

    async def update_presence(self, user_id: str, updates: dict[str, Any]) -> None:
        """Update user presence information.

        Args:
            user_id: User identifier
            updates: Dictionary of fields to update
        """
        async with self._lock:
            if user_id in self.presence:
                for key, value in updates.items():
                    setattr(self.presence[user_id], key, value)

    async def get_all_presence(self) -> list[dict[str, Any]]:
        """Get presence info for all users in the room.

        Returns:
            List of presence dictionaries
        """
        async with self._lock:
            return [
                {
                    "user_id": p.user_id,
                    "username": p.username,
                    "color": p.color,
                    "cursor_position": p.cursor_position,
                    "selection": p.selection,
                    "is_active": p.is_active,
                }
                for p in self.presence.values()
            ]

    @property
    def is_empty(self) -> bool:
        """Check if room has no connections."""
        return len(self.connections) == 0

    @property
    def user_count(self) -> int:
        """Get number of connected users."""
        return len(self.connections)


class ConnectionManager:
    """Manages WebSocket connections and rooms.

    Provides room-based isolation for real-time collaboration with
    horizontal scaling support through Redis pub/sub integration.
    """

    # Predefined colors for user cursors
    CURSOR_COLORS = [
        "#3b82f6",  # blue
        "#ef4444",  # red
        "#22c55e",  # green
        "#f59e0b",  # yellow
        "#8b5cf6",  # purple
        "#ec4899",  # pink
        "#14b8a6",  # teal
        "#f97316",  # orange
    ]

    def __init__(self) -> None:
        """Initialize the connection manager."""
        self._rooms: dict[str, Room] = {}
        self._user_colors: dict[str, str] = {}
        self._color_index: int = 0

    def _get_user_color(self, user_id: str) -> str:
        """Get or assign a cursor color for a user.

        Args:
            user_id: User identifier

        Returns:
            Hex color code
        """
        if user_id not in self._user_colors:
            self._user_colors[user_id] = self.CURSOR_COLORS[
                self._color_index % len(self.CURSOR_COLORS)
            ]
            self._color_index += 1
        return self._user_colors[user_id]

    def get_or_create_room(self, room_id: str) -> Room:
        """Get existing room or create a new one.

        Args:
            room_id: Room identifier (typically document ID)

        Returns:
            Room instance
        """
        if room_id not in self._rooms:
            self._rooms[room_id] = Room(room_id)
            logger.info(f"Created new room: {room_id}")
        return self._rooms[room_id]

    def get_room(self, room_id: str) -> Room | None:
        """Get an existing room.

        Args:
            room_id: Room identifier

        Returns:
            Room instance or None if not found
        """
        return self._rooms.get(room_id)

    async def connect(
        self,
        websocket: WebSocket,
        room_id: str,
        user_id: str,
        username: str,
    ) -> Room:
        """Connect a client to a room.

        Args:
            websocket: WebSocket connection
            room_id: Room to join
            user_id: User identifier
            username: Display name

        Returns:
            The joined Room instance
        """
        await websocket.accept()

        room = self.get_or_create_room(room_id)
        await room.add_connection(websocket, user_id)

        # Assign presence
        room.presence[user_id] = UserPresence(
            user_id=user_id,
            username=username,
            color=self._get_user_color(user_id),
        )

        return room

    async def disconnect(self, room_id: str, user_id: str) -> None:
        """Disconnect a client from a room.

        Args:
            room_id: Room identifier
            user_id: User identifier
        """
        room = self._rooms.get(room_id)
        if room:
            await room.remove_connection(user_id)

            # Cleanup empty rooms
            if room.is_empty:
                del self._rooms[room_id]
                logger.info(f"Removed empty room: {room_id}")

    async def send_personal_message(
        self, message: dict[str, Any], room_id: str, user_id: str
    ) -> bool:
        """Send a message to a specific user.

        Args:
            message: Message to send
            room_id: Room identifier
            user_id: Target user ID

        Returns:
            True if message was sent, False otherwise
        """
        room = self._rooms.get(room_id)
        if room and user_id in room.connections:
            try:
                await room.connections[user_id].send_json(message)
                return True
            except Exception as e:
                logger.error(f"Failed to send personal message to {user_id}: {e}")
        return False

    async def broadcast_to_room(
        self,
        room_id: str,
        message: dict[str, Any],
        exclude_user: str | None = None,
    ) -> None:
        """Broadcast a message to all users in a room.

        Args:
            room_id: Room identifier
            message: Message to broadcast
            exclude_user: Optional user to exclude
        """
        room = self._rooms.get(room_id)
        if room:
            await room.broadcast(message, exclude_user)

    async def get_room_presence(self, room_id: str) -> list[dict[str, Any]]:
        """Get presence information for all users in a room.

        Args:
            room_id: Room identifier

        Returns:
            List of presence dictionaries
        """
        room = self._rooms.get(room_id)
        if room:
            return await room.get_all_presence()
        return []

    def get_active_rooms(self) -> list[str]:
        """Get list of all active room IDs.

        Returns:
            List of room IDs
        """
        return list(self._rooms.keys())

    def get_room_stats(self, room_id: str) -> dict[str, Any] | None:
        """Get statistics for a room.

        Args:
            room_id: Room identifier

        Returns:
            Room statistics or None if room doesn't exist
        """
        room = self._rooms.get(room_id)
        if not room:
            return None

        return {
            "room_id": room_id,
            "user_count": room.user_count,
            "document_version": room.document_version,
            "users": list(room.connections.keys()),
        }


# Global connection manager instance
connection_manager = ConnectionManager()
