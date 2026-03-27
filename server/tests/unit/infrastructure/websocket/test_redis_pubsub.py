"""Tests for RedisPubSubManager.

Tests Redis pub/sub functionality, message handling, room state management,
and cross-server synchronization capabilities.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
from typing import Any
from unittest.mock import AsyncMock, Mock, patch

import pytest
import pytest_asyncio

from server.infrastructure.websocket.redis_pubsub import RedisPubSubManager


class TestRedisPubSubManagerInitialization:
    """Tests for RedisPubSubManager initialization."""

    def test_default_initialization(self) -> None:
        """Test initialization with default values."""
        manager = RedisPubSubManager()

        assert manager.redis_url == "redis://localhost:6379/0"
        assert manager._redis is None
        assert manager._pubsub is None
        assert manager._message_handlers == {}
        assert manager._running is False

    def test_custom_url_initialization(self) -> None:
        """Test initialization with custom Redis URL."""
        custom_url = "redis://custom:6380/1"
        manager = RedisPubSubManager(redis_url=custom_url)

        assert manager.redis_url == custom_url

    def test_url_from_environment(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Test URL from environment variable."""
        monkeypatch.setenv("REDIS_URL", "redis://env-host:6379/5")

        manager = RedisPubSubManager()

        assert manager.redis_url == "redis://env-host:6379/5"


class TestRedisPubSubManagerConnection:
    """Tests for Redis connection management."""

    @pytest_asyncio.fixture
    async def connected_manager(self, mock_redis_client: Mock) -> RedisPubSubManager:
        """Create a connected manager with mocked Redis."""
        manager = RedisPubSubManager(redis_url="redis://localhost:6379/0")

        with patch("redis.asyncio.from_url", return_value=mock_redis_client):
            await manager.connect()
            yield manager
            await manager.disconnect()

    @pytest.mark.asyncio
    async def test_connect_success(self, mock_redis_client: Mock) -> None:
        """Test successful connection to Redis."""
        manager = RedisPubSubManager()

        with patch("redis.asyncio.from_url", return_value=mock_redis_client):
            await manager.connect()

            assert manager._redis is not None
            assert manager._pubsub is not None

    @pytest.mark.asyncio
    async def test_connect_failure(self) -> None:
        """Test connection failure raises exception."""
        manager = RedisPubSubManager()

        with (
            patch("redis.asyncio.from_url", side_effect=ConnectionError("Redis down")),
            pytest.raises(ConnectionError, match="Redis down"),
        ):
            await manager.connect()
            with pytest.raises(ConnectionError, match="Redis down"):
                await manager.connect()

    @pytest.mark.asyncio
    async def test_disconnect(self, mock_redis_client: Mock) -> None:
        """Test disconnection from Redis."""
        manager = RedisPubSubManager()

        with patch("redis.asyncio.from_url", return_value=mock_redis_client):
            await manager.connect()
            await manager.disconnect()

            assert manager._running is False
            mock_redis_client.close.assert_called_once()


