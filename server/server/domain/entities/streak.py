"""Streak domain entity.

Framework-agnostic representation of a user's writing streak.
Persistence details (ORM mapping) live in the infrastructure layer.

Note: the grace/recovery rule described in the streaks specification is NOT
implemented by the current calculation; this entity only carries the values
the system persists today.

Constitutional Compliance:
- Article IV (SOLID - SRP): Entity carries data, no persistence concerns
- Article V (Documentation): Complete Google-style docstrings
"""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass
class Streak:
    """A user's consecutive-day writing streak.

    Attributes:
        user_id: Owning user's UUID (one streak row per user).
        current_streak_days: Current consecutive days streak.
        longest_streak_days: Longest streak ever achieved.
        streak_start_date: Start timestamp of the current streak (UTC).
        last_activity_date: Timestamp of the last recorded activity (UTC).
        grace_used: Whether the grace period was used this streak.
        id: Row UUID (assigned by persistence on insert).
    """

    user_id: UUID
    current_streak_days: int = 0
    longest_streak_days: int = 0
    streak_start_date: datetime | None = None
    last_activity_date: datetime | None = None
    grace_used: bool = False
    id: UUID | None = None
