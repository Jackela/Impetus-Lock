"""Regression coverage for the collaboration route's manager dependency assembly."""

from __future__ import annotations

from typing import Any
from unittest.mock import Mock
from uuid import uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from server.api.routes import collaboration


@pytest.mark.asyncio
async def test_route_dependencies_share_members_and_service_broadcasts(
    mock_websocket_factory: Any,
    mock_redis_client: Mock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Two factory-resolved connections share service state and REST membership."""
    # Substitute only external Redis I/O; keep the existing service and real DI factory.
    monkeypatch.setattr(collaboration.redis_pubsub, "_redis", mock_redis_client)
    first_manager = collaboration.get_connection_manager()
    second_manager = collaboration.get_connection_manager()
    first_socket = mock_websocket_factory("r10_alice")
    second_socket = mock_websocket_factory("r10_bob")
    room_id = f"r10-{uuid4()}"
    app = FastAPI()
    app.include_router(collaboration.router)

    try:
        first_room = await first_manager.connect(first_socket, room_id, "alice", "Alice")
        second_room = await second_manager.connect(second_socket, room_id, "bob", "Bob")
        await collaboration.collab_service.handle_awareness_update(
            first_room, "alice", {"is_active": False}
        )

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get(f"/collaboration/rooms/{room_id}/users")
        assert response.status_code == 200

        actual = {
            "shared_room": first_room is second_room,
            "first_uses_service_manager": first_manager
            is collaboration.collab_service.connection_manager,
            "second_uses_service_manager": second_manager
            is collaboration.collab_service.connection_manager,
            "service_members": sorted(
                user["user_id"]
                for user in await collaboration.collab_service.connection_manager.get_room_presence(
                    room_id
                )
            ),
            "rest_members": sorted(user["user_id"] for user in response.json()["users"]),
            "rest_count": response.json()["count"],
            "sender_messages": first_socket.sent_messages,
            "peer_messages": second_socket.sent_messages,
        }
        assert actual == {
            "shared_room": True,
            "first_uses_service_manager": True,
            "second_uses_service_manager": True,
            "service_members": ["alice", "bob"],
            "rest_members": ["alice", "bob"],
            "rest_count": 2,
            "sender_messages": [],
            "peer_messages": [
                {
                    "type": "awareness_update",
                    "data": {"user_id": "alice", "updates": {"is_active": False}},
                }
            ],
        }
    finally:
        await first_manager.disconnect(room_id, "alice")
        await second_manager.disconnect(room_id, "bob")