class TestRedisPubSubManagerSubscription:
    """Tests for pub/sub subscription management."""

    @pytest.mark.asyncio
    async def test_subscribe_new_channel(
        self,
        mock_redis_client: Mock,
    ) -> None:
        """Test subscribing to a new channel."""
        manager = RedisPubSubManager()

        handler_called = False

        def handler(data: dict[str, Any]) -> None:
            nonlocal handler_called
            handler_called = True

        with patch("redis.asyncio.from_url", return_value=mock_redis_client):
            await manager.connect()
            await manager.subscribe("test_channel", handler)

            assert "test_channel" in manager._message_handlers
            assert handler in manager._message_handlers["test_channel"]
            mock_redis_client.pubsub.return_value.subscribe.assert_called_once_with("test_channel")

    @pytest.mark.asyncio
    async def test_subscribe_multiple_handlers(
        self,
        mock_redis_client: Mock,
    ) -> None:
        """Test multiple handlers for same channel."""
        manager = RedisPubSubManager()

        def handler1(data: dict[str, Any]) -> None:
            pass

        def handler2(data: dict[str, Any]) -> None:
            pass

        with patch("redis.asyncio.from_url", return_value=mock_redis_client):
            await manager.connect()
            await manager.subscribe("test_channel", handler1)
            await manager.subscribe("test_channel", handler2)

            assert len(manager._message_handlers["test_channel"]) == 2

    @pytest.mark.asyncio
    async def test_subscribe_before_connect(self) -> None:
        """Test subscribing before connecting raises error."""
        manager = RedisPubSubManager()

        def handler(data: dict[str, Any]) -> None:
            pass

        with pytest.raises(RuntimeError, match="not initialized"):
            await manager.subscribe("test_channel", handler)

    @pytest.mark.asyncio
    async def test_unsubscribe(
        self,
        mock_redis_client: Mock,
    ) -> None:
        """Test unsubscribing from a channel."""
        manager = RedisPubSubManager()

        def handler(data: dict[str, Any]) -> None:
            pass

        with patch("redis.asyncio.from_url", return_value=mock_redis_client):
            await manager.connect()
            await manager.subscribe("test_channel", handler)
            await manager.unsubscribe("test_channel")

            assert "test_channel" not in manager._message_handlers
            mock_redis_client.pubsub.return_value.unsubscribe.assert_called_once_with(
                "test_channel"
            )

    @pytest.mark.asyncio
    async def test_unsubscribe_not_subscribed(
        self,
        mock_redis_client: Mock,
    ) -> None:
        """Test unsubscribing from channel not subscribed to (should not raise)."""
        manager = RedisPubSubManager()

        with patch("redis.asyncio.from_url", return_value=mock_redis_client):
            await manager.connect()
            # Should not raise
            await manager.unsubscribe("nonexistent_channel")


class TestRedisPubSubManagerPublishing:
    """Tests for message publishing."""

    @pytest.mark.asyncio
    async def test_publish_success(
        self,
        mock_redis_client: Mock,
    ) -> None:
        """Test successful message publishing."""
        manager = RedisPubSubManager()

        with patch("redis.asyncio.from_url", return_value=mock_redis_client):
            await manager.connect()

            message = {"type": "test", "data": "hello"}
            await manager.publish("test_channel", message)

            mock_redis_client.publish.assert_called_once()
            call_args = mock_redis_client.publish.call_args
            assert call_args[0][0] == "test_channel"
            assert json.loads(call_args[0][1]) == message

    @pytest.mark.asyncio
    async def test_publish_before_connect(self) -> None:
        """Test publishing before connecting raises error."""
        manager = RedisPubSubManager()

        with pytest.raises(RuntimeError, match="not initialized"):
            await manager.publish("test_channel", {"type": "test"})

    @pytest.mark.asyncio
    async def test_publish_failure(
        self,
        mock_redis_client: Mock,
    ) -> None:
        """Test publish failure is logged but doesn't raise."""
        manager = RedisPubSubManager()
        mock_redis_client.publish = AsyncMock(side_effect=ConnectionError("Redis down"))

        with patch("redis.asyncio.from_url", return_value=mock_redis_client):
            await manager.connect()
            # Should not raise
            await manager.publish("test_channel", {"type": "test"})


