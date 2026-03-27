"""Collaboration WebSocket and REST API routes.

Provides WebSocket endpoints for real-time collaboration and REST endpoints
for room management and permissions.
"""

from __future__ import annotations

import json
import logging
import os
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.responses import JSONResponse

from server.infrastructure.security.jwt_handler import JWTHandler
from server.infrastructure.websocket.collaboration_service import (
    CollaborationService,
    CursorUpdate,
    SelectionUpdate,
    TextOperation,
)
from server.infrastructure.websocket.connection_manager import ConnectionManager
from server.infrastructure.websocket.redis_pubsub import RedisPubSubManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/collaboration", tags=["collaboration"])

# Initialize Redis pub/sub and collaboration service
redis_pubsub = RedisPubSubManager()
connection_manager = ConnectionManager()
collab_service = CollaborationService(connection_manager, redis_pubsub)


def get_connection_manager() -> ConnectionManager:
    """Dependency factory for ConnectionManager.

    Returns:
        ConnectionManager instance.
    """
    return ConnectionManager()


async def get_current_user_ws(websocket: WebSocket) -> dict[str, Any]:
    """Authenticate WebSocket connection.

    Args:
        websocket: WebSocket connection

    Returns:
        User information dictionary

    Raises:
        HTTPException: If authentication fails
    """
    # Skip auth only in explicit testing mode with proper test key
    if os.getenv("TESTING") == "1" and os.getenv("WEBSOCKET_TEST_MODE") == "enabled":
        return {"user_id": "test_user", "username": "Test User"}

    # Try to get token from query params or cookies
    token = websocket.query_params.get("token")
    if not token:
        token = websocket.cookies.get("access_token")

    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        payload = JWTHandler.verify_token(token)
        return {
            "user_id": payload["sub"],
            "username": payload.get("username", "Anonymous"),
        }
    except Exception as e:
        logger.error(f"WebSocket authentication failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid token") from e


async def check_document_access(user_id: str, document_id: str) -> bool:
    """Check if user has access to a document using JWT and database permissions.

    Args:
        user_id: User identifier
        document_id: Document identifier

    Returns:
        True if user has access, False otherwise
    """
    try:
        from server.infrastructure.persistence.database import get_db_manager

        db_manager = get_db_manager()
        if db_manager is None:
            return False

        async with db_manager.session() as session:
            from sqlalchemy import text

            query = text("""
                SELECT permission FROM document_permissions
                WHERE user_id = :user_id AND document_id = :document_id
            """)
            result = await session.execute(query, {"user_id": user_id, "document_id": document_id})
            row = result.fetchone()

            if row:
                return row[0] in ("read", "write", "admin")

            # Check if user owns the document
            query = text("""
                SELECT owner_id FROM documents WHERE id = :document_id
            """)
            result = await session.execute(query, {"document_id": document_id})
            row = result.fetchone()

            return bool(row and row[0] == user_id)
    except Exception as e:
        logger.error(f"Error checking document access: {e}")
        return False


@router.websocket("/ws/{document_id}")
async def collaboration_websocket(
    websocket: WebSocket,
    document_id: str,
    connection_manager: ConnectionManager = Depends(get_connection_manager),
) -> None:
    """WebSocket endpoint for real-time collaboration.

    Handles:
    - Document editing with OT
    - Cursor position sync
    - Selection highlight sync
    - Presence awareness
    - Room-based isolation

    Args:
        websocket: WebSocket connection
        document_id: Document/room identifier
        connection_manager: Connection manager dependency
    """
    # Authenticate
    try:
        user = await get_current_user_ws(websocket)
    except HTTPException:
        await websocket.close(code=4001, reason="Authentication required")
        return

    user_id = user["user_id"]
    username = user["username"]

    # Check permissions
    if not await check_document_access(user_id, document_id):
        await websocket.close(code=4003, reason="Access denied")
        return

    # Join room
    room = await connection_manager.connect(websocket, document_id, user_id, username)

    try:
        # Initialize collaboration service on first connection
        if redis_pubsub and not redis_pubsub._redis:
            await collab_service.initialize()

        # Handle join
        join_response = await collab_service.join_room(room, user_id, username)
        await websocket.send_json(join_response)

        # Main message loop
        MAX_MESSAGE_SIZE = 1024 * 1024  # 1MB limit
        while True:
            try:
                # Receive text first to check size
                text_data = await websocket.receive_text()
                if len(text_data) > MAX_MESSAGE_SIZE:
                    await websocket.send_json(
                        {
                            "type": "error",
                            "data": {"message": "Message too large"},
                        }
                    )
                    continue
                message = json.loads(text_data)
                await _handle_message(websocket, room, user_id, message, collab_service)
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"Error handling WebSocket message: {e}")
                await websocket.send_json(
                    {
                        "type": "error",
                        "data": {"message": str(e)},
                    }
                )

    except WebSocketDisconnect:
        logger.info(f"User {user_id} disconnected from room {document_id}")
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
    finally:
        # Cleanup
        await collab_service.leave_room(room, user_id)
        await connection_manager.disconnect(document_id, user_id)


