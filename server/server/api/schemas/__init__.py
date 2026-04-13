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
from server.api.schemas.template import (
    TemplateCreateRequest,
    TemplateListResponse,
    TemplateResponse,
)
from server.api.schemas.achievement import (
    AchievementDefinitionsResponse,
    AchievementListResponse,
    AchievementResponse,
    AchievementDefinition,
)
from server.api.schemas.stats import (
    InterventionBreakdownResponse,
    StatsPeriodResponse,
    StatsResponse,
)
from server.api.schemas.streak import (
    StreakResponse,
    StreakUpdateRequest,
)

__all__ = [
    "TaskCreateRequest",
    "TaskUpdateRequest",
    "TaskResponse",
    "TaskListResponse",
    "InterventionActionResponse",
    "InterventionHistoryResponse",
    "TemplateCreateRequest",
    "TemplateListResponse",
    "TemplateResponse",
    "AchievementDefinitionsResponse",
    "AchievementListResponse",
    "AchievementResponse",
    "AchievementDefinition",
    "StatsResponse",
    "StatsPeriodResponse",
    "InterventionBreakdownResponse",
    "StreakResponse",
    "StreakUpdateRequest",
]
