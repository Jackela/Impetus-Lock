"""Streak repository abstraction.

Defines the narrow persistence interface required by StreakService.
Implementations translate between the Streak domain entity and storage.

Constitutional Compliance:
- Article I (Simplicity): Minimal interface, only essential operations
- Article IV (SOLID - DIP): Application layer depends on this abstraction
- Article IV (SOLID - ISP): Interface segregation (focused on streaks)
- Article V (Documentation): Complete Google-style docstrings
"""

from abc import ABC, abstractmethod
from uuid import UUID

from server.domain.entities.streak import Streak


class StreakRepository(ABC):
    """Repository abstraction for user-scoped streak persistence.

    Every operation is scoped to a user id; streaks are unique per user.
    Write operations finish the current commit/refresh sequence before
    returning, matching the historical route behavior.

    Implementations:
        - PostgreSQLStreakRepository: SQLAlchemy async persistence
    """

    @abstractmethod
    async def get_by_user(self, user_id: UUID) -> Streak | None:
        """Get the user's streak row if present.

        Args:
            user_id: User UUID to look up.

        Returns:
            Streak | None: The user's streak, or None when absent.
        """

    @abstractmethod
    async def upsert(self, streak: Streak) -> Streak:
        """Insert or update the user's streak row from the entity's values.

        Finishes the current commit/refresh sequence before returning.

        Args:
            streak: Streak entity carrying the values to persist.

        Returns:
            Streak: Persisted streak as refreshed from storage.
        """
