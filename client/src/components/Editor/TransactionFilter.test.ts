/**
 * TransactionFilter Tests
 *
 * Test suite for ProseMirror transaction filtering with attribute-based lock enforcement.
 * Tests the migration from HTML comment-based to node attribute-based lock detection.
 *
 * Constitutional Compliance:
 * - Article III (TDD): Red-Green-Refactor workflow for P1 lock enforcement
 * - Article III (Coverage): ≥80% coverage for critical lock enforcement paths
 * - Article V (Documentation): JSDoc for all test cases
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createLockTransactionFilter, isPositionLocked } from "./TransactionFilter";
import type { Transaction } from "@milkdown/prose/state";
import type { Node as ProseMirrorNode } from "@milkdown/prose/model";
// eslint-disable-next-line no-restricted-imports -- Test file needs direct access to LockManager
import { LockManager } from "../../services/LockManager";

/**
 * Mock ProseMirror Transaction.
 */
interface MockTransaction {
  docChanged: boolean;
  steps: ReturnType<typeof createMockStep>[];
}

/**
 * Mock ProseMirror EditorState.
 */
interface MockEditorState {
  doc: {
    nodesBetween: (from: number, to: number, callback: (node: unknown) => void | false) => void;
    resolve: (pos: number) => {
      node: (depth?: number) => unknown;
      depth: number;
    };
  };
}

/**
 * Create mock Step with getMap() method.
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
 * Create mock node with lock attributes.
 */
function createMockLockedNode(lockId: string, source?: "muse" | "loki"): ProseMirrorNode {
  return {
    type: { name: "blockquote" },
    attrs: { lockId, source },
    textContent: "Locked content",
    isText: false,
  } as unknown as ProseMirrorNode;
}

/**
 * Create mock unlocked node.
 */
function createMockUnlockedNode(): ProseMirrorNode {
  return {
    type: { name: "paragraph" },
    attrs: {},
    textContent: "Normal content",
    isText: false,
  } as unknown as ProseMirrorNode;
}

