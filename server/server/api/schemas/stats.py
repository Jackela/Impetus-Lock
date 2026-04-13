"""Stats API Schema definitions.

Pydantic models for Stats API request/response validation.
"""

from pydantic import BaseModel


class StatsResponse(BaseModel):
    """Response schema for user stats."""

    total_tasks: int
    total_muse_interventions: int
    total_loki_interventions: int
    total_locks_created: int
    writing_minutes: int
    last_activity_at: str | None


class StatsPeriodResponse(BaseModel):
    """Response schema for stats by period."""

    period: str
    tasks_created: int
    interventions: int
    locks_created: int
    writing_minutes: int


class InterventionBreakdownResponse(BaseModel):
    """Response schema for intervention type breakdown."""

    muse_count: int
    loki_count: int
