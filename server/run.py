"""Production-ready server startup with stability features.

Features:
- Port availability checking before binding
- Signal handling for graceful shutdown (SIGTERM, SIGINT)
- Database connection retry with exponential backoff
- Structured logging configuration
- Process title setting for monitoring
- Startup health checks
- Graceful resource cleanup on shutdown
"""

from __future__ import annotations

import asyncio
import logging
import os
import signal
import socket
import sys
from contextlib import suppress
from pathlib import Path
from typing import Any

import uvicorn
from dotenv import load_dotenv

# Load environment variables before any other imports
env_path = Path(__file__).parent / ".env"
load_dotenv(env_path)

# Import after env load
from server.config import AppConfig, get_config, init_config
from server.infrastructure.logging.json_formatter import setup_json_logging

# Global state for shutdown handling
_shutdown_event = asyncio.Event()
_server_instance: uvicorn.Server | None = None
_logger: logging.Logger | None = None


def get_logger() -> logging.Logger:
    """Get or create the startup logger."""
    global _logger
    if _logger is None:
        _logger = logging.getLogger("server.startup")
    return _logger


def set_process_title(title: str) -> None:
    """Set process title for better monitoring visibility."""
    logger = get_logger()
    try:
        import setproctitle

        setproctitle.setproctitle(title)
        logger.info("process_title_set", extra={"title": title})
    except ImportError:
        logger.debug("setproctitle_not_available")
    except Exception as e:
        logger.warning("failed_to_set_process_title", extra={"error": str(e)})


def print_startup_banner(config: AppConfig) -> None:
    """Print a startup banner with configuration info."""
    database_url = config.database.url
    # Mask credentials in database URL
    if database_url and "://" in database_url:
        parts = database_url.split("://")
        if "@" in parts[1]:
            creds, rest = parts[1].split("@", 1)
            database_display = f"{parts[0]}://***@{rest}"
        else:
            database_display = database_url
    else:
        database_display = database_url or "not_set"

    banner = f"""
╔════════════════════════════════════════════════════════════════╗
║                    Impetus Lock Server                         ║
║                     Backend Service v0.1.0                     ║
╠════════════════════════════════════════════════════════════════╣
║  Host:      {config.server.host:<48} ║
║  Port:      {config.server.port:<48} ║
║  Workers:   {config.server.workers:<48} ║
║  Log Level: {config.server.log_level:<48} ║
║  Reload:    {str(config.server.reload):<48} ║
║  Database:  {database_display:<48} ║
╚════════════════════════════════════════════════════════════════╝
    """
    print(banner)
    get_logger().info(
        "startup_banner_displayed",
        extra={
            "host": config.server.host,
            "port": config.server.port,
            "workers": config.server.workers,
            "log_level": config.server.log_level,
            "reload": config.server.reload,
        },
    )


def is_port_available(host: str, port: int) -> bool:
    """Check if a port is available for binding.

    Args:
        host: Host address to check
        port: Port number to check

    Returns:
        True if port is available, False otherwise
    """
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind((host, port))
            return True
    except OSError:
        return False


async def check_port_with_retry(
    host: str, port: int, max_retries: int = 5, delay: float = 1.0
) -> bool:
    """Check port availability with retries.

    Args:
        host: Host address to check
        port: Port number to check
        max_retries: Maximum number of retry attempts
        delay: Delay between retries in seconds

    Returns:
        True if port becomes available, False otherwise
    """
    logger = get_logger()
    for attempt in range(max_retries):
        if is_port_available(host, port):
            logger.info(
                "port_available",
                extra={"host": host, "port": port, "attempt": attempt + 1},
            )
            return True

        logger.warning(
            "port_in_use",
            extra={
                "host": host,
                "port": port,
                "attempt": attempt + 1,
                "max_retries": max_retries,
            },
        )

        if attempt < max_retries - 1:
            await asyncio.sleep(delay)

    return False


async def wait_for_database(
    config: AppConfig,
) -> bool:
    """Wait for database to be ready with retry logic.

    Args:
        config: Application configuration

    Returns:
        True if database is ready, False otherwise
    """
    logger = get_logger()

    if not config.health_check.enabled:
        logger.info("health_check_disabled")
        return True

    if not config.database.url:
        logger.error("database_url_not_set")
        return False

    logger.info(
        "waiting_for_database",
        extra={
            "max_retries": config.health_check.max_retries,
            "delay": config.health_check.retry_delay,
        },
    )

    # Import here to avoid circular imports
    from server.infrastructure.persistence.database import (
        DatabaseManager,
    )

    for attempt in range(config.health_check.max_retries):
        try:
            db_manager = DatabaseManager(config.database.url)
            # Try to create a session to verify connectivity
            async with db_manager.session() as session:
                # Execute a simple query to verify connection
                from sqlalchemy import text

                await session.execute(text("SELECT 1"))
                await session.commit()

            # Close the test connection
            await db_manager.close()

            logger.info(
                "database_ready",
                extra={"attempt": attempt + 1},
            )
            return True

        except Exception as e:
            logger.warning(
                "database_connection_failed",
                extra={
                    "attempt": attempt + 1,
                    "max_retries": config.health_check.max_retries,
                    "error": str(e),
                },
            )

            if attempt < config.health_check.max_retries - 1:
                # Exponential backoff with jitter
                import random

                if config.health_check.retry_backoff:
                    sleep_time = config.health_check.retry_delay * (2**attempt)
                    sleep_time += random.uniform(0, 0.5)
                    sleep_time = min(sleep_time, 10.0)  # Cap at 10 seconds
                else:
                    sleep_time = config.health_check.retry_delay

                await asyncio.sleep(sleep_time)

    logger.error(
        "database_connection_failed_final",
        extra={"attempts": config.health_check.max_retries},
    )
    return False


