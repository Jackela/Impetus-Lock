"""Server configuration management.

Provides centralized configuration with environment variable support,
type validation, and sensible defaults.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal, cast

from dotenv import load_dotenv

# Load .env file once at module import
ENV_PATH = Path(__file__).parent.parent.parent / ".env"
load_dotenv(ENV_PATH)


LogLevel = Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]


@dataclass(frozen=True)
class DatabaseConfig:
    """Database connection configuration."""

    url: str
    pool_size: int = 5
    max_overflow: int = 10
    pool_pre_ping: bool = True
    echo: bool = False

    @classmethod
    def from_env(cls) -> DatabaseConfig:
        """Create database config from environment variables."""
        return cls(
            url=os.getenv("DATABASE_URL", ""),
            pool_size=int(os.getenv("DB_POOL_SIZE", "5")),
            max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "10")),
            pool_pre_ping=os.getenv("DB_POOL_PRE_PING", "true").lower()
            in {"1", "true", "yes", "on"},
            echo=os.getenv("DB_ECHO", "false").lower() in {"1", "true", "yes", "on"},
        )


@dataclass(frozen=True)
class ServerConfig:
    """Server runtime configuration."""

    host: str = "127.0.0.1"
    port: int = 8000
    workers: int = 1
    reload: bool = False
    log_level: LogLevel = "INFO"
    timeout_graceful_shutdown: int = 30

    @classmethod
    def from_env(cls) -> ServerConfig:
        """Create server config from environment variables."""
        return cls(
            host=os.getenv("HOST", "127.0.0.1"),
            port=int(os.getenv("PORT", "8000")),
            workers=int(os.getenv("WORKERS", "1")),
            reload=os.getenv("RELOAD", "false").lower() in {"1", "true", "yes", "on"},
            log_level=cls._parse_log_level(os.getenv("LOG_LEVEL", "INFO")),
            timeout_graceful_shutdown=int(os.getenv("SHUTDOWN_TIMEOUT", "30")),
        )

    @staticmethod
    def _parse_log_level(level: str) -> LogLevel:
        """Parse and validate log level."""
        valid_levels: set[LogLevel] = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        level_upper = level.upper()
        if level_upper in valid_levels:
            return cast(LogLevel, level_upper)
        return "INFO"


@dataclass(frozen=True)
class HealthCheckConfig:
    """Health check configuration."""

    enabled: bool = True
    max_retries: int = 30
    retry_delay: float = 1.0
    retry_backoff: bool = True

    @classmethod
    def from_env(cls) -> HealthCheckConfig:
        """Create health check config from environment variables."""
        return cls(
            enabled=os.getenv("HEALTH_CHECK_ENABLED", "true").lower() in {"1", "true", "yes", "on"},
            max_retries=int(os.getenv("MAX_DB_RETRIES", "30")),
            retry_delay=float(os.getenv("DB_RETRY_DELAY", "1.0")),
            retry_backoff=os.getenv("DB_RETRY_BACKOFF", "true").lower()
            in {"1", "true", "yes", "on"},
        )


@dataclass(frozen=True)
class PortConfig:
    """Port availability check configuration."""

    check_retries: int = 5
    check_delay: float = 1.0

    @classmethod
    def from_env(cls) -> PortConfig:
        """Create port config from environment variables."""
        return cls(
            check_retries=int(os.getenv("PORT_CHECK_RETRIES", "5")),
            check_delay=float(os.getenv("PORT_CHECK_DELAY", "1.0")),
        )


@dataclass(frozen=True)
class AppConfig:
    """Application-wide configuration container."""

    database: DatabaseConfig = field(default_factory=DatabaseConfig.from_env)
    server: ServerConfig = field(default_factory=ServerConfig.from_env)
    health_check: HealthCheckConfig = field(default_factory=HealthCheckConfig.from_env)
    port: PortConfig = field(default_factory=PortConfig.from_env)
    testing: bool = field(
        default_factory=lambda: os.getenv("TESTING", "false").lower() in {"1", "true", "yes", "on"}
    )

    def validate(self) -> list[str]:
        """Validate configuration and return list of errors."""
        errors: list[str] = []

        if not self.database.url:
            errors.append("DATABASE_URL is required")

        if self.server.port < 1 or self.server.port > 65535:
            errors.append(f"Invalid port number: {self.server.port}")

        if self.server.workers < 1:
            errors.append(f"Invalid worker count: {self.server.workers}")

        if self.health_check.max_retries < 1:
            errors.append(f"Invalid retry count: {self.health_check.max_retries}")

        return errors

    def is_valid(self) -> bool:
        """Check if configuration is valid."""
        return len(self.validate()) == 0


# Global config instance
_config: AppConfig | None = None


def get_config() -> AppConfig:
    """Get the global configuration instance.

    Returns:
        Application configuration

    Raises:
        RuntimeError: If configuration has not been initialized
    """
    global _config
    if _config is None:
        _config = AppConfig()
    return _config


def init_config(env_file: Path | None = None) -> AppConfig:
    """Initialize configuration, optionally loading from a specific env file.

    Args:
        env_file: Optional path to .env file

    Returns:
        Initialized application configuration
    """
    global _config

    if env_file is not None:
        load_dotenv(env_file)

    _config = AppConfig()

    if not _config.is_valid():
        errors = _config.validate()
        raise ValueError(f"Invalid configuration: {'; '.join(errors)}")

    return _config


def reload_config() -> AppConfig:
    """Reload configuration from environment variables.

    Returns:
        Reloaded application configuration
    """
    global _config
    _config = AppConfig()
    return _config
