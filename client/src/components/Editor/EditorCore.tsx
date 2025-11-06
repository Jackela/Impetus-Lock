/**
 * Milkdown Editor Core Component
 *
 * Wrapper component for Milkdown editor with ProseMirror-based editing.
 * Provides foundation for lock enforcement via filterTransaction API.
 *
 * Constitutional Compliance:
 * - Article I (Simplicity): Uses Milkdown's native preset-commonmark (no custom plugins yet)
 * - Article V (Documentation): JSDoc for all exported components
 *
 * @module components/Editor/EditorCore
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Editor, rootCtx, defaultValueCtx, editorViewCtx } from "@milkdown/core";
import { commonmark } from "@milkdown/preset-commonmark";
import { nord } from "@milkdown/theme-nord";
import { Milkdown, useEditor } from "@milkdown/react";
import { lockManager } from "../../services/LockManager";
import { createLockTransactionFilter } from "./TransactionFilter";
import { useWritingState, type AgentMode } from "../../hooks/useWritingState";
import { useLokiTimer } from "../../hooks/useLokiTimer";
import { extractLastSentences } from "../../utils/contextExtractor";
import {
  triggerMuseIntervention,
  triggerLokiIntervention,
} from "../../services/api/interventionClient";
import { injectLockedBlock, deleteContentAtAnchor } from "../../services/ContentInjector";

interface EditorCoreProps {
  /**
   * Initial Markdown content for the editor.
   * @default ""
   */
  initialContent?: string;

  /**
   * Agent mode for intervention system.
   * @default "off"
   */
  mode?: AgentMode;

  /**
   * Callback fired when editor content changes.
   * @param markdown - Updated Markdown content
   */
  onChange?: (markdown: string) => void;

  /**
   * Callback fired when editor is ready (initialized).
   * @param editor - Milkdown editor instance
   */
  onReady?: (editor: Editor) => void;
}

/**
 * Milkdown editor wrapper component with basic setup.
 *
 * Features (P1 scope):
 * - Markdown editing with CommonMark preset
 * - Content change tracking
 * - Editor instance access for lock enforcement
 *
 * Future enhancements (will be added in Phase 3):
 * - Transaction filtering for lock enforcement
 * - Lock block rendering
 * - State machine integration
 *
 * @example
 * ```tsx
 * <EditorCore
 *   initialContent="# Hello World"
 *   onChange={(md) => console.log('Content:', md)}
 *   onReady={(editor) => console.log('Editor ready')}
 * />
 * ```
 */
export const EditorCore: React.FC<EditorCoreProps> = ({
  initialContent = "",
  mode = "off",
  onReady,
}) => {
  const editorRef = useRef<Editor | null>(null);
  const [docVersion, setDocVersion] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);

  // Handle STUCK state intervention (Muse mode)
  const handleStuck = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;

    try {
      // Get current editor content
      const view = editor.action((ctx) => ctx.get(editorViewCtx));
      const fullText = view.state.doc.textContent;

      // Extract last 3 sentences as context
      const context = extractLastSentences(fullText, 3, cursorPosition);

      if (!context) {
        console.warn("No context available for intervention");
        return;
      }

      // Call backend API
      const response = await triggerMuseIntervention(context, cursorPosition, docVersion);

      if (response.action === "provoke" && response.content && response.lock_id) {
        // Inject locked blockquote content
        injectLockedBlock(view, response.content, response.lock_id, response.anchor);

        // Register lock with LockManager
        lockManager.applyLock(response.lock_id);

        console.log("[Muse] Intervention injected:", response.lock_id);
      }
    } catch (error) {
      console.error("Muse intervention failed:", error);
      // TODO: Show user-friendly error toast
    }
  }, [cursorPosition, docVersion]);

  // Handle Loki timer trigger (random chaos intervention)
  const handleLokiTrigger = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;

    try {
      // Get current editor content
      const view = editor.action((ctx) => ctx.get(editorViewCtx));
      const fullText = view.state.doc.textContent;

      // Extract last 10 sentences for Loki context (more than Muse)
      const context = extractLastSentences(fullText, 10, cursorPosition);

      if (!context) {
        console.warn("No context available for Loki intervention");
        return;
      }

      // Call backend API (can return provoke or delete)
      const response = await triggerLokiIntervention(context, cursorPosition, docVersion);

      if (response.action === "provoke" && response.content && response.lock_id) {
        // Inject locked blockquote content
        injectLockedBlock(view, response.content, response.lock_id, response.anchor);

        // Register lock with LockManager
        lockManager.applyLock(response.lock_id);

        console.log("[Loki] Provoke intervention injected:", response.lock_id);
      } else if (response.action === "delete" && response.anchor.type === "range") {
        // Delete content at anchor range
        deleteContentAtAnchor(view, response.anchor);

        console.log("[Loki] Delete action executed:", response.anchor);
      }
    } catch (error) {
      console.error("Loki intervention failed:", error);
      // TODO: Show user-friendly error toast
    }
  }, [cursorPosition, docVersion]);

  // Writing state machine for STUCK detection (Muse mode)
  const { onInput } = useWritingState({
    mode,
    onStuck: handleStuck,
  });

  // Random chaos timer (Loki mode)
  useLokiTimer({
    mode,
    onTrigger: handleLokiTrigger,
  });

  const { get } = useEditor((root) => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, initialContent);
      })
      .config(nord)
      .use(commonmark);

    return editor;
  });

  useEffect(() => {
    const editor = get();
    if (editor) {
      editorRef.current = editor;

      // Apply lock transaction filter for lock enforcement
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const lockFilter = createLockTransactionFilter(lockManager);

        // Get existing filter if any
        const existingFilter = view.props.filterTransaction;

        // Chain filters: lock filter first, then existing filters
        view.setProps({
          filterTransaction: (tr, state) => {
            // Apply lock filter first (blocks locked content deletion)
            if (!lockFilter(tr, state)) {
              return false;
            }

            // Chain with existing filters
            return existingFilter ? existingFilter(tr, state) : true;
          },
        });
      });

      // Extract locks from initial content (for persistence)
      if (initialContent) {
        const locks = lockManager.extractLocksFromMarkdown(initialContent);
        locks.forEach((lockId) => lockManager.applyLock(lockId));
      }

      // Add listener for user input (track typing for state machine)
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);

        // Listen to all transactions
        const originalDispatchTransaction = view.dispatch.bind(view);
        view.dispatch = (tr) => {
          // Check if transaction modifies content
          if (tr.docChanged) {
            // Increment doc version
            setDocVersion((v) => v + 1);

            // Update cursor position
            const newPos = tr.selection.$head.pos;
            setCursorPosition(newPos);

            // Notify state machine about user input
            onInput();
          }

          // Dispatch original transaction
          originalDispatchTransaction(tr);
        };
      });

      // Notify parent component that editor is ready
      if (onReady) {
        onReady(editor);
      }
    }
  }, [get, onReady, initialContent, onInput]);

  return (
    <div className="editor-container">
      <Milkdown />
    </div>
  );
};

export default EditorCore;
