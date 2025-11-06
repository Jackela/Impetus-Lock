/**
 * Content Injector Service
 *
 * Handles injection of AI-generated locked content into the editor.
 * Applies lock_id attributes and triggers visual/audio feedback.
 *
 * Constitutional Compliance:
 * - Article I (Simplicity): Direct ProseMirror manipulation, no complex plugins
 * - Article V (Documentation): Complete JSDoc for all exported functions
 *
 * @module services/ContentInjector
 */

import type { EditorView } from "@milkdown/prose/view";
import type { components } from "../types/api.generated";

type Anchor = components["schemas"]["Anchor"];

/**
 * Inject locked blockquote content into editor at anchor position.
 *
 * Creates a new ProseMirror transaction that inserts the content
 * as a blockquote node with lock_id attribute for enforcement.
 *
 * @param view - Milkdown editor view (ProseMirror)
 * @param content - Intervention content (already formatted with "> " prefix)
 * @param lockId - Lock ID for un-deletable enforcement
 * @param anchor - Position where to inject (pos, range, or lock_id)
 *
 * @example
 * ```typescript
 * const response = await triggerMuseIntervention(...);
 *
 * if (response.action === 'provoke') {
 *   injectLockedBlock(
 *     editorView,
 *     response.content,      // "> [AI施压]: 门后传来呼吸声。"
 *     response.lock_id,       // "lock_01j4z3m8a6q3qz2x8j4z3m8a"
 *     response.anchor         // { type: "pos", from: 1234 }
 *   );
 * }
 * ```
 */
export function injectLockedBlock(
  view: EditorView,
  content: string,
  lockId: string,
  anchor: Anchor
): void {
  const { state, dispatch } = view;

  // Determine insertion position from anchor
  let insertPos: number;

  if (anchor.type === "pos") {
    insertPos = anchor.from;
  } else if (anchor.type === "range") {
    insertPos = anchor.from;
  } else if (anchor.type === "lock_id") {
    // Find position of existing lock
    // For now, insert at current cursor position
    insertPos = state.selection.$head.pos;
  } else {
    // Fallback: insert at cursor
    insertPos = state.selection.$head.pos;
  }

  // Validate position is within document bounds
  if (insertPos < 0 || insertPos > state.doc.content.size) {
    console.error("Invalid insertion position:", insertPos);
    insertPos = state.selection.$head.pos;
  }

  // Strip "> " prefix from content (will be added by blockquote node)
  const cleanContent = content.replace(/^>\s*/, "");

  // Create blockquote node with lock_id attribute
  const schema = state.schema;
  const textNode = schema.text(cleanContent);
  const paragraphNode = schema.nodes.paragraph.create(null, textNode);
  const blockquoteNode = schema.nodes.blockquote.create(
    { "data-lock-id": lockId }, // Custom attribute for lock enforcement
    paragraphNode
  );

  // Create transaction to insert blockquote
  const tr = state.tr.insert(insertPos, blockquoteNode);

  // Mark transaction as addToHistory: false (Undo Bypass per Article VI)
  tr.setMeta("addToHistory", false);

  // Dispatch transaction
  dispatch(tr);

  // TODO: Trigger "Glitch" animation on inserted node
  // TODO: Play "Clank" sound effect

  console.log(`[ContentInjector] Injected locked block at pos ${insertPos}:`, lockId);
}

/**
 * Delete content at anchor range (Loki mode).
 *
 * Creates transaction that removes content within specified range
 * and marks it as non-undoable (Undo Bypass).
 *
 * @param view - Milkdown editor view
 * @param anchor - Range to delete
 *
 * @example
 * ```typescript
 * const response = await triggerLokiIntervention(...);
 *
 * if (response.action === 'delete' && response.anchor.type === 'range') {
 *   deleteContentAtAnchor(editorView, response.anchor);
 * }
 * ```
 */
export function deleteContentAtAnchor(
  view: EditorView,
  anchor: Extract<Anchor, { type: "range" }>
): void {
  const { state, dispatch } = view;

  // Validate range
  const { from, to } = anchor;
  if (from < 0 || to > state.doc.content.size || from >= to) {
    console.error("Invalid delete range:", { from, to });
    return;
  }

  // Create delete transaction
  const tr = state.tr.delete(from, to);

  // Mark as non-undoable (Undo Bypass)
  tr.setMeta("addToHistory", false);

  // Dispatch transaction
  dispatch(tr);

  console.log(`[ContentInjector] Deleted content from ${from} to ${to}`);
}
