/**
 * Shared Toolbar Actions Hook
 *
 * Provides formatting command handlers for both FloatingToolbar and BottomDockedToolbar.
 * Implements DRY principle (Article I: Simplicity) by centralizing toolbar logic.
 *
 * @module useToolbarActions
 */

import { useCallback } from "react";
import type { Editor } from "@milkdown/core";
import { callCommand } from "@milkdown/utils";
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  wrapInHeadingCommand,
  wrapInBulletListCommand,
} from "@milkdown/preset-commonmark";

/**
 * Toolbar action handlers interface.
 * All handlers use preventDefault pattern to preserve editor selection.
 */
export interface ToolbarActions {
  /** Toggle bold (strong) formatting on selected text */
  handleBold: (e: React.MouseEvent) => void;
  /** Toggle italic (emphasis) formatting on selected text */
  handleItalic: (e: React.MouseEvent) => void;
  /** Wrap selected text in H1 heading */
  handleH1: (e: React.MouseEvent) => void;
  /** Wrap selected text in H2 heading */
  handleH2: (e: React.MouseEvent) => void;
  /** Wrap selected line in bullet list */
  handleBulletList: (e: React.MouseEvent) => void;
}

/**
 * Hook providing shared toolbar formatting actions.
 *
 * @param editor - Milkdown editor instance (null during initialization)
 * @returns Object containing all formatting command handlers
 *
 * @example
 * ```tsx
 * const actions = useToolbarActions(editor);
 * <button onMouseDown={actions.handleBold}>Bold</button>
 * ```
 *
 * @remarks
 * - Handlers use onMouseDown (not onClick) to preserve selection
 * - preventDefault() prevents focus loss from editor
 * - All commands are Milkdown preset-commonmark commands
 */
export function useToolbarActions(editor: Editor | null): ToolbarActions {
  /**
   * Toggle Bold formatting.
   * Uses preventDefault pattern to preserve editor selection.
   */
  const handleBold = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      editor?.action(callCommand(toggleStrongCommand.key));
    },
    [editor]
  );

  /**
   * Toggle Italic formatting.
   * Uses preventDefault pattern to preserve editor selection.
   */
  const handleItalic = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      editor?.action(callCommand(toggleEmphasisCommand.key));
    },
    [editor]
  );

  /**
   * Wrap selection in H1 heading.
   * Uses preventDefault pattern to preserve editor selection.
   */
  const handleH1 = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      editor?.action(callCommand(wrapInHeadingCommand.key, 1));
    },
    [editor]
  );

  /**
   * Wrap selection in H2 heading.
   * Uses preventDefault pattern to preserve editor selection.
   */
  const handleH2 = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      editor?.action(callCommand(wrapInHeadingCommand.key, 2));
    },
    [editor]
  );

  /**
   * Wrap current line in bullet list.
   * Uses preventDefault pattern to preserve editor selection.
   */
  const handleBulletList = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      editor?.action(callCommand(wrapInBulletListCommand.key));
    },
    [editor]
  );

  return {
    handleBold,
    handleItalic,
    handleH1,
    handleH2,
    handleBulletList,
  };
}
