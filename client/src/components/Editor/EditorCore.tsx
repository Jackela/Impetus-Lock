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
import type { Node as ProseMirrorNode } from "@milkdown/prose/model";
import { lockManager } from "../../services/LockManager";
import { createLockTransactionFilter } from "./TransactionFilter";
import { applyLockDecorations, refreshLockDecorations } from "./LockDecorations";
import { useWritingState, type AgentMode } from "../../hooks/useWritingState";
import { useLokiTimer } from "../../hooks/useLokiTimer";
import { extractLastSentences } from "../../utils/contextExtractor";
import {
  triggerMuseIntervention,
  triggerLokiIntervention,
} from "../../services/api/interventionClient";
import {
  injectLockedBlock,
  deleteContentAtAnchor,
  deleteLastSentence,
  rewriteRangeWithLock,
} from "../../services/ContentInjector";
import { SensoryFeedback } from "../SensoryFeedback";
import { AIActionType } from "../../types/ai-actions";
import { FloatingToolbar } from "./FloatingToolbar";
import { BottomDockedToolbar } from "./BottomDockedToolbar";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { extractLockAttributes } from "../../utils/prosemirror-helpers";
import type { AgentSource } from "../../types/mode";
import { createLogger } from "../../utils/logger";
import { getLastSentenceRange } from "../../utils/textRange";

const EMPTY_CONTEXT_FALLBACK = "用户尚未输入内容，但请求 Muse 提供一个开场提示来打破空白。";

const ensureContext = (text: string) =>
  text && text.trim().length > 0 ? text : EMPTY_CONTEXT_FALLBACK;

declare global {
  interface Window {
    lockManager?: typeof lockManager;
    editorInstance?: Editor;
    insertLockedContentForTest?: (content: string, lockId: string, source?: AgentSource) => void;
    rewriteLockedContentForTest?: (content: string, lockId: string, source?: AgentSource) => void;
    triggerManualDeleteForTest?: () => void;
  }
}

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
  /**
   * Callback for timer updates (T004 - Timer visibility).
   * Called every second in Muse mode with remaining time until STUCK.
   */
  onTimerUpdate?: (remainingSeconds: number) => void;
  /**
   * Surface intervention errors (e.g., backend misconfiguration) to parent UI.
   */
  onInterventionError?: (error: Error) => void;
}