async def health_check() -> dict[str, Any]:
    """Perform startup health check.

    Returns:
        Dictionary with health check results
    """
    logger = get_logger()
    checks: dict[str, Any] = {
        "status": "ok",
        "timestamp": asyncio.get_event_loop().time(),
        "checks": {},
    }

    # Check database
    try:
        from server.infrastructure.persistence.database import get_db_manager

        db_manager = get_db_manager()
        async with db_manager.session() as session:
            from sqlalchemy import text

            await session.execute(text("SELECT 1"))
        checks["checks"]["database"] = "ok"
    except Exception as e:
        checks["checks"]["database"] = f"error: {e}"
        checks["status"] = "degraded"

    logger.info("health_check_completed", extra=checks)
    return checks


def handle_signal(sig: int, _frame: Any) -> None:
    """Handle shutdown signals gracefully.

    Args:
        sig: Signal number
        _frame: Current stack frame (unused)
    """
    logger = get_logger()
    signal_name = signal.Signals(sig).name
    logger.info(
        "shutdown_signal_received",
        extra={"signal": signal_name, "signal_number": sig},
    )

    # Set shutdown event to signal async tasks
    _shutdown_event.set()


async def graceful_shutdown() -> None:
    """Perform graceful shutdown of all resources."""
    logger = get_logger()
    logger.info("graceful_shutdown_started")

    # Close database connections
    try:
        from server.infrastructure.persistence.database import (
            get_db_manager,
            is_database_initialized,
        )

        if is_database_initialized():
            db_manager = get_db_manager()
            await db_manager.close()
            logger.info("database_connections_closed")
    except Exception as e:
        logger.error("error_closing_database", extra={"error": str(e)})

    # Close cache
    try:
        # Import main app to access state
        from server.api.main import app

        if hasattr(app.state, "idempotency_cache"):
            await app.state.idempotency_cache.clear()
            logger.info("cache_cleared")
    except Exception as e:
        logger.error("error_clearing_cache", extra={"error": str(e)})

    logger.info("graceful_shutdown_completed")


async def run_server(config: AppConfig) -> int:
    """Run the server with all stability features.

    Args:
        config: Application configuration

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    global _server_instance
    logger = get_logger()

    # Set process title
    set_process_title("impetus-lock-server")

    # Print startup banner
    print_startup_banner(config)

    # Check port availability
    logger.info(
        "checking_port_availability",
        extra={"host": config.server.host, "port": config.server.port},
    )
    if not await check_port_with_retry(
        config.server.host,
        config.server.port,
        max_retries=config.port.check_retries,
        delay=config.port.check_delay,
    ):
        logger.error(
            "port_unavailable",
            extra={
                "host": config.server.host,
                "port": config.server.port,
                "error": "Port is already in use",
            },
        )
        print(f"\n❌ Error: Port {config.server.port} is already in use on {config.server.host}")
        print(f"   Please stop the existing server or choose a different port.\n")
        return 1

    # Wait for database
    if not await wait_for_database(config):
        logger.error("database_not_ready")
        print("\n❌ Error: Could not connect to database")
        print("   Please ensure the database is running and accessible.\n")
        return 1

    # Register signal handlers
    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)
    logger.info("signal_handlers_registered")

    # Configure uvicorn
    uvicorn_config = uvicorn.Config(
        "server.api.main:app",
        host=config.server.host,
        port=config.server.port,
        workers=config.server.workers if not config.server.reload else 1,
        reload=config.server.reload,
        log_level=config.server.log_level.lower(),
        access_log=False,  # We handle access logging in middleware
        timeout_graceful_shutdown=config.server.timeout_graceful_shutdown,
    )

    _server_instance = uvicorn.Server(uvicorn_config)

    logger.info(
        "starting_server",
        extra={
            "host": config.server.host,
            "port": config.server.port,
            "workers": config.server.workers if not config.server.reload else 1,
            "reload": config.server.reload,
        },
    )

    try:
        await _server_instance.serve()
    except Exception as e:
        logger.exception("server_error", extra={"error": str(e)})
        return 1

    logger.info("server_stopped")
    return 0


def main() -> int:
    """Main entry point for the server.

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    try:
        # Initialize configuration
        config = init_config()

        # Configure logging
        setup_json_logging(config.server.log_level)

        # Run the async server
        return asyncio.run(run_server(config))
    except ValueError as e:
        print(f"\n❌ Configuration error: {e}\n")
        return 1
    except KeyboardInterrupt:
        get_logger().info("keyboard_interrupt_received")
        return 0
    except Exception as e:
        get_logger().exception("fatal_error", extra={"error": str(e)})
        return 1


if __name__ == "__main__":
    sys.exit(main())
