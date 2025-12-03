/**
 * ProseMirror Lock Attributes Extraction Tests
 *
 * Test suite for extractLockAttributes helper function.
 * Tests the migration from HTML comment-based to node attribute-based lock detection.
 *
 * Constitutional Compliance:
 * - Article III (TDD): Red-Green-Refactor workflow for P1 lock enforcement
 * - Article III (Coverage): ≥80% coverage for critical lock extraction paths
 * - Article V (Documentation): JSDoc for all test cases
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractLockAttributes } from "./prosemirror-helpers";
import type { Node as ProseMirrorNode } from "@milkdown/prose/model";

/**
 * Helper to create mock ProseMirror node with attributes.
 */
function createMockNode(attrs: Record<string, unknown>, textContent = ""): ProseMirrorNode {
  return {
    attrs,
    textContent,
    type: { name: "blockquote" },
    isText: false,
  } as unknown as ProseMirrorNode;
}

/**
 * Helper to create mock text node.
 */
function createMockTextNode(text: string): ProseMirrorNode {
  return {
    textContent: text,
    text,
    type: { name: "text" },
    isText: true,
    nodeSize: text.length,
  } as unknown as ProseMirrorNode;
}

// Mock LockManager
vi.mock("../services/LockManager", () => ({
  lockManager: {
    getLockSource: vi.fn((lockId: string) => {
      // Return mock source for known lock IDs
      if (lockId.includes("muse")) return "muse";
      if (lockId.includes("loki")) return "loki";
      return undefined;
    }),
  },
}));

describe("extractLockAttributes - Node Attribute Extraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test: extractLockAttributes should extract lockId from node.attrs.
   *
   * Critical path: Attribute-based lock detection
   * Coverage: Primary lock detection mechanism (node attributes)
   */
  it("should extract lockId from node.attrs.lockId", () => {
    const node = createMockNode({ lockId: "lock_test_123" });

    const result = extractLockAttributes(node);

    expect(result).not.toBeNull();
    expect(result?.lockId).toBe("lock_test_123");
  });

  /**
   * Test: extractLockAttributes should extract lockId from data-lock-id attribute.
   *
   * Coverage: Alternative attribute name (HTML data-* pattern)
   */
  it("should extract lockId from node.attrs['data-lock-id']", () => {
    const node = createMockNode({ "data-lock-id": "lock_data_456" });

    const result = extractLockAttributes(node);

    expect(result).not.toBeNull();
    expect(result?.lockId).toBe("lock_data_456");
  });

  /**
   * Test: extractLockAttributes should prioritize data-lock-id over lockId.
   *
   * Coverage: Attribute priority order
   */
  it("should prefer data-lock-id over lockId when both present", () => {
    const node = createMockNode({
      "data-lock-id": "lock_data_priority",
      lockId: "lock_fallback",
    });

    const result = extractLockAttributes(node);

    expect(result?.lockId).toBe("lock_data_priority");
  });

  /**
   * Test: extractLockAttributes should extract source from node.attrs.
   *
   * Critical path: Source tracking (Muse/Loki identification)
   * Coverage: Agent source detection via attributes
   */
  it("should extract source='muse' from node.attrs['data-source']", () => {
    const node = createMockNode({
      "data-lock-id": "lock_123",
      "data-source": "muse",
    });

    const result = extractLockAttributes(node);

    expect(result).not.toBeNull();
    expect(result?.source).toBe("muse");
  });

  /**
   * Test: extractLockAttributes should extract source='loki'.
   *
   * Coverage: Loki source detection
   */
  it("should extract source='loki' from node.attrs['data-source']", () => {
    const node = createMockNode({
      lockId: "lock_456",
      "data-source": "loki",
    });

    const result = extractLockAttributes(node);

    expect(result?.source).toBe("loki");
  });

  /**
   * Test: extractLockAttributes should ignore invalid source values.
   *
   * Coverage: Source validation
   */
  it("should ignore invalid source values (not 'muse' or 'loki')", () => {
    const node = createMockNode({
      lockId: "lock_789",
      "data-source": "invalid",
    });

    const result = extractLockAttributes(node);

    expect(result?.lockId).toBe("lock_789");
    expect(result?.source).toBeUndefined();
  });

  /**
   * Test: extractLockAttributes should return null if no lock attributes present.
   *
   * Critical path: Non-locked node detection
   * Coverage: Ensures only locked nodes are identified
   */
  it("should return null when node has no lockId attributes", () => {
    const node = createMockNode({ someOtherAttr: "value" });

    const result = extractLockAttributes(node);

    expect(result).toBeNull();
  });

  /**
   * Test: extractLockAttributes should return null for empty lockId.
   *
   * Coverage: Edge case - empty string lockId
   */
  it("should return null when lockId is empty string", () => {
    const node = createMockNode({ lockId: "" });

    const result = extractLockAttributes(node);

    expect(result).toBeNull();
  });

  /**
   * Test: extractLockAttributes should handle missing attrs property.
   *
   * Coverage: Edge case - node without attrs
   */
  it("should handle nodes without attrs property gracefully", () => {
    const node = {
      textContent: "No attrs",
      type: { name: "text" },
    } as unknown as ProseMirrorNode;

    const result = extractLockAttributes(node);

    // Should not crash, may return null or fallback to text scan
    expect(result).toBeDefined(); // No error thrown
  });
});

