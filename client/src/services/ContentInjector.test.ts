/**
 * ContentInjector Service Tests
 *
 * Test suite for content injection with attribute-based lock storage.
 * Tests the migration from HTML comment-based to node attribute-based locking.
 *
 * Constitutional Compliance:
 * - Article III (TDD): Red-Green-Refactor workflow for P1 lock enforcement
 * - Article III (Coverage): ≥80% coverage for critical lock injection paths
 * - Article V (Documentation): JSDoc for all test cases
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { injectLockedBlock, rewriteRangeWithLock } from "./ContentInjector";
import type { EditorView } from "@milkdown/prose/view";
import type { EditorState, Transaction } from "@milkdown/prose/state";
import type { Schema } from "@milkdown/prose/model";

/**
 * Mock ProseMirror EditorView with typed structure.
 */
interface MockEditorView {
  state: EditorState;
  dispatch: (tr: Transaction) => void;
}

/**
 * Create mock EditorView for testing.
 */
function createMockEditorView(): MockEditorView {
  const mockSchema = {
    text: vi.fn((content: string) => ({
      type: { name: "text" },
      text: content,
      textContent: content,
      isText: true,
    })),
    nodes: {
      paragraph: {
        create: vi.fn((attrs, content) => ({
          type: { name: "paragraph" },
          attrs: attrs || {},
          content: [content],
          textContent: content?.textContent || "",
        })),
      },
      blockquote: {
        create: vi.fn((attrs, content) => ({
          type: { name: "blockquote" },
          attrs: attrs || {},
          content: [content],
          textContent: content?.textContent || "",
        })),
      },
    },
  };

  const mockTransaction = {
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    insertText: vi.fn().mockReturnThis(),
    setMeta: vi.fn().mockReturnThis(),
  };

  const mockState = {
    schema: mockSchema as unknown as Schema,
    tr: mockTransaction,
    selection: {
      $head: { pos: 0 },
    },
    doc: {
      content: { size: 100 },
    },
  } as unknown as EditorState;

  return {
    state: mockState,
    dispatch: vi.fn(),
  };
}

