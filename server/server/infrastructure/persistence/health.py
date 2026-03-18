"""Database health checks for monitoring and observability.

Provides health check functionality and metrics collection for database
connectivity monitoring.

Constitutional Compliance:
- Article I (Simplicity): Simple health check interface
- Article IV (SOLID - SRP): Single responsibility (health checking)
- Article V (Documentation): Complete Google-style docstrings
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncEngine

logger = logging.getLogger("server.database.health")


@dataclass
class PoolMetrics:
    """Database connection pool metrics.

    Attributes:
        size: Current pool size.
        checked_in: Available connections in pool.
        checked_out: Connections currently in use.
        overflow: Overflow connections beyond pool_size.
    """

    size: int = 0
    checked_in: int = 0
    checked_out: int = 0
    overflow: int = 0

    @property
    def utilization(self) -> float:
        """Calculate pool utilization percentage."""
        total = self.size + self.overflow
        if total == 0:
            return 0.0
        return (self.checked_out / total) * 100

    def to_dict(self) -> dict[str, Any]:
        """Convert metrics to dictionary."""
        return {
            "size": self.size,
            "checked_in": self.checked_in,
            "checked_out": self.checked_out,
            "overflow": self.overflow,
            "utilization": round(self.utilization, 2),
        }


@dataclass
class DatabaseHealthStatus:
    """Health check status for database connectivity.

    Attributes:
        is_healthy: Whether database is reachable.
        response_time_ms: Response time of health check query.
        last_check: Timestamp of last health check.
        error_message: Error message if unhealthy.
        pool_metrics: Current connection pool metrics.

    Example:
        ```python
        status = DatabaseHealthStatus()
        status.is_healthy = True
        status.response_time_ms = 2.5
        print(status.to_dict())
        ```
    """

    is_healthy: bool = False
    response_time_ms: float = 0.0
    last_check: float = field(default_factory=time.time)
    error_message: str | None = None
    pool_metrics: PoolMetrics | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert status to dictionary for JSON serialization.

        Returns:
            dict: Health status with all fields serialized.
        """
        return {
            "is_healthy": self.is_healthy,
            "response_time_ms": round(self.response_time_ms, 2),
            "last_check": self.last_check,
            "error_message": self.error_message,
            "pool_metrics": self.pool_metrics.to_dict() if self.pool_metrics else None,
        }


class DatabaseHealthChecker:
    """Database health checker with connection monitoring.

    Performs health checks by executing simple queries and collecting
    connection pool metrics.

    Attributes:
        _engine: SQLAlchemy async engine to check.
        _health_query: Query to execute for health check.

    Example:
        ```python
        checker = DatabaseHealthChecker(engine)
        status = await checker.check()
        if status.is_healthy:
            print(f"DB healthy: {status.response_time_ms}ms")
        ```
    """

    def __init__(self, engine: AsyncEngine, health_query: str = "SELECT 1"):
        """Initialize health checker.

        Args:
            engine: SQLAlchemy async engine.
            health_query: Query to execute for health check.
        """
        self._engine = engine
        self._health_query = health_query

    async def check(self) -> DatabaseHealthStatus:
        """Perform health check and collect metrics.

        Returns:
            DatabaseHealthStatus: Current health status.

        Example:
            ```python
            checker = DatabaseHealthChecker(engine)
            health = await checker.check()
            print(f"Healthy: {health.is_healthy}")
            ```
        """
        status = DatabaseHealthStatus()
        status.last_check = time.time()

        try:
            start_time = time.time()

            async with self._engine.connect() as conn:
                await conn.execute(text(self._health_query))

            status.response_time_ms = (time.time() - start_time) * 1000
            status.is_healthy = True

            # Collect pool metrics
            status.pool_metrics = self._get_pool_metrics()

            logger.debug(f"Health check passed: {status.response_time_ms:.2f}ms")

        except OperationalError as e:
            status.error_message = f"Database connection failed: {e}"
            logger.warning(f"Health check failed: {status.error_message}")

        except (AttributeError, TypeError) as e:
            status.error_message = f"Database engine attribute error: {e}"
            logger.warning(f"Health check failed: {status.error_message}")

        except Exception as e:
            status.error_message = f"Health check error: {e}"
            logger.exception("Unexpected health check error")

        return status

    def _get_pool_metrics(self) -> PoolMetrics | None:
        """Extract pool metrics from SQLAlchemy engine.

        Returns:
            PoolMetrics: Current pool metrics, or None if unavailable.
        """
        try:
            if hasattr(self._engine, "pool"):
                pool = self._engine.pool
                # Get pool info using safe attribute access
                # Different pool types may have different interfaces
                size = getattr(pool, "size", lambda: 0)()
                checked_out = getattr(pool, "checkedout", lambda: 0)()
                checked_in = getattr(pool, "checkedin", lambda: 0)()
                overflow = getattr(pool, "overflow", lambda: 0)()

                return PoolMetrics(
                    size=size,
                    checked_in=checked_in,
                    checked_out=checked_out,
                    overflow=overflow,
                )
        except (AttributeError, TypeError) as e:
            logger.debug(f"Failed to collect pool metrics: {e}")

        return None

    def get_cached_metrics(self) -> PoolMetrics | None:
        """Get pool metrics without performing health check.

        Returns:
            PoolMetrics: Current pool metrics, or None if unavailable.
        """
        return self._get_pool_metrics()
