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
import type { AgentSource } from "../types/mode";
import { getLastSentenceRange } from "../utils/textRange";

type Anchor = components["schemas"]["Anchor"];

function appendLockMarker(content: string, lockId: string, source?: AgentSource): string {
  const sanitized = content.replace(/<!--[\s\S]*?-->/g, "").trimEnd();
  const parts = [`lock:${lockId}`];
  if (source) {
    parts.push(`source:${source}`);
  }
  return `${sanitized} <!-- ${parts.join(" ")} -->`;
}

function buildLockAttributes(lockId: string, source?: AgentSource) {
  return source ? { lockId, source } : { lockId };
}

/**
 * Inject locked blockquote content into editor at anchor position.
 *
 * Creates a new ProseMirror transaction that inserts the content
 * as a blockquote node with lock_id attribute for enforcement.
 *
 * @param view - Milkdown editor view (ProseMirror)
 * @param content - Intervention content (plain text, caller decides Markdown formatting)
 * @param lockId - Lock ID for un-deletable enforcement
 * @param anchor - Position where to inject (pos, range, or lock_id)
 * @param source - Agent source (Muse/Loki) for downstream styling
 *
 * @example
 * ```typescript
 * const response = await triggerMuseIntervention(...);
 *
 * if (response.action === 'provoke') {
 *   injectLockedBlock(
 *     editorView,
 *     response.content,      // "门后传来呼吸声。"
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
  anchor: Anchor,
  source?: AgentSource
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

  const contentWithLockMarker = appendLockMarker(content, lockId, source);

  // Create blockquote node with lock attributes
  const schema = state.schema;
  const textNode = schema.text(contentWithLockMarker);
  const paragraphNode = schema.nodes.paragraph.create(null, textNode);
  const blockquoteNode = schema.nodes.blockquote.create(
    buildLockAttributes(lockId, source), // Lock metadata stored in node attributes
    paragraphNode
  );

  // Create transaction to insert blockquote
  const tr = state.tr.insert(insertPos, blockquoteNode);

  // Mark transaction as addToHistory: false (Undo Bypass per Article VI)
  tr.setMeta("addToHistory", false);
  tr.setMeta("aiAction", true);
  tr.setMeta("actionType", "provoke");

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
// Module-level throttle state for delete operations
// Using closure instead of window global to avoid state pollution
const DELETE_THROTTLE_MS = 1500; // 1.5 seconds minimum between deletes
let lastDeleteTimestamp: number | null = null;

export function deleteContentAtAnchor(
  view: EditorView,
  anchor: Extract<Anchor, { type: "range" }>
): void {
  const { state, dispatch } = view;
  const { from, to } = anchor;

  // DEBUG: Log detailed delete information
  console.log("[ContentInjector] deleteContentAtAnchor called:", {
    from,
    to,
    docSize: state.doc.content.size,
    deleteLength: to - from,
    throttleRemaining: Math.max(
      0,
      DELETE_THROTTLE_MS - (Date.now() - (lastDeleteTimestamp ?? 0))
    ),
  });

  // CRITICAL: Throttle to prevent rapid-fire deletions
  const now = Date.now();
  const lastDelete = lastDeleteTimestamp ?? 0;

  if (now - lastDelete < DELETE_THROTTLE_MS) {
    console.log(
      `[ContentInjector] THROTTLED - ${DELETE_THROTTLE_MS - (now - lastDelete)}ms remaining`
    );
    return;
  }

  lastDeleteTimestamp = now;

  // Validate range
  if (from < 0 || to > state.doc.content.size || from >= to) {
    console.error("[ContentInjector] Invalid delete range:", {
      from,
      to,
      docSize: state.doc.content.size,
    });
    return;
  }

  // Create delete transaction
  const tr = state.tr.delete(from, to);

  // Mark as non-undoable (Undo Bypass)
  tr.setMeta("addToHistory", false);
  tr.setMeta("aiAction", true);
  tr.setMeta("actionType", "delete");

  // Dispatch transaction
  dispatch(tr);

  console.log(`[ContentInjector] ✅ Deleted content successfully`, {
    from,
    to,
    deletedLength: to - from,
  });
}

/**
 * Delete the sentence immediately before the cursor.
 */
export function deleteLastSentence(view: EditorView): void {
  const range = getLastSentenceRange(view.state);
  if (range.to <= range.from) {
    return;
  }

  deleteContentAtAnchor(view, { type: "range", from: range.from, to: range.to });
}

/**
 * Rewrite a server-provided range with locked text.
 */
export function rewriteRangeWithLock({
  view,
  content,
  lockId,
  anchor,
  source,
}: {
  view: EditorView;
  content: string;
  lockId: string;
  anchor?: Extract<Anchor, { type: "range" }>;
  source?: AgentSource;
}): void {
  const { state, dispatch } = view;

  if (!anchor || anchor.type !== "range") {
    console.warn(
      "[ContentInjector] Rewrite skipped: anchor missing, falling back to sentence heuristic"
    );
    rewriteLastSentenceWithLock(view, content, lockId, source);
    return;
  }

  const { from, to } = anchor;
  if (from < 0 || to > state.doc.content.size || from >= to) {
    console.warn("[ContentInjector] Rewrite skipped: invalid anchor range", anchor);
    return;
  }

  const contentWithLockMarker = appendLockMarker(content, lockId, source);
  // Create paragraph node with lock attributes
  const schema = state.schema;
  const textNode = schema.text(contentWithLockMarker);
  const paragraphNode = schema.nodes.paragraph.create(
    buildLockAttributes(lockId, source),
    textNode
  );

  // Delete old range and insert new locked paragraph
  let tr = state.tr.delete(from, to);
  tr = tr.insert(from, paragraphNode);
  tr.setMeta("addToHistory", false);
  tr.setMeta("aiAction", true);
  tr.setMeta("actionType", "rewrite");
  dispatch(tr);

  console.log(`[ContentInjector] ✏️ Rewrote locked span`, { ...anchor, lockId });
}

/**
 * Rewrite the last sentence before the cursor with locked text (fallback).
 */
export function rewriteLastSentenceWithLock(
  view: EditorView,
  content: string,
  lockId: string,
  source?: AgentSource
): void {
  const { state, dispatch } = view;
  const range = getLastSentenceRange(state);
  if (range.to <= range.from) {
    console.warn("[ContentInjector] Rewrite skipped: invalid heuristic range", range);
    return;
  }

  const contentWithLockMarker = appendLockMarker(content, lockId, source);
  // Create paragraph node with lock attributes
  const schema = state.schema;
  const textNode = schema.text(contentWithLockMarker);
  const paragraphNode = schema.nodes.paragraph.create(
    buildLockAttributes(lockId, source),
    textNode
  );

  // Delete old range and insert new locked paragraph
  let tr = state.tr.delete(range.from, range.to);
  tr = tr.insert(range.from, paragraphNode);
  tr.setMeta("addToHistory", false);
  tr.setMeta("aiAction", true);
  tr.setMeta("actionType", "rewrite");
  dispatch(tr);

  console.log(`[ContentInjector] ✏️ Rewrote locked span`, { ...range, lockId, fallback: true });
}
