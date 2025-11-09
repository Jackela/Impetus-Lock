/**
 * ProseMirror Helper Utilities
 *
 * Utility functions for working with ProseMirror state and marks.
 * Used by FloatingToolbar for active state tracking.
 *
 * These helpers abstract common ProseMirror state inspection patterns,
 * making it easier to determine active formatting (marks) and document
 * structure (node types and hierarchy).
 *
 * @module prosemirror-helpers
 */

import type { EditorState, MarkType } from "@milkdown/prose/model";

/**
 * Check if a mark type is active in current selection.
 * Handles both cursor position (empty selection) and text range selection.
 *
 * @param state - ProseMirror editor state
 * @param markType - Mark type to check (e.g., strongType, emphasisType)
 * @returns `true` if mark is active, `false` otherwise
 *
 * @example
 * ```typescript
 * // Check if bold mark is active
 * const strongType = state.schema.marks.strong;
 * const isBold = hasMark(state, strongType);
 * ```
 */
export function hasMark(state: EditorState, markType: MarkType): boolean {
  if (!markType) return false;
  const { from, $from, to, empty } = state.selection;

  if (empty) {
    // Cursor position: check stored marks or marks at cursor
    return !!markType.isInSet(state.storedMarks || $from.marks());
  }

  // Text selection: check range
  return state.doc.rangeHasMark(from, to, markType);
}

/**
 * Get heading level (1-6) if selection is inside a heading node.
 * Returns `null` if not inside a heading.
 *
 * @param state - ProseMirror editor state
 * @returns Heading level (1-6) or `null`
 *
 * @example
 * ```typescript
 * const level = getHeadingLevel(state);
 *
 * if (level === 1) {
 *   // Selection is inside H1
 * } else if (level === 2) {
 *   // Selection is inside H2
 * } else if (level === null) {
 *   // Not inside a heading
 * }
 * ```
 */
export function getHeadingLevel(state: EditorState): number | null {
  const { $from } = state.selection;
  const parent = $from.parent;

  if (parent.type.name === "heading" && parent.attrs.level) {
    return parent.attrs.level as number;
  }

  return null;
}

/**
 * Check if selection is inside a bullet list.
 * Walks up the parent node tree to detect list_item nodes.
 *
 * @param state - ProseMirror editor state
 * @returns `true` if inside a bullet list, `false` otherwise
 *
 * @example
 * ```typescript
 * const inList = isInBulletList(state);
 *
 * if (inList) {
 *   // Selection is inside a bullet list
 * }
 * ```
 */
export function isInBulletList(state: EditorState): boolean {
  const { $from } = state.selection;

  // Walk up the parent node tree to find a list_item
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === "list_item") {
      return true;
    }
  }

  return false;
}
