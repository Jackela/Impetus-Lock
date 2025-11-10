# Lock Rejection Feedback - Debug Report

**Date**: 2025-11-10
**Issue**: E2E tests failing for lock rejection feedback (3/4 tests)
**Status**: Root cause identified, fixes implemented, timing issue remains

## Test Status

```
✅ keyboard-hint-footer.spec.ts:     6/6 passing
✅ locked-content-styling.spec.ts:   4/4 passing
⚠️  lock-rejection-feedback.spec.ts:  1/4 passing
    ✅ Web Audio API initialized
    ❌ Lock rejection triggers sensory feedback
    ❌ Lock rejection does not modify locked content
    ❌ Sensory feedback disappears after animation
```

## Root Causes Identified

### Root Cause 1: Missing Auto-Clear Timer for REJECT Action ✅ FIXED

**Location**: `EditorCore.tsx:318`

**Problem**: When lock rejection triggered, `AIActionType.REJECT` was set but never cleared, causing sensory feedback to persist indefinitely.

**Fix Applied**:
```typescript
const lockFilter = createLockTransactionFilter(lockManager, () => {
  setCurrentAction(AIActionType.REJECT);
  // Auto-clear after animation completes (matches ANIMATION_DURATION)
  setTimeout(() => setCurrentAction(null), 1000);  // ✅ ADDED
});
```

**Validation**: ESLint ✅, TypeScript ✅, Pattern matches other action handlers

---

### Root Cause 2: Lock Detection Not Working in TransactionFilter ✅ FIXED

**Location**: `TransactionFilter.ts:79-93`

**Problem**: Initial implementation scanned text content and used manual regex, but failed to detect locks because:
1. `tr.doc.textContent` scanned the NEW document (after deletion)
2. `textContent` doesn't include HTML comments
3. Wrong traversal method (`nodesBetween` vs `descendants`)

**Fix Applied**: Adopted the exact pattern from LockDecorations (which successfully detects locks):

```typescript
// Auto-detect and register locks from current document
// Uses same approach as LockDecorations plugin (which successfully finds locks)
const docNode = state.doc as unknown as {
  descendants: (callback: (node: unknown) => void) => void;
};

if (docNode && docNode.descendants) {
  docNode.descendants((node: unknown) => {
    const lockId = extractLockId(node);
    if (lockId && !lockManager.hasLock(lockId)) {
      lockManager.applyLock(lockId);
      console.log('[TransactionFilter] Auto-registered lock:', lockId);
    }
  });
}
```

**Validation**: Same pattern as LockDecorations (4/4 tests passing), uses shared `extractLockId()` utility

---

### Root Cause 3: Timing Race Condition ⚠️ UNRESOLVED

**Evidence**:
- LockDecorations tests: 4/4 passing ✅ (decorations applied correctly)
- Lock rejection tests: 1/4 passing ⚠️ (deletion blocking fails)

**Hypothesis**: The auto-lock detection in TransactionFilter runs **during** the transaction being filtered, potentially **after** the filter check.

**Execution order suspected**:
```
1. User presses Backspace → Transaction created
2. filterTransaction called → Checks if locks affected
3. Auto-detect code runs → Registers lock (TOO LATE)
4. Transaction proceeds → Lock check returns false (lock not registered yet)
```

**Supporting evidence**:
- Tests insert locked content: `document.execCommand('insertText', '> AI <!-- lock:test_001 -->')`
- Tests wait 500ms for decorations
- Tests attempt deletion immediately after
- Console logs show locks being registered, but deletion still succeeds

---

## Files Modified

### ✅ EditorCore.tsx (Line 318)
- Added auto-clear timer for REJECT action
- Added auto-lock detection in dispatch override (lines 358-368)

### ✅ TransactionFilter.ts (Lines 17, 79-93, 126-133)
- Imported `extractLockId` utility
- Implemented auto-lock detection using `doc.descendants()`
- Simplified lock checking logic

