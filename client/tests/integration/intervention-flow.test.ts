/**
 * Integration Tests for Full Intervention Flow
 *
 * Tests end-to-end integration:
 * 1. API call to backend
 * 2. Lock application from response
 * 3. Lock enforcement in editor
 * 4. Lock persistence across refresh
 *
 * Constitutional Compliance:
 * - Article III (TDD): Integration tests for critical flows
 * - Article V (Documentation): JSDoc comments
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { generateIntervention } from "../../src/services/api/interventionClient";
import { lockManager } from "../../src/services/LockManager";
import type { components } from "../../src/types/api.generated";
import { EditorState, type Transaction } from "@milkdown/prose/state";
import { Schema } from "@milkdown/prose/model";
import { EditorView } from "@milkdown/prose/view";
import { deleteWithoutUndo, insertWithoutUndo } from "../../src/components/Editor/UndoBypass";

type InterventionResponse = components["schemas"]["InterventionResponse"];

// Clear singleton lock state before every test in this file so assertions
// stay order-independent under --sequence.shuffle (tests leave locks behind).
beforeEach(() => {
  lockManager.clear();
});

describe("Integration: API → Lock Application → Enforcement", () => {
  /**
   * Test T039: Apply lock from API response.
   *
   * Flow:
   * 1. Call generateIntervention API
   * 2. Receive provoke response with lock_id
   * 3. Apply lock to lockManager
   * 4. Verify lock is enforced
   */
  it("should apply lock from API provoke response", async () => {
    // Mock fetch for API call
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () =>
        ({
          action: "provoke",
          content: "门后传来低沉的呼吸声。",
          lock_id: "lock_test_integration_001",
          anchor: { type: "pos", from: 1234 },
          action_id: "act_test_001",
          issued_at: new Date().toISOString(),
          source: "muse",
        }) as InterventionResponse,
    });

    // Call API
    const response = await generateIntervention({
      context: "他打开门，犹豫着要不要进去。",
      mode: "muse",
      client_meta: {
        doc_version: 42,
        selection_from: 1234,
        selection_to: 1234,
      },
    });

    // Verify response structure
    expect(response.action).toBe("provoke");
    expect(response.lock_id).toBe("lock_test_integration_001");

    // Apply lock from response
    lockManager.applyLock(response.lock_id!, { source: response.source });

    // Verify lock is active
    expect(lockManager.hasLock("lock_test_integration_001")).toBe(true);
    expect(lockManager.getLockCount()).toBe(1);
    expect(lockManager.getLockMetadata("lock_test_integration_001")?.source).toBe("muse");
  });

  it("should handle rewrite responses with inline metadata", async () => {
    const rewriteResponse: InterventionResponse = {
      action: "rewrite",
      content: "他改写了最后一句话。",
      lock_id: "lock_rewrite_001",
      anchor: { type: "range", from: 10, to: 25 },
      action_id: "act_rewrite_001",
      issued_at: new Date().toISOString(),
      source: "muse",
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => rewriteResponse,
    });

    const response = await generateIntervention({
      context: "Test context",
      mode: "muse",
      client_meta: { doc_version: 1, selection_from: 15, selection_to: 15 },
    });

    expect(response.action).toBe("rewrite");
    expect(response.anchor?.type).toBe("range");
    lockManager.applyLock(response.lock_id!, { source: response.source });
    expect(lockManager.getLockMetadata("lock_rewrite_001")?.source).toBe("muse");
  });

  /**
   * Test T040: Lock persistence via Markdown comments.
   *
   * Flow:
   * 1. Inject lock comment into content
   * 2. Simulate page refresh (extract locks from markdown)
   * 3. Verify lock is restored
   */
  it("should persist locks via Markdown comments across refresh", () => {
    const lockId = "lock_test_persistence_001";
    const content = "Test content";

    // Inject lock comment
    const withLock = lockManager.injectLockComment(content, lockId, { source: "muse" });
    expect(withLock).toContain("<!-- lock:lock_test_persistence_001 source:muse -->");

    // Simulate page refresh - clear in-memory locks
    lockManager.clear();
    expect(lockManager.getLockCount()).toBe(0);

    // Extract locks from markdown (simulates page load)
    const extractedLocks = lockManager.extractLocksFromMarkdown(withLock);
    expect(extractedLocks).toEqual([lockId]);

    // Reapply extracted locks
    extractedLocks.forEach((id) => lockManager.applyLock(id));

    // Verify lock is restored
    expect(lockManager.hasLock(lockId)).toBe(true);
  });

  /**
   * Test: Multiple locks from multiple interventions.
   */
  it("should handle multiple locks from sequential interventions", async () => {
    // Mock multiple API responses
    const mockResponses: InterventionResponse[] = [
      {
        action: "provoke",
        content: "Response 1",
        lock_id: "lock_multi_001",
        anchor: { type: "pos", from: 100 },
        action_id: "act_001",
        issued_at: new Date().toISOString(),
        source: "muse",
      },
      {
        action: "provoke",
        content: "Response 2",
        lock_id: "lock_multi_002",
        anchor: { type: "pos", from: 200 },
        action_id: "act_002",
        issued_at: new Date().toISOString(),
        source: "loki",
      },
      {
        action: "provoke",
        content: "Response 3",
        lock_id: "lock_multi_003",
        anchor: { type: "pos", from: 300 },
        action_id: "act_003",
        issued_at: new Date().toISOString(),
        source: "muse",
      },
    ];

    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      const response = mockResponses[callCount++];
      return Promise.resolve({
        ok: true,
        json: async () => response,
      });
    });

    // Apply locks from each response
    for (const mockResp of mockResponses) {
      const response = await generateIntervention({
        context: "Test context",
        mode: "muse",
        client_meta: { doc_version: 1, selection_from: 0, selection_to: 0 },
      });

      expect(response.lock_id).toBe(mockResp.lock_id);
      lockManager.applyLock(response.lock_id!, { source: response.source });
    }

    // Verify all locks active
    expect(lockManager.getLockCount()).toBe(3);
    expect(lockManager.hasLock("lock_multi_001")).toBe(true);
    expect(lockManager.hasLock("lock_multi_002")).toBe(true);
    expect(lockManager.hasLock("lock_multi_003")).toBe(true);
  });

  /**
   * Test: Idempotency - same key returns cached response.
   */
  it("should use cached response for duplicate idempotency keys", async () => {
    const idempotencyKey = "test-key-duplicate";
    const mockResponse: InterventionResponse = {
      action: "provoke",
      content: "Cached content",
      lock_id: "lock_cached_001",
      anchor: { type: "pos", from: 1234 },
      action_id: "act_cached_001",
      issued_at: new Date().toISOString(),
      source: "muse",
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    // First call
    const response1 = await generateIntervention(
      {
        context: "Test context",
        mode: "muse",
        client_meta: { doc_version: 1, selection_from: 0, selection_to: 0 },
      },
      { idempotencyKey }
    );

    // Second call with same key
    const response2 = await generateIntervention(
      {
        context: "Test context",
        mode: "muse",
        client_meta: { doc_version: 1, selection_from: 0, selection_to: 0 },
      },
      { idempotencyKey }
    );

    // Responses should be identical (cached)
    expect(response1.action_id).toBe(response2.action_id);
    expect(response1.lock_id).toBe(response2.lock_id);

    // Fetch should be called twice (backend handles caching)
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe("Integration: Error Handling", () => {
  /**
   * Test T042: Network failure handling.
   */
  it("should handle network errors gracefully", async () => {
    // Mock network failure
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    // Attempt API call
    await expect(
      generateIntervention({
        context: "Test",
        mode: "muse",
        client_meta: { doc_version: 1, selection_from: 0, selection_to: 0 },
      })
    ).rejects.toThrow("Network error");

    // Verify locks remain unchanged
    expect(lockManager.getLockCount()).toBe(0);
  });

  /**
   * Test: API error responses (400, 422, 500).
   */
  it("should throw InterventionAPIError for HTTP errors", async () => {
    // Mock 422 validation error
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        error: "ValidationError",
        message: "Invalid mode value",
        details: { field: "mode", received: "chaos" },
      }),
    });

    // Attempt API call
    await expect(
      generateIntervention({
        context: "Test",
        mode: "muse" as any,
        client_meta: { doc_version: 1, selection_from: 0, selection_to: 0 },
      })
    ).rejects.toThrow();
  });
});

