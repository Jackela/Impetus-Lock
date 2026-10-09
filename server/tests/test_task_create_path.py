"""The documented task creation URL must not redirect authenticated unsafe requests."""

from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.api.dependencies import get_task_service
from server.api.routes.tasks import router
from server.application.services.task_service import TaskService
from server.auth.dependencies import get_current_user
from server.infrastructure.persistence.in_memory_task_repository import InMemoryTaskRepository
from server.models.user import User


@pytest.mark.parametrize("path", ["/tasks", "/tasks/"])
def test_documented_create_path_does_not_redirect(path: str) -> None:
    """Both create spellings reach the same owned-task service without a redirect."""
    app = FastAPI()
    app.include_router(router)
    owner = User(id=uuid4(), email="path@example.com", password_hash="test-only")
    service = TaskService(InMemoryTaskRepository())
    app.dependency_overrides[get_current_user] = lambda: owner
    app.dependency_overrides[get_task_service] = lambda: service
    with TestClient(app, follow_redirects=False) as client:
        response = client.post(path, json={"content": "Preserved draft", "lock_ids": []})
    assert response.status_code == 201
    assert response.json()["content"] == "Preserved draft"