# Type alias for message handler functions
MessageHandler = Callable[
    [WebSocket, Any, str, dict[str, Any], CollaborationService], Awaitable[None]
]


class MessageHandlerRegistry:
    """Registry for WebSocket message handlers using Strategy pattern.

    This registry allows registering and dispatching message handlers
    based on message type, eliminating long if-elif chains.
    """

    def __init__(self) -> None:
        self._handlers: dict[str, MessageHandler] = {}

    def register(self, msg_type: str) -> Callable[[MessageHandler], MessageHandler]:
        """Decorator to register a message handler.

        Args:
            msg_type: The message type to handle.

        Returns:
            Decorator function that registers the handler.
        """

        def decorator(handler: MessageHandler) -> MessageHandler:
            self._handlers[msg_type] = handler
            return handler

        return decorator

    async def dispatch(
        self,
        msg_type: str,
        websocket: WebSocket,
        room: Any,
        user_id: str,
        message: dict[str, Any],
        collab_service: CollaborationService,
    ) -> bool:
        """Dispatch message to the appropriate handler.

        Args:
            msg_type: The message type.
            websocket: WebSocket connection.
            room: Room instance.
            user_id: User identifier.
            message: Message data.
            collab_service: Collaboration service instance.

        Returns:
            True if handler was found and executed, False otherwise.
        """
        handler = self._handlers.get(msg_type)
        if handler:
            await handler(websocket, room, user_id, message, collab_service)
            return True
        return False


# Global registry instance
_message_handlers = MessageHandlerRegistry()


@_message_handlers.register("operation")
async def _handle_operation(
    websocket: WebSocket,
    room: Any,
    user_id: str,
    message: dict[str, Any],
    collab_service: CollaborationService,
) -> None:
    """Handle text editing operation.

    Args:
        websocket: WebSocket connection
        room: Room instance
        user_id: User identifier
        message: Message data containing operation details
        collab_service: Collaboration service instance
    """
    data = message.get("data", {})
    op_data = data.get("operation", {})
    operation = TextOperation(
        type=op_data.get("type", "insert"),
        position=op_data.get("position", 0),
        text=op_data.get("text", ""),
        length=op_data.get("length", 0),
        user_id=user_id,
    )
    content = data.get("content", "")
    await collab_service.handle_operation(room, operation, content)


@_message_handlers.register("cursor_update")
async def _handle_cursor_update(
    websocket: WebSocket,
    room: Any,
    user_id: str,
    message: dict[str, Any],
    collab_service: CollaborationService,
) -> None:
    """Handle cursor position update.

    Args:
        websocket: WebSocket connection
        room: Room instance
        user_id: User identifier
        message: Message data containing cursor position
        collab_service: Collaboration service instance
    """
    data = message.get("data", {})
    update = CursorUpdate(
        user_id=user_id,
        line=data.get("line", 0),
        character=data.get("character", 0),
        color=room.presence[user_id].color if user_id in room.presence else "#3b82f6",
    )
    await collab_service.handle_cursor_update(room, update)


@_message_handlers.register("selection_update")
async def _handle_selection_update(
    websocket: WebSocket,
    room: Any,
    user_id: str,
    message: dict[str, Any],
    collab_service: CollaborationService,
) -> None:
    """Handle selection highlight update.

    Args:
        websocket: WebSocket connection
        room: Room instance
        user_id: User identifier
        message: Message data containing selection info
        collab_service: Collaboration service instance
    """
    data = message.get("data", {})
    update = SelectionUpdate(
        user_id=user_id,
        anchor=data.get("anchor", {"line": 0, "ch": 0}),
        head=data.get("head", {"line": 0, "ch": 0}),
        color=room.presence[user_id].color if user_id in room.presence else "#3b82f6",
    )
    await collab_service.handle_selection_update(room, update)


@_message_handlers.register("awareness")
async def _handle_awareness(
    websocket: WebSocket,
    room: Any,
    user_id: str,
    message: dict[str, Any],
    collab_service: CollaborationService,
) -> None:
    """Handle generic awareness updates.

    Args:
        websocket: WebSocket connection
        room: Room instance
        user_id: User identifier
        message: Message data containing awareness info
        collab_service: Collaboration service instance
    """
    data = message.get("data", {})
    await collab_service.handle_awareness_update(room, user_id, data)