### 📖 Reference Files (No changes)
- `LockDecorations.ts` - Working pattern for lock detection
- `locked-content-styling.spec.ts` - 4/4 passing tests
- `lock-rejection-feedback.spec.ts` - 1/4 passing tests

---

## Diagnostic Findings

### What Works ✅
1. Lock decorations (visual styling) - 4/4 tests passing
2. `extractLockId()` utility successfully finds locks in document
3. LockManager correctly tracks registered locks
4. Auto-clear timer pattern matches other action types
5. Code quality gates pass (ESLint, TypeScript)

### What Doesn't Work ❌
1. Transaction filter blocking deletions of locked content
2. Sensory feedback triggering on lock rejection
3. Tests consistently fail despite auto-detection implementation

### Key Insight 💡
**LockDecorations and TransactionFilter use identical lock detection patterns, but:**
- LockDecorations runs **after** document changes (decorations are reactive)
- TransactionFilter runs **before** document changes (preventive filtering)

**This timing difference may explain why decorations work but filtering doesn't.**

---

## Next Steps (Recommended Approach)

### Option A: Move Lock Detection Earlier (Recommended)

Instead of detecting locks **during** transaction filtering, register locks when content is inserted:

**Approach**: Enhance the EditorCore dispatch override to register locks **before** transactions are filtered.

```typescript
// In EditorCore.tsx dispatch override (line 350)
view.dispatch = (tr) => {
  // BEFORE processing transaction, detect and register locks
  if (tr.docChanged) {
    const fullText = tr.doc.textContent;
    const detectedLocks = lockManager.extractLocksFromMarkdown(fullText);
    detectedLocks.forEach((lockId) => {
      if (!lockManager.hasLock(lockId)) {
        lockManager.applyLock(lockId);
        console.log('[EditorCore] Pre-registered lock:', lockId);
      }
    });
  }

  // NOW apply transaction (filter will see registered locks)
  originalDispatchTransaction(tr);

  // Rest of the existing logic...
};
```

**Pros**:
- Locks registered before transaction filter runs
- Guarantees correct execution order
- Minimal code changes

**Cons**:
- Lock detection runs on every transaction (small performance impact)

---

### Option B: Fix Test Setup (Alternative)

Modify tests to manually register locks before attempting deletion:

```typescript
// In lock-rejection-feedback.spec.ts
await page.evaluate(() => {
  const lockManager = (window as any).lockManager;
  if (lockManager) {
    lockManager.applyLock('test_lock_reject_001');
  }
});
```

**Pros**:
- Simpler fix
- Tests explicitly control state

**Cons**:
- Doesn't fix underlying timing issue
- Real users would have the same problem
- Not a production-ready solution

---

### Option C: Add Explicit Wait in Tests (Not Recommended)

Add longer delays in tests to allow auto-detection to complete:

```typescript
// Wait for lock detection to complete
await page.waitForTimeout(2000);
```

**Pros**:
- Easiest fix

**Cons**:
- Flaky tests (timing-dependent)
- Doesn't solve root cause
- Poor practice

---

## Recommended Action

**Implement Option A**: Move lock detection to run **before** transaction filtering by enhancing the EditorCore dispatch override.

**Rationale**:
1. ✅ Guarantees correct execution order
2. ✅ Fixes both tests and production behavior
3. ✅ Aligns with how locks are currently detected (auto-registration pattern already exists)
4. ✅ Small performance impact (lock detection is fast)
5. ✅ Maintains constitutional compliance (Article I: Simplicity)

**Implementation Plan**:
1. Move lock detection from TransactionFilter to EditorCore dispatch (before `originalDispatchTransaction(tr)`)
2. Keep TransactionFilter focused on filtering only (SRP compliance)
3. Re-run E2E tests to validate
4. Document the fix in code comments

---

## Quality Gates

**Current Status**:
- ✅ ESLint: 0 errors
- ✅ TypeScript: 0 errors
- ✅ Prettier: Formatted
- ✅ Code review: Patterns match existing implementations
- ⚠️ E2E tests: 1/4 passing (lock-rejection-feedback.spec.ts)

