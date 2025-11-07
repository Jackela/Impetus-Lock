/**
 * ProseMirror Transaction Filter for Lock Enforcement
 *
 * Implements editor-level transaction filtering to prevent deletion/modification
 * of locked blocks. Uses Milkdown's filterTransaction API.
 *
 * Constitutional Compliance:
 * - Article I (Simplicity): Uses native ProseMirror API (no custom wrapper)
 * - Article V (Documentation): Complete JSDoc for all functions
 *
 * @module components/Editor/TransactionFilter
 */

import type { Transaction } from "@milkdown/prose/state";
// eslint-disable-next-line no-restricted-imports -- TransactionFilter needs LockManager type
import type { LockManager } from "../../services/LockManager";

/**
 * Create a transaction filter function for lock enforcement.
 *
 * Returns a filter function that can be used with ProseMirror's
 * filterTransaction mechanism to block deletions of locked content.
 *
 * How it works:
 * 1. Check if transaction deletes or modifies content
 * 2. Scan affected document range for lock markers
 * 3. Block transaction if it affects locked content
 * 4. Trigger visual/audio feedback on blocked attempt
 *
 * @param lockManager - LockManager instance with active locks
 * @param onReject - Callback fired when locked content deletion is blocked (triggers REJECT feedback)
 * @returns Filter function (tr, state) => boolean
 *
 * @example
 * ```typescript
 * import { lockManager } from '../../services/LockManager';
 *
 * const filter = createLockTransactionFilter(lockManager, () => {
 *   console.log('Lock rejection triggered!');
 * });
 *
 * // Apply to Milkdown editor
 * editor.action((ctx) => {
 *   const view = ctx.get(editorViewCtx);
 *   const oldFilter = view.props.filterTransaction;
 *
 *   view.setProps({
 *     filterTransaction: (tr, state) => {
 *       // Apply lock filter first
 *       if (!filter(tr, state)) return false;
 *       // Chain with existing filters
 *       return oldFilter ? oldFilter(tr, state) : true;
 *     }
 *   });
 * });
 * ```
 */
export function createLockTransactionFilter(lockManager: LockManager, onReject?: () => void) {
  /**
   * Filter function for ProseMirror transactions.
   *
   * @param tr - ProseMirror transaction to evaluate
   * @param state - Current editor state
   * @returns True if transaction is allowed, false to block it
   */
  return (
    tr: Transaction,
    state: {
      doc: {
        nodesBetween: (from: number, to: number, callback: (node: unknown) => void | false) => void;
      };
    }
  ): boolean => {
    if (!tr.docChanged) {
      return true;
    }

    let affectsLock = false;

    tr.steps.forEach((step) => {
      const stepMap = step.getMap();

      stepMap.forEach((oldStart, oldEnd) => {
        state.doc.nodesBetween(oldStart, oldEnd, (node: unknown) => {
          const anyNode = node as Record<string, unknown>;
          const attrs = anyNode.attrs as Record<string, unknown> | undefined;
          if (
            attrs?.lockId &&
            typeof attrs.lockId === "string" &&
            lockManager.hasLock(attrs.lockId)
          ) {
            affectsLock = true;
            return false;
          }

          const marks = anyNode.marks as Array<{ attrs?: Record<string, unknown> }> | undefined;
          if (marks) {
            for (const mark of marks) {
              const markAttrs = mark.attrs;
              if (
                markAttrs?.lockId &&
                typeof markAttrs.lockId === "string" &&
                lockManager.hasLock(markAttrs.lockId)
              ) {
                affectsLock = true;
                return false;
              }
            }
          }

          if (anyNode.isText && typeof anyNode.text === "string") {
            const lockPattern = /<!--\s*lock:(\S+)\s*-->/;
            const match = anyNode.text.match(lockPattern);
            if (match && lockManager.hasLock(match[1])) {
              affectsLock = true;
              return false;
            }
          }
        });
      });
    });

    // Block transaction if it affects locked content
    if (affectsLock) {
      // Trigger REJECT action sensory feedback (shake animation + bonk sound)
      if (onReject) {
        onReject();
      }
      console.warn("Transaction blocked: Affects locked content");
      return false;
    }

    // Allow transaction if no locks affected
    return true;
  };
}

/**
 * Check if a ProseMirror position intersects with locked content.
 *
 * Utility function to check if a specific position in the document
 * is within a locked block.
 *
 * @param state - ProseMirror editor state
 * @param pos - Document position to check
 * @param lockManager - LockManager instance
 * @returns True if position is within locked content
 *
 * @example
 * ```typescript
 * if (isPositionLocked(state, 1234, lockManager)) {
 *   console.log('Cannot place cursor here - locked');
 * }
 * ```
 */
export function isPositionLocked(
  state: {
    doc: { resolve: (pos: number) => { node: (depth?: number) => unknown; depth: number } };
  },
  pos: number,
  lockManager: LockManager
): boolean {
  let locked = false;

  const $pos = state.doc.resolve(pos);

  for (let depth = $pos.depth; depth >= 0; depth--) {
    const nodeAtDepth = $pos.node(depth) as Record<string, unknown>;
    const attrs = nodeAtDepth.attrs as Record<string, unknown> | undefined;

    if (attrs?.lockId && typeof attrs.lockId === "string" && lockManager.hasLock(attrs.lockId)) {
      locked = true;
      break;
    }
  }

  return locked;
}

export function markNodeAsLocked(
  node: Record<string, unknown>,
  lockId: string
): Record<string, unknown> {
  const anyNode = node as {
    type: {
      create: (
        attrs: Record<string, unknown>,
        content: unknown,
        marks: unknown
      ) => Record<string, unknown>;
    };
    attrs: Record<string, unknown>;
    content: unknown;
    marks: unknown;
  };
  return anyNode.type.create(
    {
      ...anyNode.attrs,
      lockId,
    },
    anyNode.content,
    anyNode.marks
  );
}
