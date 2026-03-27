"""Pytest configuration and fixtures for WebSocket tests.

Provides mock WebSocket connections, room fixtures, and test utilities
for testing WebSocket infrastructure without actual network connections.
"""

from __future__ import annotations

import asyncio
import contextlib
from collections.abc import AsyncGenerator, Generator
from typing import Any
from unittest.mock import AsyncMock, Mock

import pytest
import pytest_asyncio


class MockWebSocket:
    """Mock WebSocket connection for testing.

    Simulates FastAPI WebSocket interface without actual network I/O.
    Records all sent messages for verification.
    """

    def __init__(self, client_id: str = "test_client") -> None:
        """Initialize mock WebSocket.

        Args:
            client_id: Unique identifier for this mock connection.
        """
        self.client_id = client_id
        self.sent_messages: list[dict[str, Any]] = []
        self.closed = False
        self.accepted = False

    async def accept(self) -> None:
        """Accept the WebSocket connection."""
        self.accepted = True

    async def send_json(self, data: dict[str, Any]) -> None:
        """Send JSON message (records for verification).

        Args:
            data: Message data to send.
        """
        if self.closed:
            raise RuntimeError("WebSocket is closed")
        self.sent_messages.append(data)

    async def send_text(self, text: str) -> None:
        """Send text message.

        Args:
            text: Text to send.
        """
        await self.send_json({"type": "text", "data": text})

    async def receive_json(self) -> dict[str, Any]:
        """Receive JSON message (returns empty dict for mock)."""
        return {}

    async def close(self) -> None:
        """Close the WebSocket connection."""
        self.closed = True


@pytest.fixture
def mock_websocket() -> MockWebSocket:
    """Create a mock WebSocket connection.

    Returns:
        MockWebSocket instance ready for testing.
    """
    return MockWebSocket()


@pytest.fixture
def mock_websocket_factory() -> type[MockWebSocket]:
    """Factory for creating multiple mock WebSockets.

    Returns:
        MockWebSocket class for creating instances.
    """
    return MockWebSocket


@pytest.fixture
def connection_manager() -> Any:
    """Create a fresh ConnectionManager instance.

    Returns:
        ConnectionManager with no existing rooms.
    """
    from server.infrastructure.websocket.connection_manager import ConnectionManager

    return ConnectionManager()


@pytest.fixture
def room_factory(connection_manager: Any) -> Any:
    """Factory for creating rooms in the connection manager.

    Args:
        connection_manager: The connection manager to create rooms in.

    Returns:
        Factory function for creating rooms.
    """

    def create_room(room_id: str) -> Any:
        return connection_manager.get_or_create_room(room_id)

    return create_room


@pytest_asyncio.fixture
async def connected_room(
    connection_manager: Any,
    mock_websocket: MockWebSocket,
) -> AsyncGenerator[tuple[Any, MockWebSocket], None]:
    """Create a room with one connected user.

    Args:
        connection_manager: Connection manager fixture.
        mock_websocket: Mock WebSocket fixture.

    Yields:
        Tuple of (room, websocket) for testing.
    """
    room = await connection_manager.connect(
        websocket=mock_websocket,
        room_id="test_room",
        user_id="user_1",
        username="Test User",
    )

    yield room, mock_websocket

    # Cleanup
    with contextlib.suppress(Exception):
        await connection_manager.disconnect("test_room", "user_1")


@pytest_asyncio.fixture
async def multi_user_room(
    connection_manager: Any,
) -> AsyncGenerator[tuple[Any, list[MockWebSocket]], None]:
    """Create a room with multiple connected users.

    Args:
        connection_manager: Connection manager fixture.

    Yields:
        Tuple of (room, list_of_websockets).
    """
    websockets = []

    for i in range(3):
        ws = MockWebSocket(client_id=f"client_{i}")
        await connection_manager.connect(
            websocket=ws,
            room_id="multi_room",
            user_id=f"user_{i}",
            username=f"User {i}",
        )
        websockets.append(ws)

    room = connection_manager.get_room("multi_room")

    yield room, websockets

    # Cleanup
    for i in range(3):
        with contextlib.suppress(Exception):
            await connection_manager.disconnect("multi_room", f"user_{i}")


@pytest.fixture
def mock_redis_client() -> Mock:
    """Create a mock Redis client.

    Returns:
        Mock configured as Redis async client.
    """
    mock = Mock()

    # Create async pubsub mock
    mock_pubsub = Mock()
    mock_pubsub.subscribe = AsyncMock(return_value=None)
    mock_pubsub.unsubscribe = AsyncMock(return_value=None)
    mock_pubsub.close = AsyncMock(return_value=None)
    mock_pubsub.get_message = AsyncMock(return_value=None)

    mock.pubsub = Mock(return_value=mock_pubsub)
    mock.publish = AsyncMock(return_value=1)
    mock.setex = AsyncMock(return_value=True)
    mock.get = AsyncMock(return_value=None)
    mock.hset = AsyncMock(return_value=1)
    mock.hdel = AsyncMock(return_value=1)
    mock.hgetall = AsyncMock(return_value={})
    mock.hlen = AsyncMock(return_value=0)
    mock.incr = AsyncMock(return_value=1)
    mock.expire = AsyncMock(return_value=True)
    mock.close = AsyncMock(return_value=None)

    return mock


@pytest_asyncio.fixture
async def redis_pubsub_manager(mock_redis_client: Mock) -> AsyncGenerator[Any, None]:
    """Create a RedisPubSubManager with mocked Redis.

    Args:
        mock_redis_client: Mock Redis client fixture.

    Yields:
        RedisPubSubManager ready for testing.
    """
    from unittest.mock import patch

    from server.infrastructure.websocket.redis_pubsub import RedisPubSubManager

    manager = RedisPubSubManager(redis_url="redis://localhost:6379/0")

    # Mock the Redis connection
    with patch("redis.asyncio.from_url", return_value=mock_redis_client):
        await manager.connect()
        yield manager
        await manager.disconnect()


@pytest.fixture
def collaboration_service_factory() -> Any:
    """Factory for creating CollaborationService instances.

    Returns:
        Factory function for creating services.
    """
    from server.infrastructure.websocket.collaboration_service import CollaborationService
    from server.infrastructure.websocket.connection_manager import ConnectionManager

    def create_service(
        with_redis: bool = False,
        server_id: str | None = None,
    ) -> Any:
        connection_manager = ConnectionManager()
        redis_pubsub = None

        if with_redis:
            # Will be mocked in actual tests
            from server.infrastructure.websocket.redis_pubsub import RedisPubSubManager

            redis_pubsub = RedisPubSubManager()

        return CollaborationService(
            connection_manager=connection_manager,
            redis_pubsub=redis_pubsub,
            server_id=server_id,
        )

    return create_service


@pytest.fixture
def text_operation_factory() -> Any:
    """Factory for creating TextOperation instances.

    Returns:
        Factory function for creating operations.
    """
    from server.infrastructure.websocket.collaboration_service import TextOperation

    def create_operation(
        op_type: str = "insert",
        position: int = 0,
        text: str = "",
        length: int = 0,
        user_id: str = "user_1",
        version: int = 0,
    ) -> Any:
        return TextOperation(
            type=op_type,
            position=position,
            text=text,
            length=length,
            user_id=user_id,
            version=version,
        )

    return create_operation


@pytest.fixture
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create an instance of the default event loop for each test case.

    Yields:
        Asyncio event loop.
    """
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()
