"""Streak API Schema definitions.

Pydantic models for Streak API request/response validation.
"""

from pydantic import BaseModel


class StreakResponse(BaseModel):
    """Response schema for user streak."""

    current_streak_days: int
    longest_streak_days: int
    streak_start_date: str | None
    last_activity_date: str | None
    grace_used: bool


class StreakUpdateRequest(BaseModel):
    """Request schema for updating streak."""

    pass
