/**
 * EditorCore v2 - Fixed React 19 + Milkdown compatibility
 *
 * Key changes from v1:
 * 1. MilkdownProvider moved to root level (outside component using useEditor)
 * 2. Split into wrapper + inner component
 * 3. Removed loading state blocking - render immediately
 * 4. Fixed hook dependency issues with useCallback and refs
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Editor, rootCtx, defaultValueCtx, editorViewCtx } from "@milkdown/core";
import { commonmark } from "@milkdown/preset-commonmark";
import { nord } from "@milkdown/theme-nord";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
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
import { SensoryFeedback } from "../SensoryFeedback";
import { AIActionType } from "../../types/ai-actions";
import { FloatingToolbar } from "./FloatingToolbar";
import { BottomDockedToolbar } from "./BottomDockedToolbar";
import { useMediaQuery } from "../../hooks/useMediaQuery";

interface EditorCoreProps {
  initialContent?: string;
  mode?: AgentMode;
  onChange?: (markdown: string) => void;
  onReady?: (editor: Editor) => void;
  /**
   * External trigger for manual AI intervention.
   * When provided, triggers sensory feedback on change.
   */
  externalTrigger?: AIActionType | null;
  /**
   * Callback when external trigger is processed.
   * Allows parent to clear the trigger state.
   */
  onTriggerProcessed?: () => void;
}

/**
 * Inner component that uses useEditor hook.
 * Must be wrapped by MilkdownProvider.
 */