describe("extractLockAttributes - HTML Comment Fallback (Legacy)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test: extractLockAttributes should fallback to HTML comment pattern when attrs missing.
   *
   * Coverage: Backward compatibility with HTML comment-based locks
   */
  it("should extract lockId from HTML comment when no attrs present", () => {
    const node = createMockNode({}, "Content <!-- lock:lock_comment_123 -->");

    const result = extractLockAttributes(node);

    expect(result).not.toBeNull();
    expect(result?.lockId).toBe("lock_comment_123");
  });

  it("should expose commentRange when HTML comment is present", () => {
    const comment = "<!-- lock:lock_comment_range source:muse -->";
    const text = `Text ${comment} tail`;
    const node = createMockNode({}, text);

    const result = extractLockAttributes(node);

    expect(result?.lockId).toBe("lock_comment_range");
    expect(result?.commentRange).toBeDefined();
    expect(result?.commentRange?.from).toBe(text.indexOf("<!--"));
    expect(result?.commentRange?.to).toBe(text.indexOf("<!--") + comment.length);
  });

  /**
   * Test: extractLockAttributes should extract source from HTML comment.
   *
   * Coverage: Legacy source detection
   */
  it("should extract source from HTML comment pattern", () => {
    const node = createMockNode({}, "Text <!-- lock:lock_456 source:muse -->");

    const result = extractLockAttributes(node);

    expect(result?.lockId).toBe("lock_456");
    expect(result?.source).toBe("muse");
  });

  /**
   * Test: extractLockAttributes should prefer node attributes over HTML comments.
   *
   * Critical path: Migration strategy (attributes take precedence)
   * Coverage: Ensures attribute-based storage overrides legacy comments
   */
  it("should prioritize node.attrs over HTML comment pattern", () => {
    const node = createMockNode(
      { lockId: "lock_attr_priority" },
      "Text <!-- lock:lock_comment_fallback -->"
    );

    const result = extractLockAttributes(node);

    // Should use attribute value, not comment value
    expect(result?.lockId).toBe("lock_attr_priority");
  });

  /**
   * Test: extractLockAttributes should handle HTML comment with extra whitespace.
   *
   * Coverage: Regex pattern flexibility
   */
  it("should extract lockId from comment with varying whitespace", () => {
    const node = createMockNode({}, "Text <!--   lock:lock_ws_123   source:loki   -->");

    const result = extractLockAttributes(node);

    expect(result?.lockId).toBe("lock_ws_123");
    expect(result?.source).toBe("loki");
  });

  /**
   * Test: extractLockAttributes should ignore malformed HTML comments.
   *
   * Coverage: Edge case - invalid comment syntax
   */
  it("should return null for malformed lock comments", () => {
    const node = createMockNode({}, "Text <!-- lock: --> <!-- invalid -->");

    const result = extractLockAttributes(node);

    expect(result).toBeNull();
  });

  /**
   * Test: extractLockAttributes should handle text with multiple comments (use first).
   *
   * Coverage: Edge case - multiple lock comments
   */
  it("should extract first lock comment when multiple present", () => {
    const node = createMockNode({}, "Text <!-- lock:first_lock --> more <!-- lock:second_lock -->");

    const result = extractLockAttributes(node);

    expect(result?.lockId).toBe("first_lock");
  });

  /**
   * Test: extractLockAttributes should extract contentLength from comment position.
   *
   * Coverage: Content length tracking for partial locks
   */
  it("should set contentLength to comment position in text", () => {
    const node = createMockNode({}, "Short text <!-- lock:lock_length -->");

    const result = extractLockAttributes(node);

    expect(result?.contentLength).toBe(11); // "Short text ".length
  });
});

