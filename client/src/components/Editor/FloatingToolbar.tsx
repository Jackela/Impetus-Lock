/**
 * FloatingToolbar Component
 *
 * Context-sensitive floating toolbar for Markdown formatting.
 * Appears when text is selected, provides Bold, Italic, H1, H2, and Bullet List buttons.
 *
 * @module FloatingToolbar
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { FC } from "react";
import type { Editor } from "@milkdown/core";
import { editorViewCtx } from "@milkdown/core";
import { callCommand } from "@milkdown/utils";
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  wrapInHeadingCommand,
  wrapInBulletListCommand,
} from "@milkdown/preset-commonmark";
import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import { hasMark, getHeadingLevel, isInBulletList } from "../../utils/prosemirror-helpers";

/**
 * Props for FloatingToolbar component.
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
 * FloatingToolbar component for Markdown formatting.
 * Shows toolbar when text is selected, hides when no selection.
 *
 * @param props - Component props
 * @returns Toolbar element or null if hidden
 */
export const FloatingToolbar: FC<FloatingToolbarProps> = ({
  editor,
  className = "",
  zIndex = 1000,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // T067-T069: Position state for Floating UI
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // T025-T026, T042-T043, T056: Active state tracking for buttons
  const [activeStates, setActiveStates] = useState({
    bold: false,
    italic: false,
    h1: false,
    h2: false,
    bulletList: false,
  });

  /**
   * Handle Bold formatting command.
   * Uses onMouseDown to preserve selection (preventDefault pattern).
   * Toggles strong mark on selected text.
   *
   * @param e - Mouse event from button click
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
   * Handle Italic formatting command.
   * Uses onMouseDown to preserve selection (preventDefault pattern).
   * Toggles emphasis mark on selected text.
   *
   * @param e - Mouse event from button click
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
   * Handle Heading 1 formatting command.
   * Uses onMouseDown to preserve selection (preventDefault pattern).
   * Converts selected paragraph to H1 heading.
   *
   * @param e - Mouse event from button click
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
   * Handle Heading 2 formatting command.
   * Uses onMouseDown to preserve selection (preventDefault pattern).
   * Converts selected paragraph to H2 heading.
   *
   * @param e - Mouse event from button click
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
   * Handle Bullet List formatting command.
   * Uses onMouseDown to preserve selection (preventDefault pattern).
   * Toggles bullet list formatting on selected paragraph.
   *
   * @param e - Mouse event from button click
   */
  const handleBulletList = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      editor?.action(callCommand(wrapInBulletListCommand.key));
    },
    [editor]
  );

  /**
   * Update toolbar position using Floating UI library.
   *
   * Calculates optimal position based on text selection coordinates,
   * with automatic viewport overflow handling (flip, shift middleware).
   *
   * Positioning strategy:
   * - Placement: 'top' (above selection by default)
   * - Offset: 8px gap between selection and toolbar
   * - Flip: Switch to bottom if insufficient space above
   * - Shift: Adjust horizontally to stay within viewport
   */
  const updatePosition = useCallback(() => {
    if (!editor || !toolbarRef.current) return;

    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { from, to } = view.state.selection;

      // Get coordinates of selection start and end
      const start = view.coordsAtPos(from);
      const end = view.coordsAtPos(to);

      // Create virtual element for Floating UI
      const virtualElement = {
        getBoundingClientRect: () => ({
          width: end.left - start.left,
          height: end.bottom - start.top,
          x: start.left,
          y: start.top,
          top: start.top,
          left: start.left,
          bottom: end.bottom,
          right: end.right,
        }),
      };

      // Compute position with Floating UI
      computePosition(virtualElement, toolbarRef.current!, {
        placement: "top",
        middleware: [
          offset(8), // 8px gap between selection and toolbar
          flip(), // Flip to bottom if not enough space on top
          shift({ padding: 8 }), // Shift horizontally to stay in viewport
        ],
      }).then(({ x, y }) => {
        setPosition({ x, y });
      });
    });
  }, [editor]);

  // T015: ProseMirror transaction interception for selection tracking
  useEffect(() => {
    if (!editor) return;

    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const originalDispatch = view.dispatch.bind(view);

      // Override dispatch to track selection changes
      view.dispatch = (tr) => {
        // Track selection changes
        if (tr.selectionSet || tr.docChanged) {
          const { empty } = tr.selection;
          // Show toolbar only when text is selected (non-empty selection)
          setIsVisible(!empty);

          // T025-T026, T042-T043, T056: Update active states when selection changes
          if (!empty) {
            const state = view.state;
            const strongType = state.schema.marks.strong;
            const emphasisType = state.schema.marks.em;
            const headingLevel = getHeadingLevel(state);
            const inBulletList = isInBulletList(state);

            setActiveStates({
              bold: hasMark(state, strongType),
              italic: hasMark(state, emphasisType),
              h1: headingLevel === 1,
              h2: headingLevel === 2,
              bulletList: inBulletList,
            });

            // T069: Update position when selection changes
            // Use setTimeout to ensure DOM is updated before computing position
            setTimeout(() => updatePosition(), 0);
          }
        }

        // Call original dispatch to apply transaction
        originalDispatch(tr);
      };
    });
  }, [editor, updatePosition]);

  // T013: Visibility logic - hide when editor is null or no selection
  if (!editor || !isVisible) return null;

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Formatting toolbar"
      className={`floating-toolbar ${className}`}
      style={{
        position: "fixed",
        top: `${position.y}px`,
        left: `${position.x}px`,
        zIndex,
        display: "flex",
        gap: "4px",
        padding: "4px",
        backgroundColor: "var(--color-surface, #fff)",
        borderRadius: "4px",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
      }}
    >
      {/* T027: Bold button with aria-label and aria-pressed */}
      <button
        type="button"
        aria-label="Bold"
        aria-pressed={activeStates.bold}
        onMouseDown={handleBold}
        style={{
          minWidth: "44px",
          minHeight: "44px",
          border: "none",
          background: activeStates.bold ? "var(--color-primary, #007bff)" : "transparent",
          color: activeStates.bold ? "#fff" : "var(--color-text, #000)",
          borderRadius: "2px",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        <strong>B</strong>
      </button>

      {/* T028: Italic button with aria-label and aria-pressed */}
      <button
        type="button"
        aria-label="Italic"
        aria-pressed={activeStates.italic}
        onMouseDown={handleItalic}
        style={{
          minWidth: "44px",
          minHeight: "44px",
          border: "none",
          background: activeStates.italic ? "var(--color-primary, #007bff)" : "transparent",
          color: activeStates.italic ? "#fff" : "var(--color-text, #000)",
          borderRadius: "2px",
          cursor: "pointer",
          fontStyle: "italic",
        }}
      >
        <em>I</em>
      </button>

      {/* T044: H1 button with aria-label and aria-pressed */}
      <button
        type="button"
        aria-label="Heading 1"
        aria-pressed={activeStates.h1}
        onMouseDown={handleH1}
        style={{
          minWidth: "44px",
          minHeight: "44px",
          border: "none",
          background: activeStates.h1 ? "var(--color-primary, #007bff)" : "transparent",
          color: activeStates.h1 ? "#fff" : "var(--color-text, #000)",
          borderRadius: "2px",
          cursor: "pointer",
          fontWeight: "bold",
          fontSize: "0.9em",
        }}
      >
        H1
      </button>

      {/* T045: H2 button with aria-label and aria-pressed */}
      <button
        type="button"
        aria-label="Heading 2"
        aria-pressed={activeStates.h2}
        onMouseDown={handleH2}
        style={{
          minWidth: "44px",
          minHeight: "44px",
          border: "none",
          background: activeStates.h2 ? "var(--color-primary, #007bff)" : "transparent",
          color: activeStates.h2 ? "#fff" : "var(--color-text, #000)",
          borderRadius: "2px",
          cursor: "pointer",
          fontWeight: "bold",
          fontSize: "0.85em",
        }}
      >
        H2
      </button>

      {/* T057: Bullet List button with aria-label and aria-pressed */}
      <button
        type="button"
        aria-label="Bullet list"
        aria-pressed={activeStates.bulletList}
        onMouseDown={handleBulletList}
        style={{
          minWidth: "44px",
          minHeight: "44px",
          border: "none",
          background: activeStates.bulletList ? "var(--color-primary, #007bff)" : "transparent",
          color: activeStates.bulletList ? "#fff" : "var(--color-text, #000)",
          borderRadius: "2px",
          cursor: "pointer",
          fontSize: "1.1em",
        }}
      >
        •
      </button>
    </div>
  );
};
