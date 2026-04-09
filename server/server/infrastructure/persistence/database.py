"""Database session management for PostgreSQL with resilience patterns.

Provides async session factory, connection management, health checks,
and circuit breaker patterns using SQLAlchemy 2.0.

Constitutional Compliance:
- Article I (Simplicity): Uses framework-native SQLAlchemy patterns
- Article IV (SOLID - SRP): Single responsibility (database connection management)
- Article V (Documentation): Complete Google-style docstrings
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any

import asyncpg
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from tenacity import (
    before_sleep_log,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from server.infrastructure.persistence.models import Base

logger = logging.getLogger("server.database")


class CircuitState(Enum):
    """Circuit breaker states."""

    CLOSED = auto()  # Normal operation
    OPEN = auto()  # Failing, reject requests
    HALF_OPEN = auto()  # Testing if service recovered


@dataclass
class CircuitBreaker:
    """Circuit breaker for database connections."""

    failure_threshold: int = 5
    recovery_timeout: float = 30.0

    _state: CircuitState = field(default=CircuitState.CLOSED, init=False)
    _failure_count: int = field(default=0, init=False)
    _last_failure_time: float | None = field(default=None, init=False)
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock, init=False)

    async def allow_request(self) -> bool:
        """Check if a request should be allowed through."""
        async with self._lock:
            if self._state == CircuitState.OPEN:
                if time.time() - (self._last_failure_time or 0) >= self.recovery_timeout:
                    self._state = CircuitState.HALF_OPEN
                    logger.info("Circuit breaker entering HALF_OPEN state")
                    return True
                return False
            return True

    async def record_success(self) -> None:
        """Record a successful operation."""
        async with self._lock:
            if self._state == CircuitState.HALF_OPEN:
                self._state = CircuitState.CLOSED
                self._failure_count = 0
                logger.info("Circuit breaker CLOSED - database recovered")
            else:
                self._failure_count = 0

    async def record_failure(self) -> None:
        """Record a failed operation."""
        async with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.time()
            if self._failure_count >= self.failure_threshold and self._state != CircuitState.OPEN:
                self._state = CircuitState.OPEN
                logger.error(f"Circuit breaker OPENED after {self.failure_threshold} failures")

    def get_state(self) -> CircuitState:
        """Get current circuit state."""
        return self._state


@dataclass
class PoolMetrics:
    """Database connection pool metrics."""

    size: int
    checked_in: int
    checked_out: int
    overflow: int

    @property
    def utilization(self) -> float:
        """Calculate pool utilization percentage."""
        total = self.size + self.overflow
        if total == 0:
            return 0.0
        return (self.checked_out / total) * 100


@dataclass
class DatabaseHealthStatus:
    """Health check status for database connectivity."""

    is_healthy: bool = False
    response_time_ms: float = 0.0
    last_check: float = 0.0
    error_message: str | None = None
    pool_metrics: PoolMetrics | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert status to dictionary."""
        return {
            "is_healthy": self.is_healthy,
            "response_time_ms": round(self.response_time_ms, 2),
            "last_check": self.last_check,
            "error_message": self.error_message,
            "pool_metrics": {
                "size": self.pool_metrics.size if self.pool_metrics else 0,
                "checked_in": self.pool_metrics.checked_in if self.pool_metrics else 0,
                "checked_out": self.pool_metrics.checked_out if self.pool_metrics else 0,
                "overflow": self.pool_metrics.overflow if self.pool_metrics else 0,
                "utilization": (
                    round(self.pool_metrics.utilization, 2) if self.pool_metrics else 0.0
                ),
            },
        }