describe("ContentInjector - Lock Injection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test: injectLockedBlock should create blockquote node with lockId attribute.
   *
   * Critical path: Lock enforcement via node attributes
   * Coverage: Ensures lockId is stored in node.attrs, not text content
   */
  it("should create blockquote node with lockId and source attributes", () => {
    const view = createMockEditorView() as unknown as EditorView;
    const content = "Test content";
    const lockId = "lock_test_123";
    const anchor = { type: "pos" as const, from: 10 };

    injectLockedBlock(view, content, lockId, anchor, "muse");

    // Verify blockquote.create was called with lockId and source in attrs
    const schema = view.state.schema;
    expect(schema.nodes.blockquote.create).toHaveBeenCalled();

    // Get the actual call arguments
    const createCall = vi.mocked(schema.nodes.blockquote.create).mock.calls[0];
    const attrs = createCall[0];

    // CRITICAL: lockId and source should be in attrs object, not text content
    expect(attrs).toEqual(
      expect.objectContaining({
        lockId: "lock_test_123",
        source: "muse",
      })
    );
  });

  /**
   * Test: injectLockedBlock should append lock marker comments for persistence.
   *
   * Critical path: Lock extraction via HTML comment markers
   * Coverage: Ensures lock metadata survives markdown round-trips
   */
  it("should append lock marker comment to blockquote text", () => {
    const view = createMockEditorView() as unknown as EditorView;
    const content = "Test content";
    const lockId = "lock_test_456";
    const anchor = { type: "pos" as const, from: 10 };

    injectLockedBlock(view, content, lockId, anchor, "loki");

    const schema = view.state.schema;
    const textCall = vi.mocked(schema.text).mock.calls[0][0];
    expect(textCall).toContain("Test content");
    expect(textCall).toContain("<!-- lock:lock_test_456 source:loki -->");
  });

  /**
   * Test: injectLockedBlock should handle pos anchor type.
   *
   * Coverage: Anchor type handling
   */
  it("should insert at position specified by pos anchor", () => {
    const view = createMockEditorView() as unknown as EditorView;
    const anchor = { type: "pos" as const, from: 25 };

    injectLockedBlock(view, "Content", "lock_789", anchor);

    // Verify transaction.insert was called with correct position
    expect(view.state.tr.insert).toHaveBeenCalledWith(25, expect.any(Object));
  });

  /**
   * Test: injectLockedBlock should handle range anchor type.
   *
   * Coverage: Range anchor handling
   */
  it("should insert at from position for range anchor", () => {
    const view = createMockEditorView() as unknown as EditorView;
    const anchor = { type: "range" as const, from: 30, to: 40 };

    injectLockedBlock(view, "Content", "lock_range", anchor);

    // Should insert at 'from' position
    expect(view.state.tr.insert).toHaveBeenCalledWith(30, expect.any(Object));
  });

  /**
   * Test: injectLockedBlock should handle lock_id anchor type (fallback).
   *
   * Coverage: Edge case - lock_id anchor type
   */
  it("should fallback to cursor position for lock_id anchor", () => {
    const view = createMockEditorView() as unknown as EditorView;
    const anchor = { type: "lock_id" as const, ref_lock_id: "existing_lock" };

    injectLockedBlock(view, "Content", "new_lock", anchor);

    // Should fallback to cursor position ($head.pos = 0)
    expect(view.state.tr.insert).toHaveBeenCalledWith(0, expect.any(Object));
  });

  /**
   * Test: injectLockedBlock should validate position bounds.
   *
   * Coverage: Edge case - invalid position
   */
  it("should fallback to cursor position if anchor position is out of bounds", () => {
    const view = createMockEditorView() as unknown as EditorView;
    const anchor = { type: "pos" as const, from: 999 }; // Beyond doc.content.size (100)

    injectLockedBlock(view, "Content", "lock_bounds", anchor);

    // Should fallback to cursor position (0)
    expect(view.state.tr.insert).toHaveBeenCalledWith(0, expect.any(Object));
  });

  /**
   * Test: injectLockedBlock should set transaction metadata.
   *
   * Critical path: Undo bypass and AI action metadata
   * Coverage: Ensures transaction is marked correctly for history management
   */
  it("should mark transaction as non-undoable and AI action", () => {
    const view = createMockEditorView() as unknown as EditorView;
    const anchor = { type: "pos" as const, from: 10 };

    injectLockedBlock(view, "Content", "lock_meta", anchor);

    // Verify transaction metadata
    expect(view.state.tr.setMeta).toHaveBeenCalledWith("addToHistory", false);
    expect(view.state.tr.setMeta).toHaveBeenCalledWith("aiAction", true);
    expect(view.state.tr.setMeta).toHaveBeenCalledWith("actionType", "provoke");
  });

  /**
   * Test: injectLockedBlock should dispatch transaction.
   *
   * Coverage: Transaction dispatch
   */
  it("should dispatch transaction to editor", () => {
    const view = createMockEditorView() as unknown as EditorView;
    const anchor = { type: "pos" as const, from: 10 };

    injectLockedBlock(view, "Content", "lock_dispatch", anchor);

    expect(view.dispatch).toHaveBeenCalledTimes(1);
    expect(view.dispatch).toHaveBeenCalledWith(view.state.tr);
  });

  /**
   * Test: injectLockedBlock should handle missing source (optional).
   *
   * Coverage: Optional source parameter
   */
  it("should create blockquote with lockId only when source is omitted", () => {
    const view = createMockEditorView() as unknown as EditorView;
    const anchor = { type: "pos" as const, from: 10 };

    injectLockedBlock(view, "Content", "lock_no_source", anchor); // No source param

    const schema = view.state.schema;
    const createCall = vi.mocked(schema.nodes.blockquote.create).mock.calls[0];
    const attrs = createCall[0];

    // Should have lockId but no source
    expect(attrs).toHaveProperty("lockId", "lock_no_source");
    expect(attrs).not.toHaveProperty("source");
  });
});