const EditorCoreInner: React.FC<EditorCoreProps> = ({
  initialContent = "",
  mode = "off",
  onReady,
  externalTrigger,
  onTriggerProcessed,
}) => {
  const editorRef = useRef<Editor | null>(null);
  const [docVersion, setDocVersion] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [currentAction, setCurrentAction] = useState<AIActionType | null>(null);

  // T014: Expose editor instance for FloatingToolbar
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);

  // T017: Responsive toolbar - detect mobile viewport
  const isMobile = useMediaQuery("(max-width: 767px)");

  // Stable ref for onReady to avoid useEffect re-runs
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  // Handle STUCK state intervention (Muse mode)
  const handleStuck = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;

    try {
      const view = editor.action((ctx) => ctx.get(editorViewCtx));
      const fullText = view.state.doc.textContent;
      const contextWindow = extractLastSentences(fullText, 3);

      setCurrentAction(AIActionType.PROVOKE);

      const response = await triggerMuseIntervention({
        context_window: contextWindow,
        cursor_position: cursorPosition,
      });

      if (response.action === "provoke" && response.content && response.lock_id) {
        injectLockedBlock(view, response.content, response.lock_id, response.anchor);
        lockManager.applyLock(response.lock_id);
        console.log("[Muse] Provoke intervention injected:", response.lock_id);
      }
    } catch (error) {
      console.error("Muse intervention failed:", error);
    }
  }, [cursorPosition]);

  // Handle Loki chaos trigger
  const handleLokiTrigger = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;

    try {
      const view = editor.action((ctx) => ctx.get(editorViewCtx));
      const fullText = view.state.doc.textContent;
      const contextWindow = extractLastSentences(fullText, 3);

      const response = await triggerLokiIntervention({
        context_window: contextWindow,
        cursor_position: cursorPosition,
        doc_version: docVersion,
      });

      if (response.action === "provoke" && response.content && response.lock_id) {
        setCurrentAction(AIActionType.PROVOKE);
        injectLockedBlock(view, response.content, response.lock_id, response.anchor);
        lockManager.applyLock(response.lock_id);
        console.log("[Loki] Provoke intervention injected:", response.lock_id);
      } else if (response.action === "delete" && response.anchor.type === "range") {
        setCurrentAction(AIActionType.DELETE);
        deleteContentAtAnchor(view, response.anchor);
        console.log("[Loki] Delete action executed:", response.anchor);
      }
    } catch (error) {
      console.error("Loki intervention failed:", error);
    }
  }, [cursorPosition, docVersion]);

  // Writing state machine for STUCK detection (Muse mode)
  const { onInput } = useWritingState({
    mode,
    onStuck: handleStuck,
  });

  // Use ref to avoid including onInput in useEffect dependencies
  const onInputRef = useRef(onInput);
  useEffect(() => {
    onInputRef.current = onInput;
  }, [onInput]);

  // Random chaos timer (Loki mode)
  useLokiTimer({
    mode,
    onTrigger: handleLokiTrigger,
  });

  // Handle external manual trigger
  useEffect(() => {
    if (externalTrigger) {
      setCurrentAction(externalTrigger);
      // Clear action after animation duration
      const timer = setTimeout(() => {
        setCurrentAction(null);
        onTriggerProcessed?.();
      }, 2000); // Clear after 2 seconds
      return () => clearTimeout(timer);
    }
  }, [externalTrigger, onTriggerProcessed]);

  // Initialize editor - don't use loading state
  const { get } = useEditor((root) => {
    return Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, initialContent);
      })
      .config(nord)
      .use(commonmark);
  });

  // Setup editor after initialization with retry logic
  useEffect(() => {
    let mounted = true;
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds total (50 * 100ms)

    const initEditor = async () => {
      // Poll for editor with retry logic
      let editor = get();

      while (!editor && mounted && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        editor = get();
        attempts++;
      }

      if (!editor || !mounted) {
        if (!editor) {
          console.error("Editor failed to initialize after", attempts * 100, "ms");
        }
        return;
      }

      editorRef.current = editor;

      // T014: Expose editor instance for FloatingToolbar
      setEditorInstance(editor);

      // Apply lock transaction filter for lock enforcement
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const lockFilter = createLockTransactionFilter(lockManager, () => {
          setCurrentAction(AIActionType.REJECT);
        });

        const existingFilter = view.props.filterTransaction;

        view.setProps({
          filterTransaction: (tr, state) => {
            if (!lockFilter(tr, state)) {
              return false;
            }
            return existingFilter ? existingFilter(tr, state) : true;
          },
        });
      });

      // Extract locks from initial content
      if (initialContent) {
        const locks = lockManager.extractLocksFromMarkdown(initialContent);
        locks.forEach((lockId) => lockManager.applyLock(lockId));
      }

      // Add listener for user input
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const originalDispatchTransaction = view.dispatch.bind(view);

        view.dispatch = (tr) => {
          if (tr.docChanged) {
            setDocVersion((v) => v + 1);
            const newPos = tr.selection.$head.pos;
            setCursorPosition(newPos);
            // Use ref to avoid dependency issues
            onInputRef.current();
          }
          originalDispatchTransaction(tr);
        };
      });

      // Notify parent
      if (onReadyRef.current) {
        onReadyRef.current(editor);
      }
    };

    initEditor();

    return () => {
      mounted = false;
    };
  }, [get, initialContent]);

  // Always render immediately - no loading state
  return (
    <div
      className="editor-container"
      style={{ position: "relative" }}
      data-testid="editor-ready"
      data-state="ready"
    >
      <Milkdown />
      <SensoryFeedback actionType={currentAction} />
      {/* T017-T018: Responsive toolbar - conditional rendering based on viewport */}
      {isMobile ? (
        <BottomDockedToolbar editor={editorInstance} />
      ) : (
        <FloatingToolbar editor={editorInstance} />
      )}
    </div>
  );
};

/**
 * EditorCore - Wrapper component with MilkdownProvider
 *
 * Fixes React 19 + Milkdown compatibility by:
 * - Providing Milkdown context at root level
 * - Removing loading state blocking
 * - Using stable refs for callbacks
 */
export const EditorCore: React.FC<EditorCoreProps> = (props) => {
  return (
    <MilkdownProvider>
      <EditorCoreInner {...props} />
    </MilkdownProvider>
  );
};

export default EditorCore;
