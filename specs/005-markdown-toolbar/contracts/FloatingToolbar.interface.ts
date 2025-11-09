/**
 * FloatingToolbar Component Interface
 * 
 * Type definitions for the context-sensitive Markdown formatting toolbar.
 * Toolbar appears when text is selected and provides basic WYSIWYG formatting.
 * 
 * @module FloatingToolbar
 */

import type { Editor } from '@milkdown/core';

/**
 * Active state tracking for toolbar buttons.
 * Maps each formatting action to its active status in current selection.
 * 
 * @example
 * ```typescript
 * const activeStates: ToolbarState = {
 *   bold: true,        // Selection contains bold text
 *   italic: false,     // Selection does not contain italic text
 *   h1: false,
 *   h2: true,          // Selection is inside H2 heading
 *   bulletList: false,
 * };
 * ```
 */
export interface ToolbarState {
  /** Bold formatting active (Ctrl+B, strong mark) */
  bold: boolean;

  /** Italic formatting active (Ctrl+I, emphasis mark) */
  italic: boolean;

  /** Heading 1 active (parent node is heading level 1) */
  h1: boolean;

  /** Heading 2 active (parent node is heading level 2) */
  h2: boolean;

  /** Bullet list active (parent node is bullet_list) */
  bulletList: boolean;
}

/**
 * Props for FloatingToolbar component.
 * 
 * @example
 * ```typescript
 * <FloatingToolbar 
 *   editor={editorInstance} 
 *   className="custom-toolbar"
 *   zIndex={1500}
 * />
 * ```
 */
export interface FloatingToolbarProps {
  /** 
   * Milkdown editor instance.
   * `null` during initialization before editor is ready.
   */
  editor: Editor | null;

  /** 
   * Optional: Custom className for styling override.
   * Applied to root toolbar element.
   */
  className?: string;

  /** 
   * Optional: Custom z-index for stacking context.
   * Default: 1000 (above editor content, below modals)
   */
  zIndex?: number;
}

/**
 * Handler function for formatting commands.
 * No parameters, no return value (commands executed via Milkdown action).
 * 
 * @example
 * ```typescript
 * const handleBold: FormattingCommand = () => {
 *   editor?.action(callCommand(toggleStrongCommand.key));
 * };
 * ```
 */
export type FormattingCommand = () => void;

/**
 * Toolbar position coordinates (absolute positioning).
 * Managed by Floating UI library based on text selection.
 * 
 * @example
 * ```typescript
 * const position: ToolbarPosition = { x: 120, y: 350 };
 * // Toolbar positioned at (120px, 350px) from viewport origin
 * ```
 */
export interface ToolbarPosition {
  /** X coordinate (left edge) in pixels */
  x: number;

  /** Y coordinate (top edge) in pixels */
  y: number;
}

/**
 * Toolbar visibility state.
 * - `true`: Toolbar is visible (text selected)
 * - `false`: Toolbar is hidden (no text selected)
 */
export type ToolbarVisibility = boolean;