@_message_handlers.register("ping")
async def _handle_ping(
    websocket: WebSocket,
    room: Any,
    user_id: str,
    message: dict[str, Any],
    collab_service: CollaborationService,
) -> None:
    """Handle keep-alive ping.

    Args:
        websocket: WebSocket connection
        room: Room instance
        user_id: User identifier
        message: Message data
        collab_service: Collaboration service instance
    """
    await websocket.send_json({"type": "pong"})


async def _handle_message(
    websocket: WebSocket,
    room: Any,
    user_id: str,
    message: dict[str, Any],
    collab_service: CollaborationService,
) -> None:
    """Handle incoming WebSocket messages using Strategy pattern.

    Args:
        websocket: WebSocket connection
        room: Room instance
        user_id: User identifier
        message: Message data
        collab_service: Collaboration service instance
    """
    msg_type = message.get("type")

    # Ensure msg_type is a string
    if not isinstance(msg_type, str):
        msg_type = "unknown"

    # Dispatch to registered handler
    handled = await _message_handlers.dispatch(
        msg_type, websocket, room, user_id, message, collab_service
    )

    if not handled:
        logger.warning(f"Unknown message type: {msg_type}")


@router.get("/rooms/{document_id}/users")
async def get_room_users(
    document_id: str,
    connection_manager: ConnectionManager = Depends(get_connection_manager),
) -> JSONResponse:
    """Get list of users currently in a collaboration room.

    Args:
        document_id: Document/room identifier
        connection_manager: Connection manager dependency

    Returns:
        JSON response with user list
    """
    room = connection_manager.get_room(document_id)
    if not room:
        return JSONResponse({"users": [], "count": 0})

    presence = await room.get_all_presence()
    return JSONResponse(
        {
            "users": presence,
            "count": len(presence),
        }
    )


@router.get("/rooms/{document_id}/stats")
async def get_room_stats(
    document_id: str,
    connection_manager: ConnectionManager = Depends(get_connection_manager),
) -> JSONResponse:
    """Get statistics for a collaboration room.

    Args:
        document_id: Document/room identifier
        connection_manager: Connection manager dependency

    Returns:
        JSON response with room statistics
    """
    stats = connection_manager.get_room_stats(document_id)
    if not stats:
        return JSONResponse(
            {
                "room_id": document_id,
                "user_count": 0,
                "is_active": False,
            }
        )

    return JSONResponse(stats)


@router.get("/rooms/active")
async def get_active_rooms(
    connection_manager: ConnectionManager = Depends(get_connection_manager),
) -> JSONResponse:
    """Get list of all active collaboration rooms.

    Args:
        connection_manager: Connection manager dependency

    Returns:
        JSON response with list of active room IDs
    """
    rooms = connection_manager.get_active_rooms()
    return JSONResponse(
        {
            "rooms": rooms,
            "count": len(rooms),
        }
    )


@router.post("/rooms/{document_id}/permission")
async def update_room_permission(
    document_id: str,
    user_id: str = Query(..., description="User ID to update"),
    permission: str = Query(..., description="Permission level (read, write, admin)"),
) -> JSONResponse:
    """Update user permissions for a room.

    Args:
        document_id: Document/room identifier
        user_id: User to update permissions for
        permission: Permission level (read, write, admin)

    Returns:
        JSON response with result

    Note:
        Full permission persistence requires database schema updates.
        Track as Issue #XXX: Collaboration permission storage.
    """
    # Permission persistence tracked as Issue #XXX
    # Current implementation logs request for audit trail
    logger.info(f"Permission update requested: {user_id} -> {permission} for {document_id}")

    return JSONResponse(
        {
            "success": True,
            "document_id": document_id,
            "user_id": user_id,
            "permission": permission,
            "note": "Permission persistence pending - tracked as Issue #XXX",
        }
    )


@router.get("/health")
async def collaboration_health(
    connection_manager: ConnectionManager = Depends(get_connection_manager),
) -> JSONResponse:
    """Health check for collaboration service.

    Args:
        connection_manager: Connection manager dependency

    Returns:
        JSON response with service status
    """
    active_rooms = len(connection_manager.get_active_rooms())
    redis_connected = redis_pubsub._redis is not None if redis_pubsub else False

    return JSONResponse(
        {
            "status": "ok",
            "active_rooms": active_rooms,
            "redis_connected": redis_connected,
        }
    )
