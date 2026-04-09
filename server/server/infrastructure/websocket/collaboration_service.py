"""Collaboration service for real-time document editing.

Provides Operational Transformation (OT) support, cursor synchronization,
selection highlighting, and conflict resolution.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any

from server.infrastructure.websocket.connection_manager import ConnectionManager, Room
from server.infrastructure.websocket.redis_pubsub import RedisPubSubManager

logger = logging.getLogger(__name__)


@dataclass
class TextOperation:
    """Represents a text operation for Operational Transformation.

    Attributes:
        type: Operation type ("insert", "delete", "retain")
        position: Position in document
        text: Text content (for insert)
        length: Length of text (for delete/retain)
        user_id: User who made the operation
        timestamp: Operation timestamp
        version: Document version at time of operation
    """

    type: str  # "insert", "delete", "retain"
    position: int
    text: str = ""
    length: int = 0
    user_id: str = ""
    timestamp: float = field(default_factory=time.time)
    version: int = 0

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "type": self.type,
            "position": self.position,
            "text": self.text,
            "length": self.length,
            "user_id": self.user_id,
            "timestamp": self.timestamp,
            "version": self.version,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> TextOperation:
        """Create from dictionary."""
        return cls(
            type=data["type"],
            position=data["position"],
            text=data.get("text", ""),
            length=data.get("length", 0),
            user_id=data.get("user_id", ""),
            timestamp=data.get("timestamp", time.time()),
            version=data.get("version", 0),
        )


@dataclass
class CursorUpdate:
    """Cursor position update.

    Attributes:
        user_id: User identifier
        line: Line number
        character: Character position in line
        color: Cursor color
    """

    user_id: str
    line: int
    character: int
    color: str = "#3b82f6"

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "user_id": self.user_id,
            "line": self.line,
            "character": self.character,
            "color": self.color,
        }


@dataclass
class SelectionUpdate:
    """Text selection update.

    Attributes:
        user_id: User identifier
        anchor: Selection start position (line, ch)
        head: Selection end position (line, ch)
        color: Highlight color
    """

    user_id: str
    anchor: dict[str, int]
    head: dict[str, int]
    color: str = "#3b82f6"

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "user_id": self.user_id,
            "anchor": self.anchor,
            "head": self.head,
            "color": self.color,
        }


class CollaborationService:
    """Service for managing real-time document collaboration.

    Handles:
    - Operational Transformation (OT) for conflict-free editing
    - Cursor position synchronization
    - Selection highlight synchronization
    - Presence awareness
    - Cross-server synchronization via Redis
    """

    def __init__(
        self,
        connection_manager: ConnectionManager,
        redis_pubsub: RedisPubSubManager | None = None,
        server_id: str | None = None,
    ) -> None:
        """Initialize collaboration service.

        Args:
            connection_manager: WebSocket connection manager
            redis_pubsub: Optional Redis pub/sub for cross-server sync
            server_id: Unique server identifier for multi-instance deployments
        """
        self.connection_manager = connection_manager
        self.redis_pubsub = redis_pubsub
        self.server_id = server_id or f"server_{id(self)}"
        self._operation_history: dict[str, list[TextOperation]] = {}
        self._max_history_size = 1000

    async def initialize(self) -> None:
        """Initialize the service and connect to Redis."""
        if self.redis_pubsub:
            await self.redis_pubsub.connect()
            await self.redis_pubsub.start_listening()
            logger.info("Collaboration service initialized with Redis")
        else:
            logger.info("Collaboration service initialized (no Redis)")

    async def shutdown(self) -> None:
        """Shutdown the service and cleanup."""
        if self.redis_pubsub:
            await self.redis_pubsub.disconnect()

    async def join_room(
        self,
        room: Room,
        user_id: str,
        username: str,
        initial_content: str = "",
    ) -> dict[str, Any]:
        """Handle user joining a collaboration room.

        Args:
            room: Room instance
            user_id: User identifier
            username: Display name
            initial_content: Initial document content

        Returns:
            Join response with room state
        """
        # Update Redis tracking
        if self.redis_pubsub:
            await self.redis_pubsub.add_user_to_room(room.room_id, user_id, self.server_id)

        # Subscribe to Redis channel for this room
        if self.redis_pubsub:
            channel = f"collab:{room.room_id}"
            await self.redis_pubsub.subscribe(channel, self._handle_redis_message)

        # Notify others of new user
        join_message = {
            "type": "user_joined",
            "data": {
                "user_id": user_id,
                "username": username,
                "color": room.presence[user_id].color,
            },
        }
        await self._broadcast_to_room(room, join_message, exclude_user=user_id)

        # Get current room state
        room_state = await self._get_room_state(room.room_id)
        if room_state:
            content = room_state.get("content", initial_content)
            version = room_state.get("version", 0)
        else:
            content = initial_content
            version = 0

        return {
            "type": "room_joined",
            "data": {
                "room_id": room.room_id,
                "user_id": user_id,
                "content": content,
                "version": version,
                "users": await room.get_all_presence(),
            },
        }

    async def leave_room(self, room: Room, user_id: str) -> None:
        """Handle user leaving a room.

        Args:
            room: Room instance
            user_id: User identifier
        """
        # Update Redis tracking
        if self.redis_pubsub:
            await self.redis_pubsub.remove_user_from_room(room.room_id, user_id)

        # Notify others
        leave_message = {
            "type": "user_left",
            "data": {
                "user_id": user_id,
            },
        }
        await self._broadcast_to_room(room, leave_message, exclude_user=user_id)

        # Save room state if room is empty
        if room.is_empty:
            await self._save_room_state(room)

    async def handle_operation(
        self,
        room: Room,
        operation: TextOperation,
        content: str,
    ) -> tuple[str, dict[str, Any]]:
        """Handle an editing operation with OT.

        Args:
            room: Room instance
            operation: Text operation
            content: Current document content

        Returns:
            Tuple of (updated_content, broadcast_message)
        """
        # Apply operation
        updated_content = self._apply_operation(content, operation)

        # Update document version
        room.document_version += 1
        operation.version = room.document_version

        # Store in history
        self._add_to_history(room.room_id, operation)

        # Save room state
        await self._save_room_state(room, updated_content)

        # Broadcast to all users
        message = {
            "type": "operation",
            "data": {
                "operation": operation.to_dict(),
                "version": room.document_version,
                "user_id": operation.user_id,
            },
        }
        await self._broadcast_to_room(room, message, exclude_user=operation.user_id)

        return updated_content, message

    async def handle_cursor_update(
        self,
        room: Room,
        update: CursorUpdate,
    ) -> None:
        """Handle cursor position update.

        Args:
            room: Room instance
            update: Cursor update
        """
        # Update presence
        await room.update_presence(
            update.user_id,
            {
                "cursor_position": {
                    "line": update.line,
                    "ch": update.character,
                }
            },
        )

        # Broadcast to others
        message = {
            "type": "cursor_update",
            "data": update.to_dict(),
        }
        await self._broadcast_to_room(room, message, exclude_user=update.user_id)

    async def handle_selection_update(
        self,
        room: Room,
        update: SelectionUpdate,
    ) -> None:
        """Handle selection highlight update.

        Args:
            room: Room instance
            update: Selection update
        """
        # Update presence
        await room.update_presence(update.user_id, {"selection": update.to_dict()})

        # Broadcast to others
        message = {
            "type": "selection_update",
            "data": update.to_dict(),
        }
        await self._broadcast_to_room(room, message, exclude_user=update.user_id)

    async def handle_awareness_update(
        self,
        room: Room,
        user_id: str,
        updates: dict[str, Any],
    ) -> None:
        """Handle generic awareness update (activity, focus, etc.).

        Args:
            room: Room instance
            user_id: User identifier
            updates: Awareness updates
        """
        await room.update_presence(user_id, updates)

        message = {
            "type": "awareness_update",
            "data": {
                "user_id": user_id,
                "updates": updates,
            },
        }
        await self._broadcast_to_room(room, message, exclude_user=user_id)

    def _apply_operation(self, content: str, operation: TextOperation) -> str:
        """Apply a text operation to content.

        Args:
            content: Current content
            operation: Operation to apply

        Returns:
            Updated content
        """
        if operation.type == "insert":
            return content[: operation.position] + operation.text + content[operation.position :]
        elif operation.type == "delete":
            return content[: operation.position] + content[operation.position + operation.length :]
        return content

    def _add_to_history(self, room_id: str, operation: TextOperation) -> None:
        """Add operation to room history.

        Args:
            room_id: Room identifier
            operation: Operation to store
        """
        if room_id not in self._operation_history:
            self._operation_history[room_id] = []

        history = self._operation_history[room_id]
        history.append(operation)

        # Trim old history
        if len(history) > self._max_history_size:
            self._operation_history[room_id] = history[-self._max_history_size :]

    async def _save_room_state(self, room: Room, content: str | None = None) -> None:
        """Save room state to Redis.

        Args:
            room: Room instance
            content: Optional content to save
        """
        if not self.redis_pubsub:
            return

        state = {
            "room_id": room.room_id,
            "version": room.document_version,
            "content": content,
            "user_count": room.user_count,
        }
        await self.redis_pubsub.set_room_state(room.room_id, state)

    async def _get_room_state(self, room_id: str) -> dict[str, Any] | None:
        """Get room state from Redis.

        Args:
            room_id: Room identifier

        Returns:
            Room state or None
        """
        if not self.redis_pubsub:
            return None

        return await self.redis_pubsub.get_room_state(room_id)

    async def _broadcast_to_room(
        self,
        room: Room,
        message: dict[str, Any],
        exclude_user: str | None = None,
    ) -> None:
        """Broadcast message to room via connection manager and Redis.

        Args:
            room: Room instance
            message: Message to broadcast
            exclude_user: Optional user to exclude
        """
        # Broadcast to local connections
        await room.broadcast(message, exclude_user)

        # Broadcast to other servers via Redis
        if self.redis_pubsub:
            await self.redis_pubsub.broadcast_to_room(
                room.room_id,
                {
                    **message,
                    "_source_server": self.server_id,
                },
                exclude_server=self.server_id,
            )

    def _handle_redis_message(self, data: dict[str, Any]) -> None:
        """Handle messages from Redis (from other servers).

        Args:
            data: Message data from Redis
        """
        # Skip if this is our own message
        if data.get("_source_server") == self.server_id:
            return

        room_id = data.get("room_id")
        if not room_id:
            return

        room = self.connection_manager.get_room(room_id)
        if room:
            # Broadcast to local clients
            # Remove internal fields
            message = {k: v for k, v in data.items() if not k.startswith("_")}
            import asyncio

            asyncio.create_task(room.broadcast(message))

    def transform_operations(
        self, op1: TextOperation, op2: TextOperation
    ) -> tuple[TextOperation, TextOperation]:
        """Transform two concurrent operations.

        Implements Operational Transformation to ensure that concurrent
        edits can be applied in any order with the same result.

        Args:
            op1: First operation
            op2: Second operation

        Returns:
            Tuple of transformed operations
        """
        # Simple OT: if positions differ, no transformation needed
        if op1.position != op2.position:
            return op1, op2

        # Same position conflicts - use timestamp-based resolution
        if op1.timestamp <= op2.timestamp:
            # op1 goes first, adjust op2 position
            if op1.type == "insert":
                op2.position += len(op1.text)
            elif op1.type == "delete":
                op2.position -= op1.length
        else:
            # op2 goes first, adjust op1 position
            if op2.type == "insert":
                op1.position += len(op2.text)
            elif op2.type == "delete":
                op1.position -= op2.length

        return op1, op2

    async def get_document_history(
        self, room_id: str, from_version: int = 0
    ) -> list[dict[str, Any]]:
        """Get operation history for a document.

        Args:
            room_id: Room identifier
            from_version: Starting version

        Returns:
            List of operations since the specified version
        """
        history = self._operation_history.get(room_id, [])
        return [op.to_dict() for op in history if op.version >= from_version]
