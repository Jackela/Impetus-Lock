"""Achievement API Schema definitions.

Pydantic models for Achievement API request/response validation.
"""

from pydantic import BaseModel, Field


class AchievementResponse(BaseModel):
    """Response schema for achievement."""

    id: str
    achievement_type: str
    name: str
    description: str
    earned_at: str
    metadata: dict | None = None


class AchievementListResponse(BaseModel):
    """Response schema for achievement list."""

    total: int
    limit: int
    offset: int
    achievements: list[AchievementResponse]


class AchievementDefinition(BaseModel):
    """Definition of an achievement type."""

    achievement_type: str
    name: str
    description: str
    icon: str | None = None


class AchievementDefinitionsResponse(BaseModel):
    """Response schema for achievement definitions list."""

    achievements: list[AchievementDefinition]