describe("Integration: Lock Comment Parsing", () => {
  /**
   * Test: Extract locks from complex Markdown.
   */
  it("should extract multiple locks from complex markdown", () => {
    const markdown = `
# Document Title

Normal paragraph text.

> Muse intervention <!-- lock:lock_001 source:muse -->

More normal text here.

> Loki chaos <!-- lock:lock_002 source:loki -->

Final paragraph.

> Muse encore <!-- lock:lock_003 -->
    `.trim();

    const locks = lockManager.extractLocksFromMarkdown(markdown);

    expect(locks).toHaveLength(3);
    expect(locks).toContain("lock_001");
    expect(locks).toContain("lock_002");
    expect(locks).toContain("lock_003");
  });

  /**
   * Test: Ignore malformed lock comments.
   */
  it("should ignore malformed lock comments", () => {
    const markdown = `
> Good lock <!-- lock:lock_valid source:muse -->
> Bad lock <!-- lock: -->
> Also bad <!-- locklock_invalid -->
> Missing colon <!-- lock lock_missing -->
    `.trim();

    const locks = lockManager.extractLocksFromMarkdown(markdown);

    expect(locks).toHaveLength(1);
    expect(locks).toEqual(["lock_valid"]);
  });
});

describe("Integration: Undo Bypass for AI Actions", () => {
  const views: EditorView[] = [];
  function fixture() {
    const schema = new Schema({
      nodes: {
        doc: { content: "paragraph+" },
        paragraph: { content: "text*", toDOM: () => ["p", 0] },
        text: {},
      },
    });
    const doc = schema.node(
      "doc",
      null,
      schema.node("paragraph", null, schema.text("x".repeat(998)))
    );
    const transactions: Transaction[] = [];
    const view = new EditorView(document.createElement("div"), {
      state: EditorState.create({ schema, doc }),
      dispatchTransaction(tr) {
        transactions.push(tr);
        view.updateState(view.state.apply(tr));
      },
    });
    views.push(view);
    return { view, transactions };
  }
  afterEach(() => {
    for (const view of views.splice(0)) view.destroy();
  });
  function expectMetadata(transactions: Transaction[], action: string) {
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.getMeta("addToHistory")).toBe(false);
    expect(transactions[0]?.getMeta("aiAction")).toBe(true);
    expect(transactions[0]?.getMeta("actionType")).toBe(action);
  }
  it("should bypass undo stack for AI delete actions", () => {
    const { view, transactions } = fixture();
    expect(deleteWithoutUndo(view, 100, 200)).toBe(true);
    expect(view.state.doc.textContent).toHaveLength(898);
    expectMetadata(transactions, "delete");
  });
  it("should bypass undo stack for AI insert actions", () => {
    const { view, transactions } = fixture();
    const content = "Test content <!-- lock:lock_test source:muse -->";
    expect(insertWithoutUndo(view, 500, content)).toBe(true);
    expect(view.state.doc.textContent).toContain(content);
    expectMetadata(transactions, "provoke");
  });
  it("should reject invalid deletion ranges", () => {
    const { view, transactions } = fixture();
    for (const [from, to] of [
      [-10, 100],
      [100, 2000],
      [500, 500],
      [600, 500],
    ] as const) {
      expect(deleteWithoutUndo(view, from, to)).toBe(false);
    }
    expect(transactions).toHaveLength(0);
    expect(view.state.doc.textContent).toBe("x".repeat(998));
  });
});