describe("createLockTransactionFilter - Block Deletion of Locked Nodes", () => {
  let lockManager: LockManager;
  let onReject: () => void;

  beforeEach(() => {
    lockManager = new LockManager();
    onReject = vi.fn();
    vi.clearAllMocks();
  });

  /**
   * Test: Transaction filter should block deletion of nodes with lockId attribute.
   *
   * Critical path: Lock enforcement (attribute-based)
   * Coverage: Ensures locked nodes cannot be deleted
   */
  it("should block deletion of node with lockId attribute", () => {
    lockManager.applyLock("lock_test_123", { source: "muse" });

    const filter = createLockTransactionFilter(lockManager, onReject);

    const lockedNode = createMockLockedNode("lock_test_123", "muse");
    const mockState: MockEditorState = {
      doc: {
        nodesBetween: (from, to, callback) => {
          callback(lockedNode);
        },
        resolve: vi.fn(),
      },
    };

    const transaction: MockTransaction = {
      docChanged: true,
      steps: [createMockStep(10, 20)],
    };

    const result = filter(transaction as unknown as Transaction, mockState);

    expect(result).toBe(false); // Transaction should be blocked
    expect(onReject).toHaveBeenCalledTimes(1); // Reject callback should be triggered
  });

  /**
   * Test: Transaction filter should allow deletion of nodes without lockId attribute.
   *
   * Critical path: Normal content editing
   * Coverage: Ensures unlocked content can be deleted
   */
  it("should allow deletion of node without lockId attribute", () => {
    const filter = createLockTransactionFilter(lockManager, onReject);

    const unlockedNode = createMockUnlockedNode();
    const mockState: MockEditorState = {
      doc: {
        nodesBetween: (from, to, callback) => {
          callback(unlockedNode);
        },
        resolve: vi.fn(),
      },
    };

    const transaction: MockTransaction = {
      docChanged: true,
      steps: [createMockStep(10, 20)],
    };

    const result = filter(transaction as unknown as Transaction, mockState);

    expect(result).toBe(true); // Transaction should be allowed
    expect(onReject).not.toHaveBeenCalled(); // No rejection
  });

  /**
   * Test: Transaction filter should NOT check text content for HTML comment patterns.
   *
   * Critical path: Performance optimization (attribute-only checks)
   * Coverage: Ensures migration away from text scanning
   *
   * NOTE: This test verifies the REFACTORED behavior where HTML comments in text
   * content do NOT trigger lock enforcement (only node attributes matter).
   */
  it("should NOT block deletion based on HTML comments in text content", () => {
    const filter = createLockTransactionFilter(lockManager, onReject);

    // Node with HTML comment in text but NO lockId attribute
    const nodeWithComment: ProseMirrorNode = {
      type: { name: "paragraph" },
      attrs: {}, // No lockId attribute
      textContent: "Text with <!-- lock:lock_comment_123 --> comment",
      isText: false,
    } as unknown as ProseMirrorNode;

    const mockState: MockEditorState = {
      doc: {
        nodesBetween: (from, to, callback) => {
          callback(nodeWithComment);
        },
        resolve: vi.fn(),
      },
    };

    const transaction: MockTransaction = {
      docChanged: true,
      steps: [createMockStep(10, 20)],
    };

    const result = filter(transaction as unknown as Transaction, mockState);

    // Should ALLOW deletion (no lockId attribute = not locked)
    expect(result).toBe(true);
    expect(onReject).not.toHaveBeenCalled();
  });

  /**
   * Test: Transaction filter should check if lock exists in LockManager.
   *
   * Critical path: Lock registry validation
   * Coverage: Ensures only registered locks are enforced
   */
  it("should allow deletion if lockId not registered in LockManager", () => {
    const filter = createLockTransactionFilter(lockManager, onReject);

    // Node has lockId attribute, but lock NOT registered in manager
    const nodeWithUnregisteredLock = createMockLockedNode("lock_unregistered", "muse");

    const mockState: MockEditorState = {
      doc: {
        nodesBetween: (from, to, callback) => {
          callback(nodeWithUnregisteredLock);
        },
        resolve: vi.fn(),
      },
    };

    const transaction: MockTransaction = {
      docChanged: true,
      steps: [createMockStep(10, 20)],
    };

    const result = filter(transaction as unknown as Transaction, mockState);

    // Should allow (lock not in manager)
    expect(result).toBe(true);
    expect(onReject).not.toHaveBeenCalled();
  });

  /**
   * Test: Transaction filter should trigger onReject callback when blocking.
   *
   * Critical path: Sensory feedback integration
   * Coverage: Ensures reject callback is invoked for user feedback
   */
  it("should call onReject callback when blocking locked deletion", () => {
    lockManager.applyLock("lock_feedback_test", { source: "loki" });

    const filter = createLockTransactionFilter(lockManager, onReject);

    const lockedNode = createMockLockedNode("lock_feedback_test", "loki");
    const mockState: MockEditorState = {
      doc: {
        nodesBetween: (from, to, callback) => {
          callback(lockedNode);
        },
        resolve: vi.fn(),
      },
    };

    const transaction: MockTransaction = {
      docChanged: true,
      steps: [createMockStep(10, 20)],
    };

    filter(transaction as unknown as Transaction, mockState);

    expect(onReject).toHaveBeenCalledTimes(1);
  });

  /**
   * Test: Transaction filter should allow transactions without document changes.
   *
   * Coverage: Non-editing transactions (selection changes, etc.)
   */
  it("should allow transactions that do not change document (docChanged=false)", () => {
    lockManager.applyLock("lock_test", { source: "muse" });

    const filter = createLockTransactionFilter(lockManager, onReject);

    const transaction: MockTransaction = {
      docChanged: false, // No content change
      steps: [],
    };

    const mockState: MockEditorState = {
      doc: {
        nodesBetween: vi.fn(), // Should not be called
        resolve: vi.fn(),
      },
    };

    const result = filter(transaction as unknown as Transaction, mockState);

    expect(result).toBe(true);
    expect(mockState.doc.nodesBetween).not.toHaveBeenCalled();
    expect(onReject).not.toHaveBeenCalled();
  });
});

