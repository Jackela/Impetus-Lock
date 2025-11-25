# Test Suite Examples - Lock Storage Refactoring

## File Locations

All test files are in the `/mnt/d/Code/Impetus-Lock/client/src/` directory:

1. **ContentInjector.test.ts** (496 lines) - `services/ContentInjector.test.ts`
2. **prosemirror-helpers-lock-attributes.test.ts** (529 lines) - `utils/prosemirror-helpers-lock-attributes.test.ts`
3. **TransactionFilter.test.ts** (737 lines) - `components/Editor/TransactionFilter.test.ts`

**Total**: 1,762 lines of comprehensive test coverage

---

## Example Test Cases

### 1. ContentInjector - Attribute-based Lock Injection

**Test**: Create blockquote with lockId attribute (NOT HTML comment)

```typescript
it("should create blockquote node with lockId and source attributes", () => {
  const view = createMockEditorView() as unknown as EditorView;
  const content = "Test content";
  const lockId = "lock_test_123";
  const anchor = { type: "pos" as const, from: 10 };

  injectLockedBlock(view, content, lockId, anchor, "muse");

  // Verify blockquote.create was called with lockId and source in attrs
  const schema = view.state.schema;
  expect(schema.nodes.blockquote.create).toHaveBeenCalled();

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
```

**Expected Behavior**:
- BEFORE: `"Test content <!-- lock:lock_test_123 source:muse -->"`
- AFTER: `attrs = { lockId: "lock_test_123", source: "muse" }`, text = `"Test content"`

---

### 2. ContentInjector - Clean Text Content

**Test**: Ensure text content does NOT contain HTML comments

```typescript
it("should create clean text content without HTML comments", () => {
  const view = createMockEditorView() as unknown as EditorView;
  const content = "Test content";
  const lockId = "lock_test_456";
  const anchor = { type: "pos" as const, from: 10 };

  injectLockedBlock(view, content, lockId, anchor, "loki");

  // Verify text node was created with clean content (no HTML comments)
  const schema = view.state.schema;
  expect(schema.text).toHaveBeenCalledWith("Test content");

  // Ensure NO HTML comment pattern in text
  const textCall = vi.mocked(schema.text).mock.calls[0][0];
  expect(textCall).not.toContain("<!--");
  expect(textCall).not.toContain("lock:");
  expect(textCall).not.toContain("-->");
});
```

---

### 3. Lock Attributes - Primary Detection Mechanism

**Test**: Extract lockId from node.attrs (PRIMARY path)

```typescript
it("should extract lockId from node.attrs.lockId", () => {
  const node = createMockNode({ lockId: "lock_test_123" });

  const result = extractLockAttributes(node);

  expect(result).not.toBeNull();
  expect(result?.lockId).toBe("lock_test_123");
});
```

**Helper Function**:
```typescript
function createMockNode(attrs: Record<string, unknown>, textContent = ""): ProseMirrorNode {
  return {
    attrs,
    textContent,
    type: { name: "blockquote" },
    isText: false,
  } as unknown as ProseMirrorNode;
}
```

---

### 4. Lock Attributes - Migration Path

**Test**: Prioritize attributes over HTML comments (migration strategy)

```typescript
it("should prioritize node.attrs over HTML comment pattern", () => {
  const node = createMockNode(
    { lockId: "lock_attr_priority" },
    "Text <!-- lock:lock_comment_fallback -->"
  );

  const result = extractLockAttributes(node);

  // Should use attribute value, not comment value
  expect(result?.lockId).toBe("lock_attr_priority");
});
```

**Migration Strategy**:
1. Check `node.attrs.lockId` FIRST (fast, O(1))
2. Fallback to HTML comment parsing ONLY if no attrs (legacy support)
3. Future: Remove HTML comment support entirely

---

### 5. Lock Attributes - Source Detection

**Test**: Extract agent source from node attributes

