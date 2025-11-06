"""Unit tests for IdempotencyCache.

Tests thread-safe caching with TTL expiration and race condition prevention.
Verifies the TOCTOU fix in the get() method.

Constitutional Compliance:
- Article III (TDD): Critical infrastructure component tests
- Article V (Documentation): Complete test documentation
"""

import time
from threading import Thread
from unittest.mock import patch

import pytest

from server.infrastructure.cache.idempotency_cache import IdempotencyCache


class TestIdempotencyCache:
    """Test suite for IdempotencyCache thread-safe TTL cache."""

    @pytest.fixture
    def cache(self) -> IdempotencyCache:
        """Create fresh cache instance with 1s TTL for fast tests."""
        return IdempotencyCache(ttl=1)

    def test_set_and_get_basic(self, cache: IdempotencyCache) -> None:
        """Test basic set/get operations."""
        # Arrange
        key = "test_key_001"
        response = {"action": "provoke", "content": "Test"}

        # Act
        cache.set(key, response)
        result = cache.get(key)

        # Assert
        assert result == response

    def test_get_nonexistent_key_returns_none(self, cache: IdempotencyCache) -> None:
        """Test getting non-existent key returns None."""
        result = cache.get("nonexistent_key")
        assert result is None

    def test_get_expired_entry_returns_none(self, cache: IdempotencyCache) -> None:
        """Test expired entries are deleted and return None."""
        # Arrange
        key = "expire_test"
        cache.set(key, {"data": "value"})

        # Act - Wait for expiration (TTL = 1s)
        time.sleep(1.1)
        result = cache.get(key)

        # Assert
        assert result is None
        # Verify entry was deleted from cache
        assert key not in cache.cache

    def test_clear_removes_all_entries(self, cache: IdempotencyCache) -> None:
        """Test clear() removes all cached entries."""
        # Arrange
        cache.set("key1", {"a": 1})
        cache.set("key2", {"b": 2})
        cache.set("key3", {"c": 3})

        # Act
        cache.clear()

        # Assert
        assert cache.get("key1") is None
        assert cache.get("key2") is None
        assert cache.get("key3") is None
        assert len(cache.cache) == 0

    def test_cleanup_expired_removes_only_expired(self, cache: IdempotencyCache) -> None:
        """Test cleanup_expired() removes only expired entries."""
        # Arrange - Set entries with different timing
        cache.set("fresh_key", {"fresh": True})
        cache.set("expire_key_1", {"expire": 1})
        cache.set("expire_key_2", {"expire": 2})

        # Wait for some to expire
        time.sleep(1.1)
        cache.set("very_fresh_key", {"very_fresh": True})

        # Act
        removed_count = cache.cleanup_expired()

        # Assert
        assert removed_count == 3  # fresh_key, expire_key_1, expire_key_2 all expired
        assert cache.get("very_fresh_key") is not None  # Still valid
        assert cache.get("expire_key_1") is None

    def test_ttl_configuration(self) -> None:
        """Test custom TTL configuration."""
        # Arrange
        custom_cache = IdempotencyCache(ttl=2)

        # Act
        custom_cache.set("key", {"data": "test"})
        time.sleep(1.5)
        result_before_expiry = custom_cache.get("key")

        time.sleep(1.0)  # Total 2.5s elapsed
        result_after_expiry = custom_cache.get("key")

        # Assert
        assert result_before_expiry is not None  # Still valid at 1.5s
        assert result_after_expiry is None  # Expired at 2.5s

    def test_race_condition_prevention_toctou_fix(self) -> None:
        """Test TOCTOU race condition fix in get() method.

        Verifies that time.time() is called once and stored in current_time,
        preventing race conditions where entry could expire between check and return.

        This test simulates a scenario where if the code called time.time() twice,
        the second call would return a time after expiry, but the fixed code
        only calls it once, preventing the race condition.
        """
        # Arrange
        key = "race_test"
        response = {"action": "delete", "lock_id": None}

        # Use controlled time for predictable testing
        with patch("server.infrastructure.cache.idempotency_cache.time.time") as mock_time:
            # Simulate time progression
            base_time = 1000.0

            # set() call: time.time() returns base_time
            mock_time.return_value = base_time
            cache = IdempotencyCache(ttl=10)
            cache.set(key, response)

            # get() call: Configure mock for potential race condition scenario
            # If code had bug (calling time.time() twice), we'd see:
            # - First call: base_time + 5 (not expired, 1005 < 1010)
            # - Second call: base_time + 15 (expired, 1015 > 1010)
            # But fixed code only calls once, so we only use first value
            mock_time.side_effect = [
                base_time + 5,  # Single call in fixed code (not expired)
                base_time + 15,  # Would be used if buggy code called twice (expired)
            ]

            # Act
            result = cache.get(key)

            # Assert - Should return response because current_time was captured once
            # Expiry is 1010, current_time is 1005, so 1005 > 1010 is False
            assert result == response, "Should return cached value (not expired)"

            # Verify time.time() called exactly once in get() (the fix!)
            # If buggy, would call twice and side_effect would advance to [1]
            assert mock_time.call_count == 2, "Expected 1 call in set() + 1 call in get()"

    def test_thread_safety_concurrent_reads(self, cache: IdempotencyCache) -> None:
        """Test concurrent reads from multiple threads."""
        # Arrange
        key = "concurrent_key"
        cache.set(key, {"concurrent": True})
        results: list[dict[str, bool]] = []

        def read_cache() -> None:
            result = cache.get(key)
            if result:
                results.append(result)

        # Act - 10 threads reading simultaneously
        threads = [Thread(target=read_cache) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # Assert - All threads got the same response
        assert len(results) == 10
        assert all(r == {"concurrent": True} for r in results)

    def test_thread_safety_concurrent_writes(self, cache: IdempotencyCache) -> None:
        """Test concurrent writes to different keys."""

        # Arrange
        def write_cache(thread_id: int) -> None:
            cache.set(f"key_{thread_id}", {"id": thread_id})

        # Act - 10 threads writing different keys
        threads = [Thread(target=write_cache, args=(i,)) for i in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # Assert - All writes succeeded
        for i in range(10):
            result = cache.get(f"key_{i}")
            assert result == {"id": i}

    def test_thread_safety_mixed_operations(self, cache: IdempotencyCache) -> None:
        """Test concurrent mixed reads, writes, and clears."""
        # Arrange
        cache.set("shared_key", {"shared": True})
        operation_results: list[str] = []

        def read_operation() -> None:
            result = cache.get("shared_key")
            operation_results.append(f"read:{result is not None}")

        def write_operation(thread_id: int) -> None:
            cache.set(f"write_key_{thread_id}", {"id": thread_id})
            operation_results.append(f"write:{thread_id}")

        def cleanup_operation() -> None:
            removed = cache.cleanup_expired()
            operation_results.append(f"cleanup:{removed}")

        # Act - Mix of operations
        threads = [
            Thread(target=read_operation),
            Thread(target=write_operation, args=(1,)),
            Thread(target=read_operation),
            Thread(target=write_operation, args=(2,)),
            Thread(target=cleanup_operation),
            Thread(target=read_operation),
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # Assert - No crashes, all operations completed
        assert len(operation_results) == 6

    def test_set_overwrites_existing_key(self, cache: IdempotencyCache) -> None:
        """Test setting same key twice overwrites with new TTL."""
        # Arrange
        key = "overwrite_key"
        cache.set(key, {"version": 1})

        # Act - Wait a bit, then overwrite
        time.sleep(0.5)
        cache.set(key, {"version": 2})

        # Assert - New value and fresh TTL
        result = cache.get(key)
        assert result == {"version": 2}

        # Wait original TTL duration
        time.sleep(0.6)  # Total 1.1s from first set

        # Should still be valid because second set reset TTL
        result_after_wait = cache.get(key)
        assert result_after_wait == {"version": 2}

    def test_idempotent_set_operations(self, cache: IdempotencyCache) -> None:
        """Test setting same key multiple times is idempotent."""
        # Arrange
        key = "idempotent_key"
        response = {"action": "provoke", "lock_id": "lock_001"}

        # Act - Set same response 5 times
        for _ in range(5):
            cache.set(key, response)

        # Assert - Last set is what's stored
        result = cache.get(key)
        assert result == response

    def test_cleanup_expired_returns_count(self, cache: IdempotencyCache) -> None:
        """Test cleanup_expired() returns correct count."""
        # Arrange - Create multiple entries
        for i in range(5):
            cache.set(f"key_{i}", {"id": i})

        # Act - Wait for expiration
        time.sleep(1.1)
        removed = cache.cleanup_expired()

        # Assert
        assert removed == 5
        assert len(cache.cache) == 0

    def test_large_response_objects(self, cache: IdempotencyCache) -> None:
        """Test caching large response objects."""
        # Arrange - Large nested structure
        large_response = {
            "action": "provoke",
            "content": "x" * 10000,  # 10KB string
            "lock_id": "lock_" + "a" * 100,
            "metadata": {"nested": {"deep": {"structure": list(range(1000))}}},
        }

        # Act
        cache.set("large_key", large_response)
        result = cache.get("large_key")

        # Assert
        assert result == large_response
        assert len(result["content"]) == 10000
