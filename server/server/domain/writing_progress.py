"""Writing activity and the milestones exposed by the achievements API."""

from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Protocol
from uuid import UUID


@dataclass(frozen=True)
class WritingMilestone:
    """Name, description and threshold for one writing achievement."""

    achievement_type: str
    name: str
    description: str
    counter: Literal["tasks", "muse", "loki", "streak"]
    threshold: int


WRITING_MILESTONES = (
    WritingMilestone("first_task", "First Step", "Create your first task", "tasks", 1),
    WritingMilestone("ten_tasks", "Getting Started", "Create 10 tasks", "tasks", 10),
    WritingMilestone("hundred_tasks", "Century", "Create 100 tasks", "tasks", 100),
    WritingMilestone(
        "first_muse", "Muse Touched", "Receive your first Muse intervention", "muse", 1
    ),
    WritingMilestone(
        "first_loki", "Chaos Embraced", "Receive your first Loki intervention", "loki", 1
    ),
    WritingMilestone(
        "streak_3", "Three Day Streak", "Maintain a 3-day writing streak", "streak", 3
    ),
    WritingMilestone("streak_7", "Week Warrior", "Maintain a 7-day writing streak", "streak", 7),
    WritingMilestone(
        "streak_30", "Monthly Master", "Maintain a 30-day writing streak", "streak", 30
    ),
)


class WritingProgress(Protocol):
    """Record writing activity in the caller's transaction."""

    async def record_task(
        self, user_id: UUID, activity_at: datetime, *, created: bool, added_locks: int
    ) -> None:
        """Record successful task creation or editing."""

    async def record_intervention(
        self, user_id: UUID, mode: Literal["muse", "loki"], activity_at: datetime
    ) -> None:
        """Record a successful intervention saved to a task's history."""