describe("createLockTransactionFilter - Multiple Nodes and Steps", () => {
  let lockManager: LockManager;
  let onReject: () => void;

  beforeEach(() => {
    lockManager = new LockManager();
    onReject = vi.fn();
  });

  /**
   * Test: Transaction filter should scan all nodes in affected range.
   *
   * Coverage: Multi-node transactions
   */
  it("should block if ANY node in range has registered lock", () => {
    lockManager.applyLock("lock_second", { source: "muse" });

    const filter = createLockTransactionFilter(lockManager, onReject);

    const nodes = [
      createMockUnlockedNode(),
      createMockLockedNode("lock_second", "muse"), // Second node is locked
      createMockUnlockedNode(),
    ];

    const mockState: MockEditorState = {
      doc: {
        nodesBetween: (from, to, callback) => {
          nodes.forEach((node) => callback(node));
        },
        resolve: vi.fn(),
      },
    };

    const transaction: MockTransaction = {
      docChanged: true,
      steps: [createMockStep(0, 100)],
    };

    const result = filter(transaction as unknown as Transaction, mockState);

    expect(result).toBe(false); // Blocked due to second node
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  /**
   * Test: Transaction filter should handle multiple transaction steps.
   *
   * Coverage: Complex transactions with multiple edits
   */
  it("should check all steps in multi-step transaction", () => {
    lockManager.applyLock("lock_step2", { source: "loki" });

    const filter = createLockTransactionFilter(lockManager, onReject);

    let callCount = 0;
    const mockState: MockEditorState = {
      doc: {
        nodesBetween: (from, to, callback) => {
          callCount++;
          // First step: unlocked node
          // Second step: locked node
          if (callCount === 2) {
            callback(createMockLockedNode("lock_step2", "loki"));
          } else {
            callback(createMockUnlockedNode());
          }
        },
        resolve: vi.fn(),
      },
    };

    const transaction: MockTransaction = {
      docChanged: true,
      steps: [
        createMockStep(0, 10),
        createMockStep(20, 30), // This step affects locked content
      ],
    };

    const result = filter(transaction as unknown as Transaction, mockState);

    expect(result).toBe(false);
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  /**
   * Test: Transaction filter should allow if all nodes unlocked.
   *
   * Coverage: Large transactions without locks
   */
  it("should allow multi-node transaction if no locks present", () => {
    const filter = createLockTransactionFilter(lockManager, onReject);

    const mockState: MockEditorState = {
      doc: {
        nodesBetween: (from, to, callback) => {
          // Return multiple unlocked nodes
          for (let i = 0; i < 5; i++) {
            callback(createMockUnlockedNode());
          }
        },
        resolve: vi.fn(),
      },
    };

    const transaction: MockTransaction = {
      docChanged: true,
      steps: [createMockStep(0, 100)],
    };

    const result = filter(transaction as unknown as Transaction, mockState);

    expect(result).toBe(true);
    expect(onReject).not.toHaveBeenCalled();
  });
});

describe("createLockTransactionFilter - Mark-based Locks", () => {
  let lockManager: LockManager;
  let onReject: () => void;

  beforeEach(() => {
    lockManager = new LockManager();
    onReject = vi.fn();
  });

  /**
   * Test: Transaction filter should detect locks in mark attributes.
   *
   * Coverage: Mark-based lock enforcement (inline locks)
   */
  it("should block deletion of text with lock mark", () => {
    lockManager.applyLock("lock_mark_123", { source: "muse" });

    const filter = createLockTransactionFilter(lockManager, onReject);

    const nodeWithLockedMark = {
      type: { name: "text" },
      attrs: {},
      textContent: "Marked text",
      isText: true,
      marks: [
        {
          attrs: { lockId: "lock_mark_123" },
        },
      ],
    };

    const mockState: MockEditorState = {
      doc: {
        nodesBetween: (from, to, callback) => {
          callback(nodeWithLockedMark);
        },
        resolve: vi.fn(),
      },
    };

    const transaction: MockTransaction = {
      docChanged: true,
      steps: [createMockStep(10, 20)],
    };

    const result = filter(transaction as unknown as Transaction, mockState);

    expect(result).toBe(false);
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  /**
   * Test: Transaction filter should allow deletion of text without lock marks.
   *
   * Coverage: Normal text editing (no marks)
   */
  it("should allow deletion of text without lock marks", () => {
    const filter = createLockTransactionFilter(lockManager, onReject);

    const nodeWithoutLockMark = {
      type: { name: "text" },
      attrs: {},
      textContent: "Normal text",
      isText: true,
      marks: [
        { attrs: { bold: true } }, // Non-lock mark
      ],
    };

    const mockState: MockEditorState = {
      doc: {
        nodesBetween: (from, to, callback) => {
          callback(nodeWithoutLockMark);
        },
        resolve: vi.fn(),
      },
    };

    const transaction: MockTransaction = {
      docChanged: true,
      steps: [createMockStep(10, 20)],
    };

    const result = filter(transaction as unknown as Transaction, mockState);

    expect(result).toBe(true);
    expect(onReject).not.toHaveBeenCalled();
  });

  /**
   * Test: Transaction filter should handle nodes without marks array.
   *
   * Coverage: Edge case - nodes without marks property
   */
  it("should handle nodes without marks property", () => {
    const filter = createLockTransactionFilter(lockManager, onReject);

    const nodeWithoutMarks = {
      type: { name: "paragraph" },
      attrs: {},
      textContent: "No marks",
      isText: false,
      // No marks property
    };

    const mockState: MockEditorState = {
      doc: {
        nodesBetween: (from, to, callback) => {
          callback(nodeWithoutMarks);
        },
        resolve: vi.fn(),
      },
    };

    const transaction: MockTransaction = {
      docChanged: true,
      steps: [createMockStep(10, 20)],
    };

    const result = filter(transaction as unknown as Transaction, mockState);

    expect(result).toBe(true); // Should not crash
  });
});

describe("isPositionLocked - Position-based Lock Detection", () => {
  let lockManager: LockManager;

  beforeEach(() => {
    lockManager = new LockManager();
  });

  /**
   * Test: isPositionLocked should return true if position is within locked node.
   *
   * Critical path: Cursor position validation
   * Coverage: Prevents cursor placement in locked content
   */
  it("should return true when position is inside locked node", () => {
    lockManager.applyLock("lock_pos_123", { source: "muse" });

    const lockedNode = createMockLockedNode("lock_pos_123", "muse");

    const mockState = {
      doc: {
        resolve: () => ({
          depth: 2,
          node: (depth?: number) => {
            if (depth === 1) return lockedNode;
            return createMockUnlockedNode();
          },
        }),
      },
    };

    const result = isPositionLocked(mockState, 10, lockManager);

    expect(result).toBe(true);
  });

  /**
   * Test: isPositionLocked should return false if position is in unlocked node.
   *
   * Coverage: Normal cursor positioning
   */
  it("should return false when position is not in locked node", () => {
    const mockState = {
      doc: {
        resolve: () => ({
          depth: 1,
          node: () => createMockUnlockedNode(),
        }),
      },
    };

    const result = isPositionLocked(mockState, 10, lockManager);

    expect(result).toBe(false);
  });

  /**
   * Test: isPositionLocked should check all parent nodes (depth traversal).
   *
   * Coverage: Nested node structures
   */
  it("should check parent nodes at all depths", () => {
    lockManager.applyLock("lock_parent", { source: "loki" });

    const parentLocked = createMockLockedNode("lock_parent", "loki");
    const childUnlocked = createMockUnlockedNode();

    const mockState = {
      doc: {
        resolve: () => ({
          depth: 3,
          node: (depth?: number) => {
            if (depth === 1) return parentLocked; // Parent is locked
            return childUnlocked;
          },
        }),
      },
    };

    const result = isPositionLocked(mockState, 15, lockManager);

    expect(result).toBe(true); // Should detect lock in parent
  });

  /**
   * Test: isPositionLocked should return false if lock not registered.
   *
   * Coverage: Unregistered lock handling
   */
  it("should return false if node has lockId but not registered in manager", () => {
    const nodeWithUnregisteredLock = createMockLockedNode("lock_unregistered");

    const mockState = {
      doc: {
        resolve: () => ({
          depth: 1,
          node: () => nodeWithUnregisteredLock,
        }),
      },
    };

    const result = isPositionLocked(mockState, 10, lockManager);

    expect(result).toBe(false);
  });
});

describe("createLockTransactionFilter - Edge Cases", () => {
  let lockManager: LockManager;
  let onReject: () => void;

  beforeEach(() => {
    lockManager = new LockManager();
    onReject = vi.fn();
  });

  /**
   * Test: Transaction filter should handle empty transaction steps.
   *
   * Coverage: Edge case - no steps
   */
  it("should allow transaction with empty steps array", () => {
    const filter = createLockTransactionFilter(lockManager, onReject);

    const transaction: MockTransaction = {
      docChanged: true,
      steps: [], // Empty steps
    };

    const mockState: MockEditorState = {
      doc: {
        nodesBetween: vi.fn(),
        resolve: vi.fn(),
      },
    };

    const result = filter(transaction as unknown as Transaction, mockState);

    expect(result).toBe(true);
    expect(mockState.doc.nodesBetween).not.toHaveBeenCalled();
  });

  /**
   * Test: Transaction filter should handle onReject being undefined.
   *
   * Coverage: Optional callback parameter
   */
  it("should not crash when onReject is undefined", () => {
    lockManager.applyLock("lock_test", { source: "muse" });

    const filter = createLockTransactionFilter(lockManager); // No onReject

    const lockedNode = createMockLockedNode("lock_test", "muse");
    const mockState: MockEditorState = {
      doc: {
        nodesBetween: (from, to, callback) => {
          callback(lockedNode);
        },
        resolve: vi.fn(),
      },
    };

    const transaction: MockTransaction = {
      docChanged: true,
      steps: [createMockStep(10, 20)],
    };

    const result = filter(transaction as unknown as Transaction, mockState);

    expect(result).toBe(false); // Still blocks
    // Should not crash (no callback to call)
  });

  /**
   * Test: Transaction filter should handle nodesBetween callback returning false.
   *
   * Coverage: Early termination of node traversal
   */
  it("should respect early termination from nodesBetween callback", () => {
    lockManager.applyLock("lock_first", { source: "muse" });

    const filter = createLockTransactionFilter(lockManager, onReject);

    const mockState: MockEditorState = {
      doc: {
        nodesBetween: (from, to, callback) => {
          // First node is locked, should return false to stop iteration
          const lockedNode = createMockLockedNode("lock_first", "muse");
          const result = callback(lockedNode);

          // In real ProseMirror, returning false stops iteration
          if (result === false) {
            return;
          }
        },
        resolve: vi.fn(),
      },
    };

    const transaction: MockTransaction = {
      docChanged: true,
      steps: [createMockStep(0, 100)],
    };

    const result = filter(transaction as unknown as Transaction, mockState);

    expect(result).toBe(false);
    // Callback should have been called (early termination is handled by nodesBetween)
  });
});