class DatabaseManager:
    """Database connection and session management with resilience."""

    PG_ERROR_CODES = {
        "08000": "connection_exception",
        "08003": "connection_does_not_exist",
        "08006": "connection_failure",
        "28P01": "invalid_password",
        "3D000": "invalid_catalog_name",
    }

    def __init__(
        self,
        database_url: str | None = None,
        pool_size: int | None = None,
        max_overflow: int | None = None,
        enable_circuit_breaker: bool = True,
    ):
        """Initialize database manager with connection URL.

        Args:
            database_url: PostgreSQL connection URL. Defaults to DATABASE_URL env var.
            pool_size: Connection pool size. Defaults to POOL_SIZE env var or 5.
            max_overflow: Max overflow connections. Defaults to MAX_OVERFLOW env var or 10.
            enable_circuit_breaker: Enable circuit breaker pattern. Defaults to True.

        Raises:
            ValueError: If database_url not provided and DATABASE_URL env var not set.
        """
        url = database_url or os.getenv("DATABASE_URL")
        if not url:
            raise ValueError("DATABASE_URL environment variable not set")

        self._database_url: str = url
        # P1 Fix: Read pool configuration from environment variables with defaults
        self._pool_size = pool_size if pool_size is not None else int(os.getenv("POOL_SIZE", "5"))
        self._max_overflow = max_overflow if max_overflow is not None else int(os.getenv("MAX_OVERFLOW", "10"))
        self._enable_circuit_breaker = enable_circuit_breaker

        logger.debug(
            f"DatabaseManager initialized with pool_size={self._pool_size}, "
            f"max_overflow={self._max_overflow}"
        )

        self._engine: AsyncEngine | None = None
        self._session_factory: async_sessionmaker[AsyncSession] | None = None
        self._circuit_breaker = CircuitBreaker() if enable_circuit_breaker else None
        self._health_status = DatabaseHealthStatus()
        self._initialized = False

    async def _create_engine(self) -> AsyncEngine:
        """Create async engine with retry logic."""
        logger.info("Creating database engine with retry logic")

        @retry(
            stop=stop_after_attempt(5),
            wait=wait_exponential(multiplier=1, min=1, max=30),
            retry=retry_if_exception_type(
                (
                    OperationalError,
                    asyncpg.PostgresConnectionError,
                    asyncpg.TooManyConnectionsError,
                    asyncpg.ConnectionDoesNotExistError,
                    asyncio.TimeoutError,
                )
            ),
            before_sleep=before_sleep_log(logger, logging.WARNING),
            reraise=True,
        )
        async def create_with_retry() -> AsyncEngine:
            engine = create_async_engine(
                self._database_url,
                echo=False,
                pool_pre_ping=True,
                pool_size=self._pool_size,
                max_overflow=self._max_overflow,
                pool_recycle=3600,
                pool_timeout=30,
            )
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            logger.info("Database engine created successfully")
            return engine

        return await create_with_retry()

    async def initialize(self) -> bool:
        """Initialize database engine with graceful degradation."""
        if self._initialized:
            return True

        try:
            self._engine = await self._create_engine()
            self._session_factory = async_sessionmaker(
                self._engine,
                class_=AsyncSession,
                expire_on_commit=False,
            )
            self._initialized = True
            await self.health_check()
            logger.info("Database manager initialized successfully")
            return True

        except OperationalError as e:
            error_msg = self._parse_error_message(e)
            logger.warning(f"Database initialization failed: {error_msg}")
            return False

        except (asyncpg.PostgresConnectionError, asyncpg.TooManyConnectionsError) as e:
            logger.warning(f"PostgreSQL connection error during initialization: {e}")
            return False

        except (TimeoutError, ConnectionError) as e:
            logger.warning(f"Connection timeout or error during initialization: {e}")
            return False

        except Exception:
            logger.exception("Unexpected error during database initialization")
            return False

    def _parse_error_message(self, error: OperationalError) -> str:
        """Parse PostgreSQL error and return user-friendly message."""
        orig = getattr(error, "orig", None)
        if orig and hasattr(orig, "sqlstate"):
            sqlstate = orig.sqlstate
            error_type = self.PG_ERROR_CODES.get(sqlstate, "unknown")
            if error_type in ("connection_exception", "connection_failure"):
                return "Connection refused - database may be starting or unreachable"
            elif error_type == "connection_does_not_exist":
                return "Connection lost - network issue or database restart"
            elif error_type == "invalid_password":
                return "Authentication failed - check credentials"
            elif error_type == "invalid_catalog_name":
                return "Database does not exist"
        return str(error)

    @property
    def is_initialized(self) -> bool:
        """Check if database manager is initialized."""
        return self._initialized

    async def health_check(self) -> DatabaseHealthStatus:
        """Perform health check and update status."""
        status = DatabaseHealthStatus()
        status.last_check = time.time()

        if not self._initialized or not self._engine:
            status.error_message = "Database manager not initialized"
            self._health_status = status
            return status

        try:
            start_time = time.time()
            async with self._engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            status.response_time_ms = (time.time() - start_time) * 1000
            status.is_healthy = True
            status.pool_metrics = self._get_pool_metrics()
            logger.debug(f"Health check passed: {status.response_time_ms:.2f}ms")
        except OperationalError as e:
            status.error_message = self._parse_error_message(e)
            logger.warning(f"Health check failed: {status.error_message}")
        except (asyncpg.PostgresConnectionError, asyncpg.TooManyConnectionsError) as e:
            status.error_message = f"PostgreSQL connection error: {e}"
            logger.warning(f"Health check failed: {status.error_message}")
        except TimeoutError:
            status.error_message = "Health check timed out"
            logger.warning(f"Health check failed: {status.error_message}")

        self._health_status = status
        return status

    def get_health_status(self) -> DatabaseHealthStatus:
        """Get cached health status."""
        return self._health_status

    @asynccontextmanager
    async def session(self) -> AsyncGenerator[AsyncSession, None]:
        """Create async database session with circuit breaker protection."""
        if not self._initialized or not self._session_factory:
            raise RuntimeError("Database manager not initialized")

        if self._circuit_breaker and not await self._circuit_breaker.allow_request():
            raise RuntimeError("Circuit breaker is OPEN - database requests rejected")

        session: AsyncSession | None = None
        db_connection_error = False
        try:
            session = self._session_factory()
            yield session
            if self._circuit_breaker:
                await self._circuit_breaker.record_success()
        except (
            OperationalError,
            asyncpg.PostgresConnectionError,
            ConnectionError,
            TimeoutError,
            OSError,
        ):
            db_connection_error = True
            if session:
                await session.rollback()
            raise
        except Exception:
            if session:
                await session.rollback()
            raise
        finally:
            if session:
                await session.close()
            if self._circuit_breaker and db_connection_error:
                await self._circuit_breaker.record_failure()

    async def create_tables(self) -> None:
        """Create all database tables."""
        if not self._initialized or not self._engine:
            raise RuntimeError("Database manager not initialized")
        async with self._engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def drop_tables(self) -> None:
        """Drop all database tables."""
        if not self._initialized or not self._engine:
            raise RuntimeError("Database manager not initialized")
        async with self._engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)

    async def close(self) -> None:
        """Close database engine and all connections."""
        if self._engine:
            await self._engine.dispose()
            self._engine = None
            self._session_factory = None
            self._initialized = False
            logger.info("Database engine closed")

    def _get_pool_metrics(self) -> PoolMetrics | None:
        """Get current connection pool metrics."""
        if not self._initialized or not self._engine:
            return None
        try:
            if hasattr(self._engine, "pool"):
                pool = self._engine.pool
                size = getattr(pool, "size", lambda: self._pool_size)()
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

    def get_pool_metrics(self) -> PoolMetrics | None:
        """Get current connection pool metrics."""
        return self._get_pool_metrics()


