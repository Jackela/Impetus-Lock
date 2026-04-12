"""API Schema definitions.

Pydantic models for request/response validation.

Constitutional Compliance:
- Article I (Simplicity): Flat schema hierarchy, no unnecessary abstractions
- Article V (Documentation): Complete docstrings for all schemas
"""

from server.api.schemas.task import (
    InterventionActionResponse,
    InterventionHistoryResponse,
    TaskCreateRequest,
    TaskListResponse,
    TaskResponse,
    TaskUpdateRequest,
)

__all__ = [
    "TaskCreateRequest",
    "TaskUpdateRequest",
    "TaskResponse",
    "TaskListResponse",
    "InterventionActionResponse",
    "InterventionHistoryResponse",
]