```typescript
it("should extract source='muse' from node.attrs['data-source']", () => {
  const node = createMockNode({
    "data-lock-id": "lock_123",
    "data-source": "muse",
  });

  const result = extractLockAttributes(node);

  expect(result).not.toBeNull();
  expect(result?.source).toBe("muse");
});
```

---

### 6. TransactionFilter - Block Locked Deletions

**Test**: Block deletion attempts on nodes with lockId attribute

```typescript
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
  expect(onReject).toHaveBeenCalledTimes(1); // Reject callback triggered
});
```

---

### 7. TransactionFilter - No Text Scanning

**Test**: Do NOT check text content for HTML comments (attribute-only enforcement)

```typescript
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
```

**Critical Behavior Change**:
- BEFORE: Scanned `textContent` for `<!-- lock:xxx -->` (slow, O(n))
- AFTER: Checks `node.attrs.lockId` ONLY (fast, O(1))

---

### 8. TransactionFilter - Mark-based Locks

**Test**: Detect inline locks via mark attributes

```typescript
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
```

---

### 9. Edge Case - Empty Content

**Test**: Handle empty content gracefully

```typescript
it("should handle empty content gracefully", () => {
  const view = createMockEditorView() as unknown as EditorView;
  const anchor = { type: "pos" as const, from: 10 };

  injectLockedBlock(view, "", "lock_empty", anchor);

  // Should still create node with empty text
  expect(view.state.schema.text).toHaveBeenCalledWith("");
  expect(view.dispatch).toHaveBeenCalled();
});
```

---

### 10. Edge Case - Very Long Content

**Test**: Handle large content (performance test)

```typescript
it("should handle very long content (10k+ characters)", () => {
  const view = createMockEditorView() as unknown as EditorView;
  const anchor = { type: "pos" as const, from: 10 };
  const longContent = "a".repeat(10000);

  injectLockedBlock(view, longContent, "lock_long", anchor);

  expect(view.state.schema.text).toHaveBeenCalledWith(longContent);
  expect(view.dispatch).toHaveBeenCalled();
});
```

---

## Test Data Structures

### Mock Locked Node
```typescript
function createMockLockedNode(lockId: string, source?: "muse" | "loki"): ProseMirrorNode {
  return {
    type: { name: "blockquote" },
    attrs: { lockId, source },
    textContent: "Locked content",
    isText: false,
  } as unknown as ProseMirrorNode;
}
```

### Mock Unlocked Node
```typescript
function createMockUnlockedNode(): ProseMirrorNode {
  return {
    type: { name: "paragraph" },
    attrs: {},
    textContent: "Normal content",
    isText: false,
  } as unknown as ProseMirrorNode;
}
```

### Mock EditorView
```typescript
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
```

---

## Running Examples

### Run Specific Test
```bash
cd client
npm run test -- --grep "should create blockquote node with lockId"
```

### Run Test Suite with Verbose Output
```bash
npm run test src/services/ContentInjector.test.ts -- --reporter=verbose
```

### Run All Lock-related Tests
```bash
npm run test -- --grep "lock"
```

---

## Key Assertions Patterns

### Attribute-based Detection
```typescript
// Check node attributes (PRIMARY)
expect(attrs).toEqual(expect.objectContaining({
  lockId: "lock_123",
  source: "muse",
}));

// Ensure NO HTML comments in text
expect(textContent).not.toContain("<!--");
```

### Transaction Blocking
```typescript
// Filter should block transaction
expect(filter(transaction, state)).toBe(false);

// Feedback callback should be triggered
expect(onReject).toHaveBeenCalledTimes(1);
```

### Fallback Behavior (Legacy)
```typescript
// Should fallback to HTML comment parsing ONLY if no attrs
const nodeWithComment = createMockNode({}, "Text <!-- lock:lock_123 -->");
const result = extractLockAttributes(nodeWithComment);
expect(result?.lockId).toBe("lock_123");
```

---

**Generated**: 2025-11-11
**Test Framework**: Vitest + @testing-library/react
**Mock Library**: Vitest vi.fn()
**Total Test Cases**: 89 across 3 files