describe("extractLockAttributes - LockManager Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test: extractLockAttributes should query LockManager for source if missing.
   *
   * Critical path: Source metadata enrichment
   * Coverage: LockManager integration for source lookup
   */
  it("should query LockManager.getLockSource when source not in attrs", async () => {
    const { lockManager } = await import("../services/LockManager");
    const node = createMockNode({ lockId: "lock_muse_query" });

    // Pass lockManager explicitly (now a required parameter for source lookup)
    const result = extractLockAttributes(node, lockManager);

    expect(lockManager.getLockSource).toHaveBeenCalledWith("lock_muse_query");
    expect(result?.source).toBe("muse"); // Mocked to return 'muse' for IDs containing 'muse'
  });

  /**
   * Test: extractLockAttributes should use attrs source over LockManager.
   *
   * Coverage: Source priority (attrs > LockManager)
   */
  it("should prefer attrs source over LockManager lookup", async () => {
    const { lockManager } = await import("../services/LockManager");
    const node = createMockNode({
      lockId: "lock_muse_123",
      "data-source": "loki", // Explicit attrs source
    });

    const result = extractLockAttributes(node);

    // Should NOT call LockManager if source already in attrs
    expect(lockManager.getLockSource).not.toHaveBeenCalled();
    expect(result?.source).toBe("loki");
  });

  /**
   * Test: extractLockAttributes should handle LockManager returning undefined.
   *
   * Coverage: Edge case - unknown lock in LockManager
   */
  it("should handle LockManager.getLockSource returning undefined", () => {
    const node = createMockNode({ lockId: "lock_unknown" });

    const result = extractLockAttributes(node);

    expect(result?.lockId).toBe("lock_unknown");
    expect(result?.source).toBeUndefined();
  });
});

describe("extractLockAttributes - Text Node Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test: extractLockAttributes should detect contentLength for text nodes.
   *
   * Coverage: Text node size tracking
   */
  it("should set contentLength to nodeSize for text nodes when lock present", () => {
    const textNode = createMockTextNode("Sample text content");
    // Add lockId via HTML comment pattern
    const nodeWithLock = {
      ...textNode,
      textContent: "Sample <!-- lock:lock_text_123 -->",
      text: "Sample <!-- lock:lock_text_123 -->",
      nodeSize: 34,
    } as unknown as ProseMirrorNode;

    const result = extractLockAttributes(nodeWithLock);

    // contentLength should be set from comment position OR nodeSize
    expect(result?.lockId).toBe("lock_text_123");
    expect(result?.contentLength).toBeDefined();
  });

  /**
   * Test: extractLockAttributes should handle text nodes without locks.
   *
   * Coverage: Non-locked text nodes
   */
  it("should return null for text nodes without lock markers", () => {
    const textNode = createMockTextNode("Plain text without locks");

    const result = extractLockAttributes(textNode);

    expect(result).toBeNull();
  });
});

