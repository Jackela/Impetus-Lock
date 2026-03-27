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
import { createLogger } from "../utils/logger";

const logger = createLogger("ContentInjector");

type Anchor = components["schemas"]["Anchor"];

/**
 * Append lock marker comment to content.
 *
 * Sanitizes existing HTML comments and appends a new lock comment
 * in the format `<!-- lock:lock_id [source:muse] -->`.
 *
 * @param content - Content to append lock marker to
 * @param lockId - Lock identifier to embed
 * @param source - Optional agent source for the lock
 * @returns Content with lock comment appended
 *
 * @example
 * ```typescript
 * const content = '> Muse intervention';
 * const withLock = appendLockMarker(content, 'lock_001', 'muse');
 * // '> Muse intervention <!-- lock:lock_001 source:muse -->'
 * ```
 */
function appendLockMarker(content: string, lockId: string, source?: AgentSource): string {
  const sanitized = content.replace(/<!--[\s\S]*?-->/g, "").trimEnd();
  const parts = [`lock:${lockId}`];
  if (source) {
    parts.push(`source:${source}`);
  }
  return `${sanitized} <!-- ${parts.join(" ")} -->`;
}

/**
 * Build lock attributes object for ProseMirror nodes.
 *
 * Creates attribute object with lockId and optionally source for node metadata.
 *
 * @param lockId - Lock identifier
 * @param source - Optional agent source
 * @returns Attribute object for ProseMirror node
 *
 * @example
 * ```typescript
 * const attrs = buildLockAttributes('lock_001', 'muse');
 * // { lockId: 'lock_001', source: 'muse' }
 * ```
 */
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
    logger.error("Invalid insertion position", { insertPos });
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

  // Note: Sensory feedback (Glitch animation + Clank sound) is handled by
  // SensoryFeedback component in EditorCore, triggered by currentAction state
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

  // CRITICAL: Throttle to prevent rapid-fire deletions
  const now = Date.now();
  const lastDelete = lastDeleteTimestamp ?? 0;

  if (now - lastDelete < DELETE_THROTTLE_MS) {
    return;
  }

  lastDeleteTimestamp = now;

  // Validate range
  if (from < 0 || to > state.doc.content.size || from >= to) {
    logger.error("Invalid delete range", {
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
}

/**
 * Delete the sentence immediately before the cursor.
 *
 * Identifies the last sentence range using text analysis and removes it.
 * Used as a fallback when server doesn't provide specific anchor range.
 *
 * @param view - Milkdown editor view
 *
 * @example
 * ```typescript
 * // User presses delete key near end of document
 * deleteLastSentence(editorView);
 * ```
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
 *
 * Replaces content within the specified anchor range with new locked content.
 * Falls back to rewriting the last sentence if anchor is invalid or missing.
 *
 * @param view - Milkdown editor view
 * @param content - New locked content to insert
 * @param lockId - Lock identifier for the new content
 * @param anchor - Optional anchor range specifying what to replace
 * @param source - Optional agent source for styling
 *
 * @example
 * ```typescript
 * const response = await triggerLokiIntervention(...);
 *
 * if (response.action === 'rewrite' && response.anchor?.type === 'range') {
 *   rewriteRangeWithLock({
 *     view: editorView,
 *     content: response.content,
 *     lockId: response.lock_id,
 *     anchor: response.anchor,
 *     source: response.source
 *   });
 * }
 * ```
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
    logger.warn("Rewrite skipped: anchor missing, falling back to sentence heuristic");
    rewriteLastSentenceWithLock(view, content, lockId, source);
    return;
  }

  const { from, to } = anchor;
  if (from < 0 || to > state.doc.content.size || from >= to) {
    logger.warn("Rewrite skipped: invalid anchor range", { anchor });
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
}

/**
 * Rewrite the last sentence before the cursor with locked text (fallback).
 *
 * Identifies the last sentence range and replaces it with locked content.
 * Used when server response lacks a specific anchor or anchor is invalid.
 *
 * @param view - Milkdown editor view
 * @param content - New locked content to insert
 * @param lockId - Lock identifier for the new content
 * @param source - Optional agent source for styling
 *
 * @example
 * ```typescript
 * // Fallback when no anchor provided
 * rewriteLastSentenceWithLock(
 *   editorView,
 *   '门后传来呼吸声。',
 *   'lock_01j4z3m8a6q3qz2x8j4z3m8a',
 *   'muse'
 * );
 * ```
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
    logger.warn("Rewrite skipped: invalid heuristic range", { range });
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
}