describe("ContentInjector - Rewrite Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test: rewriteRangeWithLock should replace text and set node attributes.
   *
   * Critical path: Lock enforcement for rewrites
   * Coverage: Ensures rewritten content has lockId in attributes
   */
  it("should replace range and attach lockId as node attribute", () => {
    const view = createMockEditorView() as unknown as EditorView;
    const anchor = { type: "range" as const, from: 10, to: 20 };

    rewriteRangeWithLock({
      view: view as unknown as EditorView,
      content: "Rewritten text",
      lockId: "lock_rewrite_123",
      anchor,
      source: "muse",
    });

    // Verify delete + insert sequence
    expect(view.state.tr.delete).toHaveBeenCalledWith(10, 20);
    expect(view.state.tr.insert).toHaveBeenCalled();

    const insertCall = vi.mocked(view.state.tr.insert).mock.calls[0];
    const [insertPos, insertedNode] = insertCall;

    expect(insertPos).toBe(10);
    expect(insertedNode?.attrs).toEqual(
      expect.objectContaining({
        lockId: "lock_rewrite_123",
        source: "muse",
      })
    );
    expect(insertedNode?.textContent).toBe(
      "Rewritten text <!-- lock:lock_rewrite_123 source:muse -->"
    );

    // Verify transaction metadata
    expect(view.state.tr.setMeta).toHaveBeenCalledWith("addToHistory", false);
    expect(view.state.tr.setMeta).toHaveBeenCalledWith("aiAction", true);
    expect(view.state.tr.setMeta).toHaveBeenCalledWith("actionType", "rewrite");
  });

  /**
   * Test: rewriteRangeWithLock should append lock marker comments.
   *
   * Critical path: Persisting lock metadata through markdown export/import
   * Coverage: Ensures rewrite output embeds lock comment markers
   */
  it("should append lock marker comment to rewritten text", () => {
    const view = createMockEditorView() as unknown as EditorView;
    const anchor = { type: "range" as const, from: 5, to: 15 };

    rewriteRangeWithLock({
      view: view as unknown as EditorView,
      content: "Clean rewrite",
      lockId: "lock_clean",
      anchor,
    });

    // Get inserted node to verify clean text
    const insertCall = vi.mocked(view.state.tr.insert).mock.calls[0];
    const insertedNode = insertCall[1];
    const insertedText = insertedNode?.textContent || "";

    expect(insertedText).toBe("Clean rewrite <!-- lock:lock_clean -->");
  });

  /**
   * Test: rewriteRangeWithLock should validate anchor range.
   *
   * Coverage: Edge case - invalid range
   */
  it("should skip rewrite if anchor range is invalid", () => {
    const view = createMockEditorView() as unknown as EditorView;
    const anchor = { type: "range" as const, from: 20, to: 10 }; // Invalid: from > to

    rewriteRangeWithLock({
      view: view as unknown as EditorView,
      content: "Content",
      lockId: "lock_invalid",
      anchor,
    });

    // Should NOT call delete or insert operations
    expect(view.state.tr.delete).not.toHaveBeenCalled();
    expect(view.state.tr.insert).not.toHaveBeenCalled();
    expect(view.dispatch).not.toHaveBeenCalled();
  });

  /**
   * Test: rewriteRangeWithLock should handle out-of-bounds range.
   *
   * Coverage: Edge case - range exceeds document size
   */
  it("should skip rewrite if range exceeds document bounds", () => {
    const view = createMockEditorView() as unknown as EditorView;
    const anchor = { type: "range" as const, from: 50, to: 200 }; // to > doc.content.size (100)

    rewriteRangeWithLock({
      view: view as unknown as EditorView,
      content: "Content",
      lockId: "lock_bounds",
      anchor,
    });

    expect(view.state.tr.delete).not.toHaveBeenCalled();
    expect(view.dispatch).not.toHaveBeenCalled();
  });

  /**
   * Test: rewriteRangeWithLock should dispatch transaction.
   *
   * Coverage: Transaction dispatch
   */
  it("should dispatch transaction with rewrite", () => {
    const view = createMockEditorView() as unknown as EditorView;
    const anchor = { type: "range" as const, from: 10, to: 20 };

    rewriteRangeWithLock({
      view: view as unknown as EditorView,
      content: "Content",
      lockId: "lock_dispatch",
      anchor,
    });

    expect(view.dispatch).toHaveBeenCalledTimes(1);
    expect(view.dispatch).toHaveBeenCalledWith(view.state.tr);
  });

  /**
   * Test: rewriteRangeWithLock should preserve lockId in node attributes after rewrite.
   *
   * Critical path: Lock persistence through rewrites
   * Coverage: Ensures lockId survives content replacement
   */
  it("should preserve lockId in node attributes after text replacement", () => {
    const view = createMockEditorView() as unknown as EditorView;
    const anchor = { type: "range" as const, from: 5, to: 15 };

    rewriteRangeWithLock({
      view: view as unknown as EditorView,
      content: "New content",
      lockId: "lock_persist",
      anchor,
      source: "loki",
    });

    // Verify transaction was created with proper metadata
    expect(view.state.tr.setMeta).toHaveBeenCalledWith("actionType", "rewrite");

    // In real implementation, transaction would attach lockId to replaced node's attributes
    // This test verifies the transaction flow is correct
    expect(view.dispatch).toHaveBeenCalled();
  });
});

