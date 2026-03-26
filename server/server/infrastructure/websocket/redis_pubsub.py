"""Redis pub/sub manager for cross-server synchronization.

Enables horizontal scaling by broadcasting messages across multiple
server instances via Redis.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Callable
from typing import Any

import redis.asyncio as redis

logger = logging.getLogger(__name__)


class RedisPubSubManager:
    """Manages Redis pub/sub for cross-server WebSocket synchronization.

    Allows multiple server instances to communicate and broadcast
    messages to clients connected to different servers.
    """

    def __init__(self, redis_url: str | None = None) -> None:
        """Initialize Redis pub/sub manager.

        Args:
            redis_url: Redis connection URL. If None, uses config or localhost.
        """
        self.redis_url = redis_url or self._get_redis_url()
        self._redis: redis.Redis | None = None
        self._pubsub: redis.client.PubSub | None = None
        self._message_handlers: dict[str, list[Callable[[dict[str, Any]], Any]]] = {}
        self._running: bool = False
        self._listener_task: asyncio.Task | None = None

    def _get_redis_url(self) -> str:
        """Get Redis URL from environment or use default."""
        import os

        return os.getenv("REDIS_URL", "redis://localhost:6379/0")

    async def connect(self) -> None:
        """Establish Redis connection and initialize pub/sub."""
        try:
            self._redis = redis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True,
            )
            self._pubsub = self._redis.pubsub()
            logger.info(f"Connected to Redis at {self.redis_url}")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise

    async def disconnect(self) -> None:
        """Close Redis connection and cleanup."""
        self._running = False

        if self._listener_task:
            self._listener_task.cancel()
            try:
                await self._listener_task
            except asyncio.CancelledError:
                pass

        if self._pubsub:
            await self._pubsub.close()

        if self._redis:
            await self._redis.close()

        logger.info("Disconnected from Redis")

    async def subscribe(self, channel: str, handler: Callable[[dict[str, Any]], Any]) -> None:
        """Subscribe to a Redis channel.

        Args:
            channel: Channel name (typically "collab:{room_id}")
            handler: Callback function for received messages
        """
        if not self._pubsub:
            raise RuntimeError("Redis pub/sub not initialized. Call connect() first.")

        if channel not in self._message_handlers:
            self._message_handlers[channel] = []
            await self._pubsub.subscribe(channel)
            logger.info(f"Subscribed to channel: {channel}")

        self._message_handlers[channel].append(handler)

    async def unsubscribe(self, channel: str) -> None:
        """Unsubscribe from a Redis channel.

        Args:
            channel: Channel name
        """
        if not self._pubsub:
            return

        if channel in self._message_handlers:
            del self._message_handlers[channel]
            await self._pubsub.unsubscribe(channel)
            logger.info(f"Unsubscribed from channel: {channel}")

    async def publish(self, channel: str, message: dict[str, Any]) -> None:
        """Publish a message to a Redis channel.

        Args:
            channel: Channel name
            message: Message to publish
        """
        if not self._redis:
            raise RuntimeError("Redis not initialized. Call connect() first.")

        try:
            await self._redis.publish(channel, json.dumps(message))
        except Exception as e:
            logger.error(f"Failed to publish message to {channel}: {e}")

    async def start_listening(self) -> None:
        """Start listening for Redis pub/sub messages."""
        if not self._pubsub:
            raise RuntimeError("Redis pub/sub not initialized")

        self._running = True
        self._listener_task = asyncio.create_task(self._listen())

    async def _listen(self) -> None:
        """Background task to listen for Redis messages."""
        if not self._pubsub:
            return

        while self._running:
            try:
                message = await self._pubsub.get_message(
                    ignore_subscribe_messages=True, timeout=1.0
                )
                if message and message["type"] == "message":
                    channel = message["channel"]
                    data = json.loads(message["data"])

                    # Notify all handlers for this channel
                    handlers = self._message_handlers.get(channel, [])
                    for handler in handlers:
                        try:
                            if asyncio.iscoroutinefunction(handler):
                                await handler(data)
                            else:
                                handler(data)
                        except Exception as e:
                            logger.error(f"Error in message handler: {e}")
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in Redis listener: {e}")
                await asyncio.sleep(1)

    async def broadcast_to_room(
        self,
        room_id: str,
        message: dict[str, Any],
        exclude_server: str | None = None,
    ) -> None:
        """Broadcast a message to all servers handling a room.

        Args:
            room_id: Room identifier
            message: Message to broadcast
            exclude_server: Optional server ID to exclude
        """
        channel = f"collab:{room_id}"
        message["_exclude_server"] = exclude_server
        await self.publish(channel, message)

    async def set_room_state(self, room_id: str, state: dict[str, Any]) -> None:
        """Store room state in Redis for persistence.

        Args:
            room_id: Room identifier
            state: Room state to store
        """
        if not self._redis:
            return

        key = f"room_state:{room_id}"
        await self._redis.setex(key, 3600, json.dumps(state))  # 1 hour TTL

    async def get_room_state(self, room_id: str) -> dict[str, Any] | None:
        """Retrieve room state from Redis.

        Args:
            room_id: Room identifier

        Returns:
            Room state or None if not found
        """
        if not self._redis:
            return None

        key = f"room_state:{room_id}"
        data = await self._redis.get(key)
        return json.loads(data) if data else None

    async def add_user_to_room(self, room_id: str, user_id: str, server_id: str) -> None:
        """Track which users are in which rooms on which servers.

        Args:
            room_id: Room identifier
            user_id: User identifier
            server_id: Server identifier
        """
        if not self._redis:
            return

        key = f"room_users:{room_id}"
        await self._redis.hset(key, user_id, server_id)
        await self._redis.expire(key, 3600)  # 1 hour TTL

    async def remove_user_from_room(self, room_id: str, user_id: str) -> None:
        """Remove user from room tracking.

        Args:
            room_id: Room identifier
            user_id: User identifier
        """
        if not self._redis:
            return

        key = f"room_users:{room_id}"
        await self._redis.hdel(key, user_id)

    async def get_room_servers(self, room_id: str) -> dict[str, str]:
        """Get mapping of users to their server IDs for a room.

        Args:
            room_id: Room identifier

        Returns:
            Dictionary mapping user_id to server_id
        """
        if not self._redis:
            return {}

        key = f"room_users:{room_id}"
        data = await self._redis.hgetall(key)
        return data

    async def get_room_user_count(self, room_id: str) -> int:
        """Get total user count across all servers for a room.

        Args:
            room_id: Room identifier

        Returns:
            Number of users in the room
        """
        if not self._redis:
            return 0

        key = f"room_users:{room_id}"
        return int(await self._redis.hlen(key))


# Global Redis pub/sub manager
redis_pubsub = RedisPubSubManager()