class TestRedisPubSubManagerListening:
    """Tests for message listening."""

    @pytest.mark.asyncio
    async def test_listen_before_connect(self) -> None:
        """Test listening before connecting raises error."""
        manager = RedisPubSubManager()

        with pytest.raises(RuntimeError, match="not initialized"):
            await manager.start_listening()

    @pytest.mark.asyncio
    async def test_listen_starts_task(
        self,
        mock_redis_client: Mock,
    ) -> None:
        """Test listening starts background task."""
        manager = RedisPubSubManager()

        with patch("redis.asyncio.from_url", return_value=mock_redis_client):
            await manager.connect()
            await manager.start_listening()

            assert manager._running is True
            assert manager._listener_task is not None

            await manager.disconnect()

    @pytest.mark.asyncio
    async def test_listen_receives_message(
        self,
        mock_redis_client: Mock,
    ) -> None:
        """Test listener receives and dispatches messages."""
        manager = RedisPubSubManager()
        handler_called = asyncio.Event()
        received_data = None

        async def handler(data: dict[str, Any]) -> None:
            nonlocal received_data
            received_data = data
            handler_called.set()

        # Mock pubsub to return a message
        mock_pubsub = Mock()
        mock_pubsub.get_message = AsyncMock(
            side_effect=[
                {
                    "type": "message",
                    "channel": "test_channel",
                    "data": json.dumps({"message": "hello"}),
                },
                asyncio.CancelledError(),  # Stop the loop
            ]
        )
        mock_redis_client.pubsub = Mock(return_value=mock_pubsub)

        with patch("redis.asyncio.from_url", return_value=mock_redis_client):
            await manager.connect()
            await manager.subscribe("test_channel", handler)

            # Run listener briefly
            manager._running = True
            try:
                await asyncio.wait_for(manager._listen(), timeout=1.0)
            except asyncio.CancelledError:
                pass
            except TimeoutError:
                pass

    @pytest.mark.asyncio
    async def test_listen_sync_handler(
        self,
        mock_redis_client: Mock,
    ) -> None:
        """Test listener handles synchronous handlers."""
        manager = RedisPubSubManager()
        handler_called = False

        def handler(data: dict[str, Any]) -> None:
            nonlocal handler_called
            handler_called = True

        mock_pubsub = Mock()
        mock_pubsub.get_message = AsyncMock(
            side_effect=[
                {
                    "type": "message",
                    "channel": "test_channel",
                    "data": json.dumps({"message": "hello"}),
                },
                asyncio.CancelledError(),
            ]
        )
        mock_redis_client.pubsub = Mock(return_value=mock_pubsub)

        with patch("redis.asyncio.from_url", return_value=mock_redis_client):
            await manager.connect()
            await manager.subscribe("test_channel", handler)

            manager._running = True
            with contextlib.suppress(TimeoutError, asyncio.CancelledError):
                await asyncio.wait_for(manager._listen(), timeout=1.0)

    @pytest.mark.asyncio
    async def test_listen_handler_error(
        self,
        mock_redis_client: Mock,
    ) -> None:
        """Test listener continues even if handler raises."""
        manager = RedisPubSubManager()

        def handler(data: dict[str, Any]) -> None:
            raise ValueError("Handler error")

        mock_pubsub = Mock()
        mock_pubsub.get_message = AsyncMock(
            side_effect=[
                {
                    "type": "message",
                    "channel": "test_channel",
                    "data": json.dumps({"message": "hello"}),
                },
                asyncio.CancelledError(),
            ]
        )
        mock_redis_client.pubsub = Mock(return_value=mock_pubsub)

        with patch("redis.asyncio.from_url", return_value=mock_redis_client):
            await manager.connect()
            await manager.subscribe("test_channel", handler)

            manager._running = True
            with contextlib.suppress(TimeoutError, asyncio.CancelledError):
                await asyncio.wait_for(manager._listen(), timeout=1.0)
            # Should not raise - error is logged