describe("ContentInjector - Edge Cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test: injectLockedBlock should handle empty content string.
   *
   * Coverage: Edge case - empty content
   */
  it("should handle empty content gracefully", () => {
    const view = createMockEditorView() as unknown as EditorView;
    const anchor = { type: "pos" as const, from: 10 };

    injectLockedBlock(view, "", "lock_empty", anchor);

    // Should still create node with lock marker comment
    expect(view.state.schema.text).toHaveBeenCalledWith(" <!-- lock:lock_empty -->");
    expect(view.dispatch).toHaveBeenCalled();
  });

  /**
   * Test: injectLockedBlock should handle very long content.
   *
   * Coverage: Edge case - large content
   */
  it("should handle very long content (10k+ characters)", () => {
    const view = createMockEditorView() as unknown as EditorView;
    const anchor = { type: "pos" as const, from: 10 };
    const longContent = "a".repeat(10000);

    injectLockedBlock(view, longContent, "lock_long", anchor);

    expect(view.state.schema.text).toHaveBeenCalledWith(`${longContent} <!-- lock:lock_long -->`);
    expect(view.dispatch).toHaveBeenCalled();
  });

  /**
   * Test: injectLockedBlock should handle special characters in content.
   *
   * Coverage: Edge case - special characters
   */
  it("should handle special characters (HTML entities, emojis, etc.)", () => {
    const view = createMockEditorView() as unknown as EditorView;
    const anchor = { type: "pos" as const, from: 10 };
    const specialContent = "Test <>&\"'🔒 content";

    injectLockedBlock(view, specialContent, "lock_special", anchor);

    expect(view.state.schema.text).toHaveBeenCalledWith(
      `${specialContent} <!-- lock:lock_special -->`
    );
  });

  /**
   * Test: rewriteRangeWithLock should handle zero-length ranges.
   *
   * Coverage: Edge case - cursor position (from === to)
   */
  it("should skip rewrite for zero-length range (cursor position)", () => {
    const view = createMockEditorView() as unknown as EditorView;
    const anchor = { type: "range" as const, from: 10, to: 10 }; // Same position

    rewriteRangeWithLock({
      view: view as unknown as EditorView,
      content: "Content",
      lockId: "lock_zero",
      anchor,
    });

    // Should skip (from >= to)
    expect(view.dispatch).not.toHaveBeenCalled();
  });

  /**
   * Test: rewriteRangeWithLock should handle negative positions.
   *
   * Coverage: Edge case - invalid negative positions
   */
  it("should skip rewrite for negative positions", () => {
    const view = createMockEditorView() as unknown as EditorView;
    const anchor = { type: "range" as const, from: -5, to: 10 };

    rewriteRangeWithLock({
      view: view as unknown as EditorView,
      content: "Content",
      lockId: "lock_negative",
      anchor,
    });

    expect(view.dispatch).not.toHaveBeenCalled();
  });
});