describe("extractLockAttributes - NOT Scanning Text Content (Refactored Behavior)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test: extractLockAttributes should NOT scan text content if attributes present.
   *
   * Critical path: Performance optimization (attribute-first strategy)
   * Coverage: Ensures migration path - attributes eliminate need for text scanning
   *
   * NOTE: This test documents the REFACTORED behavior where HTML comment scanning
   * is only a fallback. Once migration is complete, comment scanning can be removed.
   */
  it("should NOT scan textContent when lockId found in attributes", () => {
    const node = createMockNode(
      { lockId: "lock_attr_only" },
      "Text with fake <!-- lock:lock_fake --> comment"
    );

    const result = extractLockAttributes(node);

    // Should use attribute, NOT scan text
    expect(result?.lockId).toBe("lock_attr_only");
    expect(result?.lockId).not.toBe("lock_fake");
  });

  /**
   * Test: After migration, extractLockAttributes should ONLY check attributes.
   *
   * Coverage: Future state - no HTML comment support
   *
   * NOTE: This is a forward-looking test. Once all locks are migrated to attributes,
   * the HTML comment fallback can be removed entirely.
   */
  it("[FUTURE] should ignore HTML comments entirely after migration complete", () => {
    const node = createMockNode({}, "Text <!-- lock:lock_ignored -->");

    // BEFORE migration: Result will extract from comment (fallback)
    // AFTER migration: This should return null (no attributes = no lock)
    const result = extractLockAttributes(node);

    // Current behavior: Fallback to comment (result is not null)
    // Future behavior: No fallback (result should be null)
    // Uncomment assertion below once migration is complete:
    // expect(result).toBeNull();

    // For now, verify fallback still works:
    expect(result?.lockId).toBe("lock_ignored");
  });
});

describe("extractLockAttributes - Edge Cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test: extractLockAttributes should handle null/undefined node.
   *
   * Coverage: Defensive programming
   */
  it("should handle null node gracefully", () => {
    expect(() => {
      extractLockAttributes(null as unknown as ProseMirrorNode);
    }).not.toThrow();
  });

  /**
   * Test: extractLockAttributes should handle node with non-string lockId.
   *
   * Coverage: Type safety
   */
  it("should ignore non-string lockId values in attrs", () => {
    const node = createMockNode({ lockId: 12345 }); // Number instead of string

    const result = extractLockAttributes(node);

    // Should ignore non-string lockId
    expect(result).toBeNull();
  });

  /**
   * Test: extractLockAttributes should handle very long lockId strings.
   *
   * Coverage: Edge case - large attribute values
   */
  it("should handle very long lockId strings (1000+ chars)", () => {
    const longLockId = "lock_" + "a".repeat(1000);
    const node = createMockNode({ lockId: longLockId });

    const result = extractLockAttributes(node);

    expect(result?.lockId).toBe(longLockId);
  });

  /**
   * Test: extractLockAttributes should handle special characters in lockId.
   *
   * Coverage: Edge case - special characters
   */
  it("should handle lockId with special characters", () => {
    const specialLockId = "lock_test-123_special.id";
    const node = createMockNode({ lockId: specialLockId });

    const result = extractLockAttributes(node);

    expect(result?.lockId).toBe(specialLockId);
  });

  /**
   * Test: extractLockAttributes should handle case-insensitive source values.
   *
   * Coverage: Case normalization
   */
  it("should normalize source to lowercase (Muse -> muse)", () => {
    const node = createMockNode({}, "Text <!-- lock:lock_123 source:MUSE -->");

    const result = extractLockAttributes(node);

    expect(result?.source).toBe("muse"); // Lowercased
  });
});