class TestRedisPubSubManagerRoomOperations:
    """Tests for room-related operations."""

    @pytest.mark.asyncio
    async def test_broadcast_to_room(
        self,
        mock_redis_client: Mock,
    ) -> None:
        """Test broadcasting to a room."""
        manager = RedisPubSubManager()

        with patch("redis.asyncio.from_url", return_value=mock_redis_client):
            await manager.connect()

            message = {"type": "update", "data": "test"}
            await manager.broadcast_to_room("room_123", message, exclude_server="server_1")

            mock_redis_client.publish.assert_called_once()
            call_args = mock_redis_client.publish.call_args
            published_message = json.loads(call_args[0][1])

            assert published_message["type"] == "update"
            assert published_message["_exclude_server"] == "server_1"

    @pytest.mark.asyncio
    async def test_set_room_state(
        self,
        mock_redis_client: Mock,
    ) -> None:
        """Test setting room state."""
        manager = RedisPubSubManager()

        with patch("redis.asyncio.from_url", return_value=mock_redis_client):
            await manager.connect()

            state = {"room_id": "room_123", "version": 5, "content": "test content"}
            await manager.set_room_state("room_123", state)

            mock_redis_client.setex.assert_called_once()
            call_args = mock_redis_client.setex.call_args
            assert call_args[0][0] == "room_state:room_123"
            assert json.loads(call_args[0][2]) == state

    @pytest.mark.asyncio
    async def test_set_room_state_no_redis(self) -> None:
        """Test setting room state without Redis (no-op)."""
        manager = RedisPubSubManager()
        # Don't connect

        state = {"room_id": "room_123", "version": 5}
        await manager.set_room_state("room_123", state)  # Should not raise

    @pytest.mark.asyncio
    async def test_get_room_state(
        self,
        mock_redis_client: Mock,
    ) -> None:
        """Test getting room state."""
        manager = RedisPubSubManager()
        state_data = {"room_id": "room_123", "version": 5}
        mock_redis_client.get = AsyncMock(return_value=json.dumps(state_data))

        with patch("redis.asyncio.from_url", return_value=mock_redis_client):
            await manager.connect()

            state = await manager.get_room_state("room_123")

            assert state == state_data

    @pytest.mark.asyncio
    async def test_get_room_state_not_found(
        self,
        mock_redis_client: Mock,
    ) -> None:
        """Test getting room state that doesn't exist."""
        manager = RedisPubSubManager()
        mock_redis_client.get = AsyncMock(return_value=None)

        with patch("redis.asyncio.from_url", return_value=mock_redis_client):
            await manager.connect()

            state = await manager.get_room_state("nonexistent")

            assert state is None

    @pytest.mark.asyncio
    async def test_add_user_to_room(
        self,
        mock_redis_client: Mock,
    ) -> None:
        """Test adding user to room tracking."""
        manager = RedisPubSubManager()

        with patch("redis.asyncio.from_url", return_value=mock_redis_client):
            await manager.connect()

            await manager.add_user_to_room("room_123", "user_456", "server_1")

            mock_redis_client.hset.assert_called_once_with(
                "room_users:room_123", "user_456", "server_1"
            )
            mock_redis_client.expire.assert_called_once()

    @pytest.mark.asyncio
    async def test_remove_user_from_room(
        self,
        mock_redis_client: Mock,
    ) -> None:
        """Test removing user from room tracking."""
        manager = RedisPubSubManager()

        with patch("redis.asyncio.from_url", return_value=mock_redis_client):
            await manager.connect()

            await manager.remove_user_from_room("room_123", "user_456")

            mock_redis_client.hdel.assert_called_once_with("room_users:room_123", "user_456")

    @pytest.mark.asyncio
    async def test_get_room_servers(
        self,
        mock_redis_client: Mock,
    ) -> None:
        """Test getting room server mapping."""
        manager = RedisPubSubManager()
        mock_data = {"user_1": "server_1", "user_2": "server_1", "user_3": "server_2"}
        mock_redis_client.hgetall = AsyncMock(return_value=mock_data)

        with patch("redis.asyncio.from_url", return_value=mock_redis_client):
            await manager.connect()

            servers = await manager.get_room_servers("room_123")

            assert servers == mock_data

    @pytest.mark.asyncio
    async def test_get_room_user_count(
        self,
        mock_redis_client: Mock,
    ) -> None:
        """Test getting room user count."""
        manager = RedisPubSubManager()
        mock_redis_client.hlen = AsyncMock(return_value=5)

        with patch("redis.asyncio.from_url", return_value=mock_redis_client):
            await manager.connect()

            count = await manager.get_room_user_count("room_123")

            assert count == 5

    @pytest.mark.asyncio
    async def test_get_room_user_count_no_redis(self) -> None:
        """Test getting user count without Redis."""
        manager = RedisPubSubManager()
        # Don't connect

        count = await manager.get_room_user_count("room_123")

        assert count == 0


