/**
 * ProseMirror Helper Function Interfaces
 * 
 * Type definitions for utility functions that interact with ProseMirror state.
 * These helpers abstract common patterns for checking mark/node types.
 * 
 * @module ProseMirrorHelpers
 */

import type { EditorState, MarkType, NodeType } from '@milkdown/prose/model';

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
 * 
 * // Check for empty selection (cursor position)
 * if (state.selection.empty) {
 *   // Returns true if cursor is within bold text
 *   // or bold mark is in stored marks
 * }
 * 
 * // Check for text selection
 * if (!state.selection.empty) {
 *   // Returns true if entire range has bold mark
 * }
 * ```
 */
export type HasMarkFunction = (state: EditorState, markType: MarkType) => boolean;

/**
 * Check if cursor/selection is inside a specific node type.
 * Useful for checking if selection is inside heading, list, blockquote, etc.
 * 
 * @param state - ProseMirror editor state
 * @param nodeType - Node type to check (e.g., headingType, bulletListType)
 * @returns `true` if selection is inside node type, `false` otherwise
 * 
 * @example
 * ```typescript
 * const headingType = state.schema.nodes.heading;
 * const isInHeading = isInsideNode(state, headingType);
 * 
 * // Check specific heading level
 * const isH2 = isInHeading && state.selection.$from.parent.attrs.level === 2;
 * ```
 */
export type IsInsideNodeFunction = (state: EditorState, nodeType: NodeType) => boolean;

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
export type GetHeadingLevelFunction = (state: EditorState) => number | null;

/**
 * Get coordinates (x, y) of a specific document position.
 * Used for positioning floating elements near selection.
 * 
 * @param view - ProseMirror editor view
 * @param pos - Document position (absolute offset)
 * @returns Coordinates object with screen position
 * 
 * @example
 * ```typescript
 * const { from, to } = state.selection;
 * const startCoords = getCoordsAtPos(view, from);
 * const endCoords = getCoordsAtPos(view, to);
 * 
 * // Position toolbar between start and end
 * const midX = (startCoords.left + endCoords.left) / 2;
 * const midY = startCoords.top;
 * ```
 */
export type GetCoordsAtPosFunction = (
  view: { coordsAtPos: (pos: number) => DOMRect },
  pos: number
) => DOMRect;
