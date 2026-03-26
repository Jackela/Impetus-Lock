"""Async test helpers and utilities.

Provides utilities for testing async code including timeouts,
event loop management, and resource cleanup. These helpers ensure
async tests run reliably and clean up resources properly.

Example:
    >>> class MyAsyncTest(AsyncTestCase):
    ...     async def test_async_operation(self):
    ...         result = await self.run_async(some_async_function())
    ...         assert result == expected

    >>> @async_timeout(5)
    ... async def test_with_timeout():
    ...     await long_running_operation()
"""

from __future__ import annotations

import asyncio
import functools
import gc
import sys
import warnings
from collections.abc import AsyncGenerator, Callable, Coroutine, Generator
from contextlib import asynccontextmanager, contextmanager
from typing import TYPE_CHECKING, Any, ParamSpec, TypeVar

import pytest

if TYPE_CHECKING:
    from types import TracebackType

T = TypeVar("T")
P = ParamSpec("P")


def async_timeout(
    seconds: float,
) -> Callable[[Callable[P, Coroutine[Any, Any, T]]], Callable[P, Coroutine[Any, Any, T]]]:
    """Decorator to add timeout to async test functions.

    Automatically wraps the async function with asyncio.wait_for
    to prevent hanging tests. Raises asyncio.TimeoutError if the
    operation exceeds the specified timeout.

    Args:
        seconds: Maximum time to wait for the coroutine to complete.

    Returns:
        Decorated function with timeout enforcement.

    Example:
        >>> @async_timeout(5)
        ... async def test_slow_operation():
        ...     await asyncio.sleep(10)  # Will raise TimeoutError
        ...     # Test code here
    """

    def decorator(func: Callable[P, Coroutine[Any, Any, T]]) -> Callable[P, Coroutine[Any, Any, T]]:
        @functools.wraps(func)
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            return await asyncio.wait_for(
                func(*args, **kwargs),
                timeout=seconds,
            )

        return wrapper

    return decorator


class AsyncTestCase:
    """Base class for async test cases with proper event loop management.

    Provides utilities for running async code in tests with automatic
    cleanup of resources and proper exception handling.

    Attributes:
        loop: The event loop used for async operations.
        _tasks: List of tasks created during test for cleanup.

    Example:
        >>> class TestMyService(AsyncTestCase):
        ...     def setup_method(self):
        ...         super().setup_method()
        ...         self.service = MyService()
        ...
        ...     async def test_async_method(self):
        ...         result = await self.service.do_something()
        ...         assert result is not None
        ...
        ...     def test_sync_wrapper(self):
        ...         # Run async test from sync context
        ...         self.run_async(self.test_async_method())
    """

    def __init__(self) -> None:
        """Initialize the test case with empty task list."""
        self.loop: asyncio.AbstractEventLoop | None = None
        self._tasks: list[asyncio.Task[Any]] = []

    def setup_method(self) -> None:
        """Set up the test case before each test method.

        Creates a new event loop and sets it as the current loop.
        """
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)
        self._tasks = []

    def teardown_method(self) -> None:
        """Tear down the test case after each test method.

        Cancels all pending tasks, closes the event loop, and
        runs garbage collection to clean up resources.
        """
        if self.loop is not None:
            # Cancel all pending tasks
            pending = [task for task in self._tasks if not task.done()]
            if pending:
                for task in pending:
                    task.cancel()

                # Wait for tasks to complete cancellation
                self.loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))

            # Close the loop
            try:
                self.loop.run_until_complete(self.loop.shutdown_asyncgens())
            except Exception:
                pass

            self.loop.close()
            asyncio.set_event_loop(None)
            self.loop = None

        # Force garbage collection
        gc.collect()

    def run_async(self, coro: Coroutine[Any, Any, T]) -> T:
        """Run an async coroutine in the test's event loop.

        Allows running async code from sync test methods.

        Args:
            coro: The coroutine to run.

        Returns:
            The result of the coroutine.

        Raises:
            RuntimeError: If the event loop is not initialized.
        """
        if self.loop is None:
            raise RuntimeError("Event loop not initialized. Call setup_method() first.")

        return self.loop.run_until_complete(coro)

    def create_task(self, coro: Coroutine[Any, Any, T]) -> asyncio.Task[T]:
        """Create a task and track it for cleanup.

        Args:
            coro: The coroutine to wrap in a task.

        Returns:
            The created task.

        Raises:
            RuntimeError: If the event loop is not initialized.
        """
        if self.loop is None:
            raise RuntimeError("Event loop not initialized. Call setup_method() first.")

        task = self.loop.create_task(coro)
        self._tasks.append(task)
        return task

    async def gather_with_timeout(
        self,
        *coros: Coroutine[Any, Any, T],
        timeout: float = 30.0,
    ) -> list[T]:
        """Gather multiple coroutines with a timeout.

        Args:
            *coros: Coroutines to gather.
            timeout: Maximum time to wait (default: 30 seconds).

        Returns:
            List of results from the coroutines.

        Raises:
            asyncio.TimeoutError: If any coroutine exceeds the timeout.
        """
        return await asyncio.gather(*[asyncio.wait_for(c, timeout=timeout) for c in coros])


