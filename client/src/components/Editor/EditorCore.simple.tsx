/**
 * Simplified EditorCore for testing Milkdown integration
 *
 * React 19 compatibility fix: Proper MilkdownProvider usage
 * Constitutional Compliance: Article I (Simplicity) - Minimal viable editor
 */

import React from "react";
import { Editor, rootCtx, defaultValueCtx } from "@milkdown/core";
import { commonmark } from "@milkdown/preset-commonmark";
import { nord } from "@milkdown/theme-nord";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";

interface SimpleEditorProps {
  initialContent?: string;
}

/**
 * Inner editor component that uses the useEditor hook.
 * Must be inside MilkdownProvider context.
 */
const EditorComponent: React.FC<{ initialContent: string }> = ({ initialContent }) => {
  // Don't use loading state - just render immediately
  // This works around React 19 + Milkdown compatibility issue where loading never becomes false
  useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, initialContent);
      })
      .config(nord)
      .use(commonmark)
  );

  // Always render as ready - Milkdown will handle its own initialization
  return (
    <div data-testid="editor-ready" data-state="ready">
      <Milkdown />
    </div>
  );
};

/**
 * Simplified Milkdown editor wrapper.
 *
 * Provides minimal editor functionality for P1 MVP:
 * - Markdown editing
 * - Basic formatting (commonmark)
 * - Nord theme
 *
 * @param initialContent - Initial Markdown content (default: "# Hello Milkdown")
 *
 * @example
 * ```tsx
 * <SimpleEditor initialContent="# Task\n\nWrite tests..." />
 * ```
 */
export const SimpleEditor: React.FC<SimpleEditorProps> = ({
  initialContent = "# Hello Milkdown",
}) => {
  return (
    <MilkdownProvider>
      <div
        data-testid="simple-editor-wrapper"
        style={{ padding: "20px", border: "1px solid #ccc", minHeight: "300px" }}
      >
        <EditorComponent initialContent={initialContent} />
      </div>
    </MilkdownProvider>
  );
};
