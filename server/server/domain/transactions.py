"""Transaction support abstraction.

Application services finish write operations by committing through this
port; the caller injects a concrete implementation (or the no-op default
when no transactional session exists). This keeps a single commit per
operation inside the service layer.

Constitutional Compliance:
- Article IV (SOLID - DIP): Services depend on this abstraction
- Article V (Documentation): Complete Google-style docstrings
"""

from abc import ABC, abstractmethod


class TransactionSupport(ABC):
    """Port for committing the current unit of work."""

    @abstractmethod
    async def commit(self) -> None:
        """Commit the current unit of work."""


class NullTransaction(TransactionSupport):
    """No-op transaction support for session-less (fallback) persistence."""

    async def commit(self) -> None:
        """Do nothing; there is no transactional session to commit."""