@contextmanager
def cleanup_event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Context manager for creating and cleaning up an event loop.

    Creates a new event loop, yields it for use, then properly
    cleans up all async generators and closes the loop on exit.

    Yields:
        A fresh event loop instance.

    Example:
        >>> with cleanup_event_loop() as loop:
        ...     result = loop.run_until_complete(async_function())
        ...     # Loop is automatically cleaned up after this block
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        yield loop
    finally:
        try:
            # Cancel all pending tasks
            pending = [task for task in asyncio.all_tasks(loop) if not task.done()]
            if pending:
                for task in pending:
                    task.cancel()
                loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))

            # Shutdown async generators
            loop.run_until_complete(loop.shutdown_asyncgens())
        except Exception:
            pass
        finally:
            loop.close()
            asyncio.set_event_loop(None)
            gc.collect()


@asynccontextmanager
async def managed_async_context(
    setup: Callable[[], Coroutine[Any, Any, T]],
    teardown: Callable[[T], Coroutine[Any, Any, None]],
) -> AsyncGenerator[T, None]:
    """Async context manager for resource setup and teardown.

    Provides a structured way to manage async resources with
    guaranteed cleanup even if exceptions occur.

    Args:
        setup: Async function to create the resource.
        teardown: Async function to clean up the resource.

    Yields:
        The resource created by setup.

    Example:
        >>> async def setup_db():
        ...     return await create_connection()
        ...
        >>> async def teardown_db(conn):
        ...     await conn.close()
        ...
        >>> async with managed_async_context(setup_db, teardown_db) as conn:
        ...     await conn.execute("SELECT 1")
    """
    resource = await setup()
    try:
        yield resource
    finally:
        await teardown(resource)


class EventLoopCleanupMixin:
    """Mixin for pytest test classes requiring event loop cleanup.

    Provides automatic cleanup of event loops and async resources
    after each test. Use with pytest-asyncio tests.

    Example:
        >>> @pytest.mark.asyncio
        ... class TestAsyncService(EventLoopCleanupMixin):
        ...     async def test_something(self):
        ...         # Test code here
        ...         # Cleanup happens automatically
    """

    @pytest.fixture(autouse=True)
    def cleanup_loop(self) -> Generator[None, None, None]:
        """Fixture that cleans up the event loop after each test."""
        yield
        # Cleanup after test
        _cleanup_current_loop()


def _cleanup_current_loop() -> None:
    """Clean up the current event loop.

    Internal helper to cancel tasks, shutdown generators, and close loop.
    """
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            return

        # Cancel all pending tasks
        pending = [task for task in asyncio.all_tasks(loop) if not task.done()]
        if pending:
            for task in pending:
                task.cancel()
            # Wait briefly for cancellation
            try:
                loop.run_until_complete(
                    asyncio.wait_for(
                        asyncio.gather(*pending, return_exceptions=True),
                        timeout=1.0,
                    )
                )
            except asyncio.TimeoutError:
                pass

        # Shutdown async generators
        try:
            loop.run_until_complete(loop.shutdown_asyncgens())
        except Exception:
            pass
    except RuntimeError:
        # No event loop running
        pass
    finally:
        gc.collect()


