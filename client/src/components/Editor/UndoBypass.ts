/**
 * Undo Bypass for AI Delete Actions
 *
 * Implements mechanism to bypass ProseMirror Undo stack for AI-initiated deletions.
 * Ensures AI Delete actions are irreversible (User Story 1, Acceptance Scenario 2).
 *
 * Constitutional Compliance:
 * - Article I (Simplicity): Uses ProseMirror's native appendTransaction API
 * - Article V (Documentation): Complete JSDoc for all functions
 *
 * @module components/Editor/UndoBypass
 */

import type { Transaction } from "@milkdown/prose/state";
import type { EditorView } from "@milkdown/prose/view";

/**
 * Execute a deletion that bypasses the Undo stack.
 *
 * Uses ProseMirror's low-level transaction API to delete content
 * without adding to the Undo history. This makes AI Delete actions
 * irreversible as per User Story 1 requirements.
 *
 * Implementation Strategy:
 * 1. Create transaction with `addToHistory: false` meta flag
 * 2. Apply deletion steps to transaction
 * 3. Dispatch transaction directly (bypass history plugin)
 *
 * @param view - ProseMirror EditorView instance
 * @param from - Start position of deletion range
 * @param to - End position of deletion range
 * @returns True if deletion succeeded, false otherwise
 *
 * @example
 * ```typescript
 * // AI decides to delete "突然，门后传来脚步声。" (positions 1289-1310)
 * const success = deleteWithoutUndo(editorView, 1289, 1310);
 *
 * if (success) {
 *   console.log('AI deletion executed - cannot be undone');
 * }
 *
 * // User presses Ctrl+Z
 * // → Deletion persists (not in Undo stack)
 * ```
 */
export function deleteWithoutUndo(view: EditorView, from: number, to: number): boolean {
  const { state, dispatch } = view;

  // Validate positions
  if (from < 0 || to > state.doc.content.size || from >= to) {
    console.error("Invalid deletion range:", { from, to, docSize: state.doc.content.size });
    return false;
  }

  // Create transaction with history bypass meta flag
  let tr = state.tr.delete(from, to);

  // Mark transaction as non-undoable
  tr = tr.setMeta("addToHistory", false);

  // Optional: Mark as AI action for tracking
  tr = tr.setMeta("aiAction", true);
  tr = tr.setMeta("actionType", "delete");

  // Dispatch transaction
  dispatch(tr);

  return true;
}

/**
 * Check if a transaction is an AI action (should bypass Undo).
 *
 * Utility function to identify transactions that should not be undoable.
 * Used by history plugin to filter out AI actions.
 *
 * @param tr - ProseMirror transaction to check
 * @returns True if transaction is an AI action
 *
 * @example
 * ```typescript
 * // In history plugin filter
 * if (isAIAction(tr)) {
 *   return false; // Don't add to history
 * }
 * ```
 */
export function isAIAction(tr: Transaction): boolean {
  return tr.getMeta("aiAction") === true;
}

/**
 * Insert content that bypasses the Undo stack.
 *
 * Used for AI Provoke actions - injected content should not be undoable.
 * Similar to deleteWithoutUndo, but for insertions.
 *
 * @param view - ProseMirror EditorView instance
 * @param pos - Position to insert at
 * @param content - Content to insert (Markdown string or ProseMirror node)
 * @returns True if insertion succeeded
 *
 * @example
 * ```typescript
 * const content = '门后传来低沉的呼吸声。 <!-- lock:lock_001 -->';
 * insertWithoutUndo(editorView, 1234, content);
 *
 * // User presses Ctrl+Z
 * // → Insertion persists (not in Undo stack)
 * ```
 */
export function insertWithoutUndo(
  view: EditorView,
  pos: number,
  content: string | Record<string, unknown>
): boolean {
  const { state, dispatch } = view;

  // Validate position
  if (pos < 0 || pos > state.doc.content.size) {
    console.error("Invalid insertion position:", { pos, docSize: state.doc.content.size });
    return false;
  }

  // Convert string to ProseMirror node if needed
  let node;
  if (typeof content === "string") {
    // Parse Markdown to ProseMirror node
    // Note: Currently creates simple text node. To support rich Markdown content,
    // use ctx.get(parserCtx)(content) from Milkdown context when available.
    node = state.schema.text(content);
  } else {
    node = content;
  }

  // Create transaction with history bypass
  let tr = state.tr.insert(pos, node);
  tr = tr.setMeta("addToHistory", false);
  tr = tr.setMeta("aiAction", true);
  tr = tr.setMeta("actionType", "provoke");

  dispatch(tr);

  return true;
}

/**
 * Configure ProseMirror history plugin to respect AI action bypass.
 *
 * Modifies the history plugin's transaction filter to exclude AI actions.
 * This ensures AI-initiated changes are not added to the Undo stack.
 *
 * @param historyPlugin - ProseMirror history plugin instance
 * @returns Modified plugin configuration
 *
 * @example
 * ```typescript
 * import { history } from '@milkdown/plugin-history';
 *
 * const modifiedHistory = configureHistoryBypass(history);
 *
 * editor.use(modifiedHistory);
 * ```
 */
export function configureHistoryBypass(
  historyPlugin: Record<string, unknown>
): Record<string, unknown> {
  const plugin = historyPlugin as {
    spec?: { historyPreserveItems?: (tr: Transaction) => boolean };
  };
  const originalFilter = plugin.spec?.historyPreserveItems;

  return {
    ...historyPlugin,
    spec: {
      ...plugin.spec,
      historyPreserveItems: (tr: Transaction) => {
        if (tr.getMeta("addToHistory") === false) {
          return false;
        }

        return originalFilter ? originalFilter(tr) : true;
      },
    },
  };
}

/**
 * Type guard to check if view has Undo capability.
 *
 * @param view - ProseMirror EditorView
 * @returns True if view supports Undo
 */
export function canUndo(view: EditorView): boolean {
  const { state } = view;
  // Check if history plugin is active
  return state.plugins.some((plugin) => plugin.spec?.historyPreserveItems);
}

/**
 * Type guard to check if view has Redo capability.
 *
 * @param view - ProseMirror EditorView
 * @returns True if view supports Redo
 */
export function canRedo(view: EditorView): boolean {
  return canUndo(view); // Same check - if history exists, both undo/redo exist
}
