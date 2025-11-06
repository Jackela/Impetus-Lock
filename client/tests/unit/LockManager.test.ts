/**
 * Unit Tests for LockManager
 *
 * Tests lock state management and Markdown lock parsing.
 *
 * Constitutional Compliance:
 * - Article III (TDD): Tests written BEFORE implementation (RED phase)
 * - Article III (Coverage): Target ≥80% coverage for critical paths
 * - Article V (Documentation): JSDoc comments for all test cases
 *
 * Expected Initial State: All tests FAIL (LockManager not implemented yet)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { LockManager } from "../../src/services/LockManager";

describe("LockManager", () => {
  let lockManager: LockManager;

  beforeEach(() => {
    lockManager = new LockManager();
  });

  describe("applyLock()", () => {
    /**
     * Test: applyLock() should add lock_id to internal set.
     *
     * Expected (RED): Test fails (LockManager not implemented)
     */
    it("should add lock_id to set", () => {
      const lockId = "lock_test_001";

      lockManager.applyLock(lockId);

      expect(lockManager.hasLock(lockId)).toBe(true);
    });

    /**
     * Test: applyLock() should handle duplicate lock_ids gracefully.
     */
    it("should handle duplicate lock_ids (idempotent)", () => {
      const lockId = "lock_test_002";

      lockManager.applyLock(lockId);
      lockManager.applyLock(lockId); // Apply twice

      expect(lockManager.hasLock(lockId)).toBe(true);
      expect(lockManager.getLockCount()).toBe(1);
    });

    /**
     * Test: applyLock() should support multiple locks.
     */
    it("should support multiple locks simultaneously", () => {
      const locks = ["lock_001", "lock_002", "lock_003"];

      locks.forEach((id) => lockManager.applyLock(id));

      locks.forEach((id) => {
        expect(lockManager.hasLock(id)).toBe(true);
      });
      expect(lockManager.getLockCount()).toBe(3);
    });
  });

  describe("removeLock()", () => {
    /**
     * Test: removeLock() should remove lock_id from set.
     *
     * Note: In P1, locks are un-deletable, so this is for testing only.
     * Future use case: Admin override or revert_token mechanism.
     *
     * Expected (RED): Test fails (LockManager not implemented)
     */
    it("should remove lock_id from set", () => {
      const lockId = "lock_test_003";

      lockManager.applyLock(lockId);
      expect(lockManager.hasLock(lockId)).toBe(true);

      lockManager.removeLock(lockId);
      expect(lockManager.hasLock(lockId)).toBe(false);
    });

    /**
     * Test: removeLock() should handle non-existent lock_ids gracefully.
     */
    it("should handle removing non-existent lock (no error)", () => {
      expect(() => {
        lockManager.removeLock("lock_nonexistent");
      }).not.toThrow();
    });
  });

  describe("hasLock()", () => {
    /**
     * Test: hasLock() should return true for existing locks.
     *
     * Expected (RED): Test fails (LockManager not implemented)
     */
    it("should return true for existing lock", () => {
      const lockId = "lock_test_004";

      lockManager.applyLock(lockId);

      expect(lockManager.hasLock(lockId)).toBe(true);
    });

    /**
     * Test: hasLock() should return false for non-existent locks.
     */
    it("should return false for non-existent lock", () => {
      expect(lockManager.hasLock("lock_nonexistent")).toBe(false);
    });
  });

  describe("extractLocksFromMarkdown()", () => {
    /**
     * Test: extractLocksFromMarkdown() should parse lock comments.
     *
     * Markdown lock format: <!-- lock:lock_id -->
     *
     * Expected (RED): Test fails (LockManager not implemented)
     */
    it("should parse single lock comment", () => {
      const markdown = `
# Title

> [AI施压 - Muse]: 测试内容 <!-- lock:lock_001 -->

Normal text.
      `.trim();

      const locks = lockManager.extractLocksFromMarkdown(markdown);

      expect(locks).toEqual(["lock_001"]);
    });

    /**
     * Test: extractLocksFromMarkdown() should parse multiple locks.
     */
    it("should parse multiple lock comments", () => {
      const markdown = `
> Block 1 <!-- lock:lock_001 -->

Normal text.

> Block 2 <!-- lock:lock_002 -->

More text.

> Block 3 <!-- lock:lock_003 -->
      `.trim();

      const locks = lockManager.extractLocksFromMarkdown(markdown);

      expect(locks).toEqual(["lock_001", "lock_002", "lock_003"]);
    });

    /**
     * Test: extractLocksFromMarkdown() should handle markdown without locks.
     */
    it("should return empty array for markdown without locks", () => {
      const markdown = `
# Normal Markdown

Just regular text without any locks.
      `.trim();

      const locks = lockManager.extractLocksFromMarkdown(markdown);

      expect(locks).toEqual([]);
    });

    /**
     * Test: extractLocksFromMarkdown() should handle malformed lock comments.
     */
    it("should ignore malformed lock comments", () => {
      const markdown = `
> Good lock <!-- lock:lock_001 -->
> Bad lock <!-- lock: --> 
> Also bad <!-- locklock_002 -->
      `.trim();

      const locks = lockManager.extractLocksFromMarkdown(markdown);

      expect(locks).toEqual(["lock_001"]);
    });
  });

  describe("getAllLocks()", () => {
    /**
     * Test: getAllLocks() should return all lock IDs.
     */
    it("should return all lock IDs as array", () => {
      const locks = ["lock_001", "lock_002", "lock_003"];
      locks.forEach((id) => lockManager.applyLock(id));

      const allLocks = lockManager.getAllLocks();

      expect(allLocks).toEqual(expect.arrayContaining(locks));
      expect(allLocks.length).toBe(3);
    });

    /**
     * Test: getAllLocks() should return empty array when no locks.
     */
    it("should return empty array when no locks exist", () => {
      expect(lockManager.getAllLocks()).toEqual([]);
    });
  });
});