def suppress_async_warnings() -> None:
    """Suppress common asyncio-related warnings in tests.

    Filters out warnings about unclosed event loops and unawaited
    coroutines during test execution.

    Example:
        >>> def setup_module():
        ...     suppress_async_warnings()
    """
    warnings.filterwarnings(
        "ignore",
        message=".*event loop.*",
        category=RuntimeWarning,
    )
    warnings.filterwarnings(
        "ignore",
        message=".*coroutine.*was never awaited.*",
        category=RuntimeWarning,
    )
    warnings.filterwarnings(
        "ignore",
        message=".*unclosed.*",
        category=ResourceWarning,
    )


@contextmanager
def temporary_event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create a temporary event loop for isolated async operations.

    Unlike cleanup_event_loop, this creates a loop without setting
    it as the current loop, useful for testing concurrent operations.

    Yields:
        A fresh event loop instance.

    Example:
        >>> with temporary_event_loop() as loop:
        ...     # This loop is not the current loop
        ...     task = loop.create_task(async_function())
        ...     result = loop.run_until_complete(task)
    """
    loop = asyncio.new_event_loop()
    try:
        yield loop
    finally:
        try:
            # Cancel pending tasks
            pending = [task for task in asyncio.all_tasks(loop) if not task.done()]
            if pending:
                for task in pending:
                    task.cancel()
                loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))

            loop.run_until_complete(loop.shutdown_asyncgens())
        except Exception:
            pass
        finally:
            loop.close()
            gc.collect()


def run_sync(coro: Coroutine[Any, Any, T]) -> T:
    """Run a coroutine synchronously, creating a new event loop if needed.

    Utility function for running async code in sync contexts.
    Creates a new loop if none exists, or uses the existing one.

    Args:
        coro: The coroutine to run.

    Returns:
        The result of the coroutine.

    Example:
        >>> def sync_function():
        ...     result = run_sync(async_function())
        ...     return result
    """
    try:
        loop = asyncio.get_running_loop()
        # We're already in an async context, need to use a thread
        import concurrent.futures

        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(asyncio.run, coro)
            return future.result()
    except RuntimeError:
        # No running loop, we can use asyncio.run
        return asyncio.run(coro)


class AsyncResourceManager:
    """Manager for async resources with automatic cleanup.

    Tracks async resources and ensures they are properly cleaned up
    even if exceptions occur during tests.

    Attributes:
        resources: List of managed (resource, cleanup_func) tuples.

    Example:
        >>> async def test_with_resources():
        ...     manager = AsyncResourceManager()
        ...     conn = await manager.track(create_connection(), lambda c: c.close())
        ...     # Use conn here
        ...     # All resources cleaned up when manager goes out of scope
    """

    def __init__(self) -> None:
        """Initialize the resource manager."""
        self.resources: list[tuple[Any, Callable[[Any], Coroutine[Any, Any, None]]]] = []

    async def track(
        self,
        resource: T,
        cleanup: Callable[[T], Coroutine[Any, Any, None]],
    ) -> T:
        """Track a resource for cleanup.

        Args:
            resource: The resource to track.
            cleanup: Async function to clean up the resource.

        Returns:
            The resource (for convenience).
        """
        self.resources.append((resource, cleanup))
        return resource

    async def cleanup_all(self) -> None:
        """Clean up all tracked resources.

        Runs all cleanup functions and swallows exceptions to ensure
        all resources are attempted to be cleaned up.
        """
        errors: list[Exception] = []

        for resource, cleanup in reversed(self.resources):
            try:
                await cleanup(resource)
            except Exception as e:
                errors.append(e)

        self.resources.clear()

        if errors:
            raise ExceptionGroup("Resource cleanup errors", errors)

    async def __aenter__(self) -> AsyncResourceManager:
        """Enter async context."""
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        """Exit async context and cleanup resources."""
        await self.cleanup_all()


def make_async(func: Callable[P, T]) -> Callable[P, Coroutine[Any, Any, T]]:
    """Convert a sync function to an async function.

    Wraps a synchronous function to make it awaitable.
    Useful for mocking and testing.

    Args:
        func: The synchronous function to wrap.

    Returns:
        An async version of the function.

    Example:
        >>> def sync_add(a: int, b: int) -> int:
        ...     return a + b
        ...
        >>> async_add = make_async(sync_add)
        >>> result = await async_add(1, 2)  # Returns 3
    """

    async def async_wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
        return func(*args, **kwargs)

    return async_wrapper