_db_manager: DatabaseManager | None = None


def get_db_manager() -> DatabaseManager:
    """Get global database manager instance."""
    if _db_manager is None:
        raise RuntimeError("Database manager not initialized")
    return _db_manager


async def init_database(
    database_url: str | None = None,
    graceful: bool = True,
) -> DatabaseManager | None:
    """Initialize global database manager with retry and health check."""
    global _db_manager

    allow_fallback = os.getenv("TESTING") in {"1", "true", "yes", "on"}

    try:
        manager = DatabaseManager(database_url)
        success = await manager.initialize()

        if success:
            _db_manager = manager
            return manager
        elif graceful or allow_fallback:
            logger.warning("Database unavailable, continuing in degraded mode")
            return None
        else:
            raise RuntimeError("Failed to initialize database")

    except ValueError:
        if allow_fallback:
            logger.warning("DATABASE_URL not set - running without database")
            return None
        raise


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for database sessions."""
    if _db_manager is None:
        raise RuntimeError("Database manager not initialized")
    async with _db_manager.session() as session:
        yield session


async def get_session_optional() -> AsyncGenerator[AsyncSession | None, None]:
    """Optional database session dependency."""
    if _db_manager is None:
        yield None
        return
    try:
        async with _db_manager.session() as session:
            yield session
    except RuntimeError:
        yield None


def is_database_initialized() -> bool:
    """Return True if database manager is available."""
    return _db_manager is not None and _db_manager.is_initialized


async def health_check() -> DatabaseHealthStatus:
    """Global health check for database connectivity."""
    if _db_manager is None:
        status = DatabaseHealthStatus()
        status.error_message = "Database manager not initialized"
        return status
    return await _db_manager.health_check()


def get_health_status() -> DatabaseHealthStatus:
    """Get cached health status."""
    if _db_manager is None:
        status = DatabaseHealthStatus()
        status.error_message = "Database manager not initialized"
        return status
    return _db_manager.get_health_status()