class TestRedisPubSubManagerEdgeCases:
    """Edge case tests for RedisPubSubManager."""

    @pytest.mark.asyncio
    async def test_empty_message_data(
        self,
        mock_redis_client: Mock,
    ) -> None:
        """Test handling empty message data."""
        manager = RedisPubSubManager()

        def handler(data: dict[str, Any]) -> None:
            pass

        mock_pubsub = Mock()
        mock_pubsub.get_message = AsyncMock(
            side_effect=[
                {
                    "type": "message",
                    "channel": "test_channel",
                    "data": "{}",  # Empty JSON object
                },
                asyncio.CancelledError(),
            ]
        )
        mock_redis_client.pubsub = Mock(return_value=mock_redis_client)
        mock_redis_client.pubsub.return_value = mock_pubsub

        with patch("redis.asyncio.from_url", return_value=mock_redis_client):
            await manager.connect()
            await manager.subscribe("test_channel", handler)

            manager._running = True
            with contextlib.suppress(TimeoutError, asyncio.CancelledError):
                await asyncio.wait_for(manager._listen(), timeout=1.0)

    @pytest.mark.asyncio
    async def test_unicode_in_messages(
        self,
        mock_redis_client: Mock,
    ) -> None:
        """Test handling unicode and emoji in messages."""
        manager = RedisPubSubManager()

        received_data = None

        async def handler(data: dict[str, Any]) -> None:
            nonlocal received_data
            received_data = data

        unicode_message = {"text": "Hello 👋 世界 🌍", "emoji": "🎉🎊"}
        mock_pubsub = Mock()
        mock_pubsub.get_message = AsyncMock(
            side_effect=[
                {
                    "type": "message",
                    "channel": "test_channel",
                    "data": json.dumps(unicode_message),
                },
                asyncio.CancelledError(),
            ]
        )
        mock_redis_client.pubsub = Mock(return_value=mock_pubsub)

        with patch("redis.asyncio.from_url", return_value=mock_redis_client):
            await manager.connect()
            await manager.subscribe("test_channel", handler)

            manager._running = True
            with contextlib.suppress(TimeoutError, asyncio.CancelledError):
                await asyncio.wait_for(manager._listen(), timeout=1.0)

    @pytest.mark.asyncio
    async def test_very_large_message(
        self,
        mock_redis_client: Mock,
    ) -> None:
        """Test handling very large messages."""
        manager = RedisPubSubManager()

        def handler(data: dict[str, Any]) -> None:
            pass

        large_content = "x" * 100000  # 100KB
        large_message = {"type": "large", "content": large_content}

        mock_pubsub = Mock()
        mock_pubsub.get_message = AsyncMock(
            side_effect=[
                {
                    "type": "message",
                    "channel": "test_channel",
                    "data": json.dumps(large_message),
                },
                asyncio.CancelledError(),
            ]
        )
        mock_redis_client.pubsub = Mock(return_value=mock_pubsub)

        with patch("redis.asyncio.from_url", return_value=mock_redis_client):
            await manager.connect()
            await manager.subscribe("test_channel", handler)

            manager._running = True
            with contextlib.suppress(TimeoutError, asyncio.CancelledError):
                await asyncio.wait_for(manager._listen(), timeout=2.0)

    @pytest.mark.asyncio
    async def test_concurrent_subscriptions(
        self,
        mock_redis_client: Mock,
    ) -> None:
        """Test handling concurrent subscriptions."""
        manager = RedisPubSubManager()

        def handler(data: dict[str, Any]) -> None:
            pass

        with patch("redis.asyncio.from_url", return_value=mock_redis_client):
            await manager.connect()

            # Subscribe to multiple channels concurrently
            tasks = [manager.subscribe(f"channel_{i}", handler) for i in range(10)]
            await asyncio.gather(*tasks)

            assert len(manager._message_handlers) == 10

    @pytest.mark.asyncio
    async def test_rapid_connect_disconnect(
        self,
        mock_redis_client: Mock,
    ) -> None:
        """Test rapid connect/disconnect cycles."""
        for _i in range(5):
            manager = RedisPubSubManager()

            with patch("redis.asyncio.from_url", return_value=mock_redis_client):
                await manager.connect()
                await manager.disconnect()

                assert manager._redis is None
                assert manager._pubsub is None
