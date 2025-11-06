"""Idempotency cache manager for preventing duplicate interventions.

Implements 15-second TTL in-memory cache for Idempotency-Key deduplication.
Prevents duplicate AI interventions when client retries due to network errors.

Constitutional Compliance:
- Article I (Simplicity): In-memory cache for P1 (no Redis/external dependency)
- Article V (Documentation): Complete Google-style docstrings
"""

import time
from threading import Lock
from typing import Any


class IdempotencyCache:
    """In-memory cache for idempotency key deduplication.

    Stores intervention responses keyed by Idempotency-Key header (UUID).
    Entries expire after 15 seconds (configurable TTL).

    Thread-safe implementation using threading.Lock for concurrent requests.

    Attributes:
        ttl: Time-to-live in seconds (default: 15).
        cache: Dictionary mapping idempotency keys to (response, expiry_timestamp).
        lock: Thread lock for concurrent access safety.

    Example:
        ```python
        cache = IdempotencyCache(ttl=15)

        # First request
        key = "550e8400-e29b-41d4-a716-446655440000"
        response = generate_intervention(...)
        cache.set(key, response)

        # Retry within 15s (network error)
        cached = cache.get(key)  # Returns cached response
        assert cached == response

        # After 15s
        time.sleep(16)
        assert cache.get(key) is None  # Expired
        ```
    """

    def __init__(self, ttl: int = 15):
        """Initialize idempotency cache with TTL.

        Args:
            ttl: Time-to-live in seconds (default: 15).
        """
        self.ttl = ttl
        self.cache: dict[str, tuple[Any, float]] = {}
        self.lock = Lock()

    def get(self, key: str) -> Any | None:
        """Retrieve cached response if not expired.

        Args:
            key: Idempotency-Key (UUID v4 string).

        Returns:
            Cached response if found and not expired, None otherwise.

        Example:
            >>> cache = IdempotencyCache()
            >>> cache.set("key1", {"action": "provoke"})
            >>> cache.get("key1")
            {'action': 'provoke'}
            >>> time.sleep(16)
            >>> cache.get("key1")
            None
        """
        with self.lock:
            if key not in self.cache:
                return None

            response, expiry = self.cache[key]
            current_time = time.time()

            if current_time > expiry:
                del self.cache[key]
                return None

            return response

    def set(self, key: str, response: Any) -> None:
        """Store response in cache with TTL expiry.

        Args:
            key: Idempotency-Key (UUID v4 string).
            response: Intervention response to cache (typically InterventionResponse).

        Example:
            >>> cache = IdempotencyCache(ttl=10)
            >>> cache.set("key1", {"action": "delete"})
            >>> cache.get("key1")
            {'action': 'delete'}
        """
        with self.lock:
            expiry = time.time() + self.ttl
            self.cache[key] = (response, expiry)

    def clear(self) -> None:
        """Clear all cached entries (useful for testing).

        Example:
            >>> cache = IdempotencyCache()
            >>> cache.set("key1", {"action": "provoke"})
            >>> cache.clear()
            >>> cache.get("key1")
            None
        """
        with self.lock:
            self.cache.clear()

    def cleanup_expired(self) -> int:
        """Remove all expired entries from cache.

        Returns:
            Number of entries removed.

        Example:
            >>> cache = IdempotencyCache(ttl=1)
            >>> cache.set("key1", {"action": "provoke"})
            >>> cache.set("key2", {"action": "delete"})
            >>> time.sleep(2)
            >>> removed = cache.cleanup_expired()
            >>> removed
            2
        """
        with self.lock:
            current_time = time.time()
            expired_keys = [key for key, (_, expiry) in self.cache.items() if current_time > expiry]

            for key in expired_keys:
                del self.cache[key]

            return len(expired_keys)