// Create logger instance for EditorCore namespace
const logger = createLogger("EditorCore");

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
  onTimerUpdate,
  onInterventionError,
}) => {
  const editorRef = useRef<Editor | null>(null);
  const [docVersion, setDocVersion] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [currentAction, setCurrentAction] = useState<AIActionType | null>(null);

  // T014: Expose editor instance for FloatingToolbar
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);

  // T017: Responsive toolbar - detect mobile viewport
  const isMobile = useMediaQuery("(max-width: 767px)");

  // Prevent multiple initializations (critical for preventing infinite loop)
  const editorInitializedRef = useRef(false);

  // Stable ref for onReady to avoid useEffect re-runs
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  // Track last processed trigger to prevent duplicates
  const lastProcessedTriggerRef = useRef<AIActionType | null>(null);

  // Track if we're currently processing a trigger to prevent re-entry
  const isProcessingTriggerRef = useRef(false);

  // Track if delete is currently executing (separate from trigger processing)
  const isDeletingRef = useRef(false);

  const DEFAULT_FEEDBACK_DURATION = 1500;
  const actionResetTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showSensoryAction = useCallback(
    (
      action: AIActionType,
      options?: {
        duration?: number;
        onComplete?: () => void;
      }
    ) => {
      const duration = options?.duration ?? DEFAULT_FEEDBACK_DURATION;
      setCurrentAction(action);
      if (actionResetTimerRef.current) {
        clearTimeout(actionResetTimerRef.current);
      }
      actionResetTimerRef.current = setTimeout(() => {
        setCurrentAction(null);
        actionResetTimerRef.current = null;
        options?.onComplete?.();
      }, duration);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (actionResetTimerRef.current) {
        clearTimeout(actionResetTimerRef.current);
      }
    };
  }, []);

  // Handle STUCK state intervention (Muse mode)
  const handleStuck = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;

    try {
      const view = editor.action((ctx) => ctx.get(editorViewCtx));
      const museSentenceRange = getLastSentenceRange(view.state);
      const museAnchor =
        museSentenceRange.to > museSentenceRange.from
          ? { type: "range" as const, from: museSentenceRange.from, to: museSentenceRange.to }
          : undefined;
      const registerLockWithDecorations = (
        lockId: string,
        source: AgentSource,
        shape: "inline" | "block"
      ) => {
        lockManager.applyLock(lockId, { source, shape });
        refreshLockDecorations(view);
      };
      const fullText = view.state.doc.textContent;
      const contextWindow = ensureContext(extractLastSentences(fullText, 3));

      const response = await triggerMuseIntervention(contextWindow, cursorPosition, docVersion);

      const resolvedSource: AgentSource = response.source ?? "muse";

      if (response.action === "rewrite" && response.content && response.lock_id) {
        showSensoryAction(AIActionType.REWRITE);
        const resolvedAnchor =
          response.anchor && response.anchor.type === "range" ? response.anchor : museAnchor;
        rewriteRangeWithLock({
          view,
          content: response.content,
          lockId: response.lock_id,
          anchor: resolvedAnchor,
          source: resolvedSource,
        });
        registerLockWithDecorations(response.lock_id, resolvedSource, "inline");
      } else if (response.action === "provoke" && response.content && response.lock_id) {
        // Muse provoke now enforces rewrite semantics for the most recent sentence
        showSensoryAction(AIActionType.REWRITE);
        rewriteRangeWithLock({
          view,
          content: response.content,
          lockId: response.lock_id,
          anchor: museAnchor,
          source: resolvedSource,
        });
        registerLockWithDecorations(response.lock_id, resolvedSource, "inline");
      } else if (response.action === "delete") {
        showSensoryAction(AIActionType.DELETE);
        if (response.anchor && response.anchor.type === "range") {
          deleteContentAtAnchor(view, response.anchor);
        } else {
          deleteLastSentence(view);
        }
      }
    } catch (error) {
      logger.error("Muse intervention failed", error);
      onInterventionError?.(error as Error);
      showSensoryAction(AIActionType.ERROR);
    }
  }, [cursorPosition, docVersion, onInterventionError, showSensoryAction]);

  // Handle Loki chaos trigger
  const handleLokiTrigger = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;

    try {
      const view = editor.action((ctx) => ctx.get(editorViewCtx));
      const fullText = view.state.doc.textContent;
      const contextWindow = ensureContext(extractLastSentences(fullText, 3));

      const response = await triggerLokiIntervention(contextWindow, cursorPosition, docVersion);

      const resolvedSource: AgentSource = response.source ?? "loki";

      if (response.action === "provoke" && response.content && response.lock_id) {
        showSensoryAction(AIActionType.PROVOKE);
        injectLockedBlock(
          view,
          response.content,
          response.lock_id,
          response.anchor,
          resolvedSource
        );
        lockManager.applyLock(response.lock_id, { source: resolvedSource, shape: "block" });
        refreshLockDecorations(view);
      } else if (response.action === "rewrite" && response.content && response.lock_id) {
        showSensoryAction(AIActionType.REWRITE);
        rewriteRangeWithLock({
          view,
          content: response.content,
          lockId: response.lock_id,
          anchor: response.anchor && response.anchor.type === "range" ? response.anchor : undefined,
          source: resolvedSource,
        });
        lockManager.applyLock(response.lock_id, { source: resolvedSource, shape: "inline" });
        refreshLockDecorations(view);
      } else if (response.action === "delete") {
        showSensoryAction(AIActionType.DELETE);
        if (response.anchor && response.anchor.type === "range") {
          deleteContentAtAnchor(view, response.anchor);
        } else {
          deleteLastSentence(view);
        }
      }
    } catch (error) {
      logger.error("Loki intervention failed", error);
      onInterventionError?.(error as Error);
      showSensoryAction(AIActionType.ERROR);
    }
  }, [cursorPosition, docVersion, onInterventionError, showSensoryAction]);

  // Handle manual delete trigger (Test Delete button)
  const handleManualDelete = useCallback(() => {
    // CRITICAL: Prevent re-entry at the function level
    if (isDeletingRef.current) {
      return;
    }

    const editor = editorRef.current;
    if (!editor) return;

    // Set flag IMMEDIATELY before any other operations
    isDeletingRef.current = true;

    try {
      const view = editor.action((ctx) => ctx.get(editorViewCtx));
      const { state } = view;
      const docSize = state.doc.content.size;

      // Safety check: Don't delete if document is too small
      if (docSize < 50) {
        showSensoryAction(AIActionType.ERROR, { duration: MANUAL_ANIMATION_DURATION }); // Show error feedback
        return;
      }

      // Find the last paragraph or sentence (approximately 50-100 characters)
      // Simple heuristic: delete last 20% of document or minimum 50 chars
      const deleteLength = Math.min(Math.max(Math.floor(docSize * 0.2), 50), 200);
      const from = Math.max(0, docSize - deleteLength);
      const to = docSize;

      if (from < to && to <= docSize) {
        showSensoryAction(AIActionType.DELETE, { duration: MANUAL_ANIMATION_DURATION });
        deleteContentAtAnchor(view, { type: "range", from, to });
      }
    } finally {
      // Reset flag after a delay to allow React to process state updates
      setTimeout(() => {
        isDeletingRef.current = false;
      }, 1500); // 1.5 seconds to ensure all state updates complete
    }
  }, [showSensoryAction]);

  // Stable refs for callback functions to avoid useEffect re-runs
  const handleStuckRef = useRef(handleStuck);
  const handleManualDeleteRef = useRef(handleManualDelete);
  const handleLokiTriggerRef = useRef(handleLokiTrigger);

  // Keep refs updated
  useEffect(() => {
    handleStuckRef.current = handleStuck;
  }, [handleStuck]);

  useEffect(() => {
    handleManualDeleteRef.current = handleManualDelete;
  }, [handleManualDelete]);

  useEffect(() => {
    handleLokiTriggerRef.current = handleLokiTrigger;
  }, [handleLokiTrigger]);

  // Writing state machine for STUCK detection (Muse mode)
  const { onInput } = useWritingState({
    mode,
    onStuck: handleStuck,
    onTimerUpdate, // T004: Forward timer updates to parent (App.tsx)
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

  const MANUAL_ANIMATION_DURATION = 1000;

  // Handle external manual trigger
  useEffect(() => {
    // Prevent re-entry - if already processing a trigger, skip
    if (isProcessingTriggerRef.current) {
      return;
    }

    if (externalTrigger && lastProcessedTriggerRef.current !== externalTrigger) {
      // Set processing flag to prevent re-entry
      isProcessingTriggerRef.current = true;

      // Mark this trigger as processed
      lastProcessedTriggerRef.current = externalTrigger;

      onTriggerProcessed?.();

      if (externalTrigger === AIActionType.PROVOKE && mode === "muse") {
        showSensoryAction(AIActionType.REWRITE, { duration: MANUAL_ANIMATION_DURATION });
        handleStuckRef.current();
        const timer = setTimeout(() => {
          isProcessingTriggerRef.current = false;
        }, MANUAL_ANIMATION_DURATION);
        return () => clearTimeout(timer);
      }

      if (externalTrigger === AIActionType.DELETE) {
        showSensoryAction(AIActionType.DELETE, { duration: MANUAL_ANIMATION_DURATION });
        handleManualDeleteRef.current();
        const timer = setTimeout(() => {
          isProcessingTriggerRef.current = false;
        }, MANUAL_ANIMATION_DURATION);
        return () => clearTimeout(timer);
      }

      if (externalTrigger === AIActionType.CHAOS && mode === "loki") {
        Promise.resolve(handleLokiTriggerRef.current?.()).finally(() => {
          isProcessingTriggerRef.current = false;
        });
        return;
      }

      showSensoryAction(externalTrigger, { duration: MANUAL_ANIMATION_DURATION });
      const timer = setTimeout(() => {
        isProcessingTriggerRef.current = false;
      }, MANUAL_ANIMATION_DURATION);

      return () => {
        clearTimeout(timer);
      };
    } else if (!externalTrigger) {
      // Reset the ref when trigger is cleared
      lastProcessedTriggerRef.current = null;
      isProcessingTriggerRef.current = false;
    }
  }, [externalTrigger, onTriggerProcessed, mode, showSensoryAction]);

  // Initialize editor - don't use loading state
  const { get } = useEditor((root) => {
    return (
      Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root);
          // Use empty string as default if no initialContent provided
          ctx.set(defaultValueCtx, initialContent || "");
        })
        .config(nord)
        // NOTE: LockSchemaExtension NOT integrated - lock attributes are
        // detected at runtime via extractLockAttributes() helper function.
        // This follows Article I (Simplicity): runtime detection works, no need for schema extension.
        .use(commonmark)
    );
  });

  const getRef = useRef(get);
  useEffect(() => {
    getRef.current = get;
  }, [get]);

  // Setup editor after initialization with retry logic
  useEffect(() => {
    // CRITICAL: Prevent infinite loop - only initialize once
    if (editorInitializedRef.current) {
      return;
    }

    let mounted = true;
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds total (50 * 100ms)

    const initEditor = async () => {
      const getEditor = getRef.current;
      if (!getEditor) {
        logger.error("Editor getter unavailable");
        return;
      }

      // Poll for editor with retry logic
      let editor = getEditor();

      while (!editor && mounted && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        editor = getEditor();
        attempts++;
      }

      if (!editor || !mounted) {
        if (!editor) {
          logger.error("Editor failed to initialize", { timeoutMs: attempts * 100 });
        }
        return;
      }

      editorRef.current = editor;

      // T014: Expose editor instance for FloatingToolbar
      setEditorInstance(editor);

      // TESTING: Expose lockManager, editor, and helpers to window for E2E tests
      if (typeof window !== "undefined") {
        const testWindow = window as Window & typeof globalThis;
        testWindow.lockManager = lockManager;
        testWindow.editorInstance = editor;
        // Expose test helper to insert locked content using production code path
        testWindow.insertLockedContentForTest = (
          content: string,
          lockId: string,
          source: AgentSource = "muse"
        ) => {
          return editor.action((ctx) => {
            const view = ctx.get(editorViewCtx);
            // Use same method as ContentInjector
            injectLockedBlock(
              view,
              content,
              lockId,
              { type: "pos", from: view.state.selection.$head.pos },
              source
            );
            lockManager.applyLock(lockId, { source, shape: "block" });
            refreshLockDecorations(view);
            // NOTE: LockDecorations plugin automatically updates via extractLockAttributes() checking node attributes
          });
        };

        testWindow.triggerMuseRewriteForTest = () => handleStuckRef.current?.();
        testWindow.triggerManualDeleteForTest = () => handleManualDeleteRef.current?.();
      }

      // T008: Apply lock content decorations for visual styling FIRST
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        applyLockDecorations(view);
      });

      // Apply lock transaction filter for lock enforcement AFTER decorations
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const lockFilter = createLockTransactionFilter(lockManager, () => {
          showSensoryAction(AIActionType.REJECT, { duration: 1000 });
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
        const entries = lockManager.extractLockEntriesFromMarkdown(initialContent);
        entries.forEach(({ lockId, source }) => lockManager.applyLock(lockId, { source }));
      }

      // Add listener for user input
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const originalDispatchTransaction = view.dispatch.bind(view);

        view.dispatch = (tr) => {
          // CRITICAL: Call filterTransaction BEFORE processing to allow blocking
          // This must be done manually since we override dispatch
          if (view.props.filterTransaction) {
            const allowed = view.props.filterTransaction(tr, view.state);
            if (!allowed) {
              return; // Block the transaction
            }
          }

          if (tr.docChanged) {
            setDocVersion((v) => v + 1);
            const newPos = tr.selection.$head.pos;
            setCursorPosition(newPos);
            // Use ref to avoid dependency issues
            onInputRef.current();

            // Auto-detect and register locks from content changes
            // CRITICAL: Scan BEFORE originalDispatchTransaction to ensure locks are registered
            // before TransactionFilter checks them on the NEXT transaction (e.g., deletion).
            // Uses same pattern as LockDecorations (which successfully detects locks).
            tr.doc.descendants((node) => {
              const metadata = extractLockAttributes(node as ProseMirrorNode);
              if (metadata?.lockId && !lockManager.hasLock(metadata.lockId)) {
                lockManager.applyLock(metadata.lockId, { source: metadata.source });
                refreshLockDecorations(view);
              }
            });
          }
          originalDispatchTransaction(tr);
        };
      });

      // Notify parent
      if (onReadyRef.current) {
        onReadyRef.current(editor);
      }

      // Mark as initialized to prevent re-running
      editorInitializedRef.current = true;
    };

    initEditor();

    return () => {
      mounted = false;
    };
  }, [initialContent, showSensoryAction]);

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
