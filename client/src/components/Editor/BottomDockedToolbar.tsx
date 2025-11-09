/**
 * BottomDockedToolbar Component
 *
 * Mobile-optimized toolbar docked to bottom of viewport.
 * Used when viewport width < 768px (mobile breakpoint).
 * Provides same formatting buttons as FloatingToolbar but with fixed positioning.
 *
 * @module BottomDockedToolbar
 */

import { useState, useEffect } from "react";
import type { FC } from "react";
import type { Editor } from "@milkdown/core";
import { editorViewCtx } from "@milkdown/core";
import { useToolbarActions } from "../../hooks/useToolbarActions";
import { hasMark, getHeadingLevel, isInBulletList } from "../../utils/prosemirror-helpers";

/**
 * Props for BottomDockedToolbar component.
 */
export interface BottomDockedToolbarProps {
  /**
   * Milkdown editor instance.
   * `null` during initialization before editor is ready.
   */
  editor: Editor | null;

  /**
   * Optional: Custom className for styling override.
   */
  className?: string;

  /**
   * Optional: Custom z-index for stacking context.
   * Default: 1000 (above editor content, below modals)
   */
  zIndex?: number;
}

/**
 * BottomDockedToolbar component for mobile devices.
 * Shows toolbar at bottom of viewport when text is selected.
 * Remains fixed during scroll (doesn't move with content).
 *
 * @param props - Component props
 * @returns Toolbar element or null if hidden
 */
export const BottomDockedToolbar: FC<BottomDockedToolbarProps> = ({
  editor,
  className = "",
  zIndex = 1000,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  // Active state tracking for buttons (same as FloatingToolbar)
  const [activeStates, setActiveStates] = useState({
    bold: false,
    italic: false,
    h1: false,
    h2: false,
    bulletList: false,
  });

  // Use shared toolbar actions hook (DRY principle - Article I)
  const { handleBold, handleItalic, handleH1, handleH2, handleBulletList } =
    useToolbarActions(editor);

  // Track selection changes to show/hide toolbar and update active states
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

          // Update active states when selection changes
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
          }
        }

        // Call original dispatch to apply transaction
        originalDispatch(tr);
      };
    });
  }, [editor]);

  // Hide when editor is null or no selection
  if (!editor || !isVisible) return null;

  return (
    <div
      role="toolbar"
      aria-label="Mobile formatting toolbar"
      className={`bottom-docked-toolbar ${className}`}
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex,
        display: "flex",
        justifyContent: "center",
        gap: "8px",
        padding: "12px 16px",
        backgroundColor: "var(--color-surface, #2a2a2a)",
        borderTop: "1px solid var(--color-border, #444)",
        boxShadow: "0 -2px 8px rgba(0, 0, 0, 0.2)",
        // Add safe-area-inset for iOS notch/home indicator
        paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
      }}
    >
      {/* Bold button */}
      <button
        type="button"
        aria-label="Bold"
        aria-pressed={activeStates.bold}
        onMouseDown={handleBold}
        style={{
          minWidth: "44px",
          minHeight: "44px",
          border: "none",
          background: activeStates.bold ? "var(--color-primary, #8b5cf6)" : "#3a3a3a",
          color: "#fff",
          borderRadius: "4px",
          cursor: "pointer",
          fontWeight: "bold",
          fontSize: "16px",
          transition: "background 0.2s",
        }}
      >
        <strong>B</strong>
      </button>

      {/* Italic button */}
      <button
        type="button"
        aria-label="Italic"
        aria-pressed={activeStates.italic}
        onMouseDown={handleItalic}
        style={{
          minWidth: "44px",
          minHeight: "44px",
          border: "none",
          background: activeStates.italic ? "var(--color-primary, #8b5cf6)" : "#3a3a3a",
          color: "#fff",
          borderRadius: "4px",
          cursor: "pointer",
          fontStyle: "italic",
          fontSize: "16px",
          transition: "background 0.2s",
        }}
      >
        <em>I</em>
      </button>

      {/* H1 button */}
      <button
        type="button"
        aria-label="Heading 1"
        aria-pressed={activeStates.h1}
        onMouseDown={handleH1}
        style={{
          minWidth: "44px",
          minHeight: "44px",
          border: "none",
          background: activeStates.h1 ? "var(--color-primary, #8b5cf6)" : "#3a3a3a",
          color: "#fff",
          borderRadius: "4px",
          cursor: "pointer",
          fontWeight: "bold",
          fontSize: "16px",
          transition: "background 0.2s",
        }}
      >
        H1
      </button>

      {/* H2 button */}
      <button
        type="button"
        aria-label="Heading 2"
        aria-pressed={activeStates.h2}
        onMouseDown={handleH2}
        style={{
          minWidth: "44px",
          minHeight: "44px",
          border: "none",
          background: activeStates.h2 ? "var(--color-primary, #8b5cf6)" : "#3a3a3a",
          color: "#fff",
          borderRadius: "4px",
          cursor: "pointer",
          fontWeight: "bold",
          fontSize: "16px",
          transition: "background 0.2s",
        }}
      >
        H2
      </button>

      {/* Bullet List button */}
      <button
        type="button"
        aria-label="Bullet list"
        aria-pressed={activeStates.bulletList}
        onMouseDown={handleBulletList}
        style={{
          minWidth: "44px",
          minHeight: "44px",
          border: "none",
          background: activeStates.bulletList ? "var(--color-primary, #8b5cf6)" : "#3a3a3a",
          color: "#fff",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "18px",
          transition: "background 0.2s",
        }}
      >
        •
      </button>
    </div>
  );
};