**After implementing Option A, expect**:
- ✅ E2E tests: 4/4 passing
- ✅ All quality gates green
- ✅ Ready for PR

---

## References

- **Spec**: `specs/chrome-audit-polish/specs/lock-rejection-feedback/spec.md`
- **Design**: `openspec/changes/chrome-audit-polish/design.md#4-lock-rejection-feedback-validation`
- **Related Tests**: `locked-content-styling.spec.ts` (4/4 passing - decorations work)
- **LockManager**: `src/services/LockManager.ts` (central lock registry)
- **extractLockId Utility**: `src/utils/prosemirror-helpers.ts` (shared lock detection)

---

## Update 2 - Deep Dive Debugging (2025-11-10 Part 2)

### Attempts Made:

1. ✅ **Implemented Option A**: Moved lock detection to EditorCore dispatch (before transaction processing)
2. ✅ **Used `extractLockId()` utility**: Same pattern as LockDecorations (which works)
3. ✅ **Added manual lock registration**: `window.lockManager.applyLock()` in tests
4. ⚠️ **Tests still failing**: Even with manual registration, sensory feedback doesn't appear

### Current Investigation:

**Added extensive console logging** to both EditorCore and TransactionFilter to trace:
- When locks are registered
- What TransactionFilter sees when checking transactions
- Whether `lockManager.hasLock()` returns true
- What nodes are scanned during deletion

**Files with debug logging**:
- `EditorCore.tsx:363-369`: Auto-lock detection with `extractLockId()`
- `TransactionFilter.ts:82-149`: Detailed transaction checking logs
- `EditorCore.tsx:314-316`: Exposed `window.lockManager` for testing

### Hypothesis:

The issue may not be lock detection timing, but rather:
1. **Test insertion method**: Tests use `document.execCommand('insertText')` which may not trigger ProseMirror's markdown parser correctly
2. **Lock marker format mismatch**: HTML comments might not be stored in ProseMirror nodes as expected
3. **TransactionFilter execution order**: Filter may run before dispatch override registers locks

### Next Debugging Steps:

**Option C: Manual Browser Testing** (Recommended)
1. Open dev server manually
2. Insert locked content via `document.execCommand` in browser console
3. Check console logs to see what EditorCore and TransactionFilter output
4. Verify if HTML comments are preserved in ProseMirror nodes
5. Try deleting content and observe the flow

**Option D: Refactor Test Insertion Method**
Instead of `document.execCommand('insertText', false, markdown)`, use:
```javascript
// Directly manipulate editor state via Milkdown API
await page.evaluate(() => {
  const editorElement = document.querySelector('.milkdown') as HTMLElement;
  const editor = (window as any).editor; // Need to expose editor instance

  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { state, dispatch } = view;

    // Create proper ProseMirror nodes with lock attributes
    const schema = state.schema;
    const textNode = schema.text('> AI-locked content <!-- lock:test_lock_001 -->');
    const blockquote = schema.nodes.blockquote.create(
      { 'data-lock-id': 'test_lock_001' },
      schema.nodes.paragraph.create(null, textNode)
    );

    const tr = state.tr.replaceWith(0, 0, blockquote);
    dispatch(tr);
  });
});
```

**Option E: Skip HTML Comment Locks, Use Attribute Locks Only**
ContentInjector uses `data-lock-id` attributes (line 82), not HTML comments. Tests should follow the same pattern.

## Conclusion

**Summary**: Implemented comprehensive fixes including Option A (early lock detection), but tests still fail even with manual lock registration.

**Status**:
- ✅ EditorCore auto-lock detection implemented
- ✅ TransactionFilter checking logic intact
- ✅ Manual lock registration added
- ⚠️ Tests failing - investigation ongoing

**Recommended Next Action**: Option C (Manual browser testing) to observe actual behavior and console logs in real-time, then Option D or E based on findings.
