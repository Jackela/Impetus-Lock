"""SQLAlchemy implementation of TransactionSupport.

Commits the injected AsyncSession so application services finish their
write operations without touching SQLAlchemy themselves.

Constitutional Compliance:
- Article IV (SOLID - DIP): Implements the domain TransactionSupport port
- Article V (Documentation): Complete Google-style docstrings
"""

from sqlalchemy.ext.asyncio import AsyncSession

from server.domain.transactions import TransactionSupport


class SqlAlchemyTransaction(TransactionSupport):
    """Transaction support backed by a SQLAlchemy async session.

    Attributes:
        _session: SQLAlchemy async session (injected via constructor).
    """

    def __init__(self, session: AsyncSession) -> None:
        """Initialize with the session that owns the pending unit of work.

        Args:
            session: SQLAlchemy async session (constructor injection for DIP).
        """
        self._session = session

    async def commit(self) -> None:
        """Commit the session's current unit of work."""
        await self._session.commit()
