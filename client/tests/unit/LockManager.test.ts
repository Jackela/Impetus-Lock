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

import { describe, it, expect, beforeEach, vi } from "vitest";
import { LockManager } from "../../src/services/LockManager.ts";
import { createLockTransactionFilter } from "../../src/components/Editor/TransactionFilter.ts";
import type { Transaction } from "@milkdown/prose/state";
import type { Node as ProseMirrorNode } from "@milkdown/prose/model";

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

> 测试内容 <!-- lock:lock_001 source:muse -->

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
> Block 1 <!-- lock:lock_001 source:muse -->

Normal text.

> Block 2 <!-- lock:lock_002 source:loki -->

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
> Good lock <!-- lock:lock_001 source:muse -->
> Bad lock <!-- lock: --> 
> Also bad <!-- locklock_002 -->
      `.trim();

      const locks = lockManager.extractLocksFromMarkdown(markdown);

      expect(locks).toEqual(["lock_001"]);
    });
  });

  describe("extractLockEntriesFromMarkdown()", () => {
    it("should parse lock metadata with sources", () => {
      const markdown = `
> First <!-- lock:lock_meta_001 source:muse -->
> Second <!-- lock:lock_meta_002 source:loki -->
      `.trim();

      const entries = lockManager.extractLockEntriesFromMarkdown(markdown);
      expect(entries).toEqual([
        { lockId: "lock_meta_001", source: "muse" },
        { lockId: "lock_meta_002", source: "loki" },
      ]);
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

  describe("getLockMetadata()", () => {
    it("should return metadata for stored locks", () => {
      const lockId = "lock_meta_source";
      lockManager.applyLock(lockId, { source: "loki" });

      expect(lockManager.getLockMetadata(lockId)).toEqual({ source: "loki" });
    });
  });

  describe("injectLockComment()", () => {
    it("should include source metadata when provided", () => {
      const result = lockManager.injectLockComment("> text", "lock_inline", { source: "muse" });
      expect(result).toContain("<!-- lock:lock_inline source:muse -->");
    });
  });

  describe("Transaction Filter - onReject Callback", () => {
    /**
     * Create a mock ProseMirror Step whose StepMap covers [oldStart, oldEnd).
     *
     * Mirrors the transaction construction pattern from
     * `src/components/Editor/TransactionFilter.test.ts` so these tests drive the
     * real filter with realistic step maps.
     */
    function createMockStep(oldStart: number, oldEnd: number) {
      return {
        getMap: () => ({
          forEach: (callback: (oldStart: number, oldEnd: number) => void) => {
            callback(oldStart, oldEnd);
          },
        }),
      };
    }

    /**
     * Create a mock editor state whose document yields the given nodes for any
     * nodesBetween() range scan (same shape as TransactionFilter.test.ts mocks).
     */
    function createMockEditorState(nodes: unknown[]) {
      return {
        doc: {
          nodesBetween: (_from: number, _to: number, callback: (node: unknown) => void | false) => {
            nodes.forEach((node) => callback(node));
          },
        },
      };
    }

    /**
     * Create a node carrying a lockId attribute (attribute-based lock detection).
     */
    function createMockLockedNode(lockId: string): ProseMirrorNode {
      return {
        type: { name: "blockquote" },
        attrs: { lockId },
        textContent: "Locked content",
        isText: false,
      } as unknown as ProseMirrorNode;
    }

    /**
     * Create a node without any lock attributes.
     */
    function createMockUnlockedNode(): ProseMirrorNode {
      return {
        type: { name: "paragraph" },
        attrs: {},
        textContent: "Normal content",
        isText: false,
      } as unknown as ProseMirrorNode;
    }

    /**
     * Test: T021 - deleting a node whose lockId is registered in the LockManager
     * must be blocked by the real transaction filter, and the filter itself must
     * invoke the onReject callback (never invoked manually by the test).
     *
     * Integration: LockManager (lock state) ↔ createLockTransactionFilter (enforcement).
     *
     * **Coverage**: FR-003 (Lock rejection feedback - P3 US2)
     * **User Story**: US2 (Lock Rejection Sensory Feedback - P2)
     */
    it("blocks deletion of a locked node and fires onReject via the real filter", () => {
      const lockId = "lock_test_reject";
      lockManager.applyLock(lockId, { source: "muse" });

      const onReject = vi.fn();
      const filter = createLockTransactionFilter(lockManager, onReject);

      const deletion = {
        docChanged: true,
        steps: [createMockStep(0, 20)],
      } as unknown as Transaction;
      const state = createMockEditorState([createMockLockedNode(lockId)]);

      const result = filter(deletion, state);

      // Blocked by the filter, and rejection feedback fired from inside the filter
      expect(result).toBe(false);
      expect(onReject).toHaveBeenCalledTimes(1);

      // Lock still registered (deletion was blocked)
      expect(lockManager.hasLock(lockId)).toBe(true);
    });

    /**
     * Test: deleting an unlocked node must pass the real filter without any
     * rejection feedback (no false positives).
     *
     * **Coverage**: FR-003 (Lock rejection feedback - negative case)
     */
    it("allows deletion of an unlocked node without firing onReject", () => {
      const onReject = vi.fn();
      const filter = createLockTransactionFilter(lockManager, onReject);

      const deletion = {
        docChanged: true,
        steps: [createMockStep(0, 20)],
      } as unknown as Transaction;
      const state = createMockEditorState([createMockUnlockedNode()]);

      const result = filter(deletion, state);

      expect(result).toBe(true);
      expect(onReject).not.toHaveBeenCalled();
    });

    /**
     * Test: releasing the lock through the LockManager must permit the exact
     * deletion that was previously blocked (LockManager state drives the filter).
     *
     * **Coverage**: FR-003 (Lock rejection feedback - state coupling)
     */
    it("permits the same deletion after the lock is released via LockManager", () => {
      const lockId = "lock_test_release";
      lockManager.applyLock(lockId, { source: "loki" });

      const onReject = vi.fn();
      const filter = createLockTransactionFilter(lockManager, onReject);

      const deletion = {
        docChanged: true,
        steps: [createMockStep(0, 20)],
      } as unknown as Transaction;
      const state = createMockEditorState([createMockLockedNode(lockId)]);

      // While the lock is registered, the deletion is blocked
      expect(filter(deletion, state)).toBe(false);
      expect(onReject).toHaveBeenCalledTimes(1);

      // Release the lock through the manager, then retry the same deletion
      lockManager.removeLock(lockId);

      expect(filter(deletion, state)).toBe(true);
      expect(onReject).toHaveBeenCalledTimes(1); // no additional rejection
    });
  });
});
