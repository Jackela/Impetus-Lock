/**
 * EditorCore v2 - Fixed React 19 + Milkdown compatibility
 *
 * Key changes from v1:
 * 1. MilkdownProvider moved to root level (outside component using useEditor)
 * 2. Split into wrapper + inner component
 * 3. Removed loading state blocking - render immediately
 * 4. Fixed hook dependency issues with useCallback and refs
 */

import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import {
  Editor,
  rootCtx,
  defaultValueCtx,
  editorViewCtx,
  editorViewOptionsCtx,
  serializerCtx,
  parserCtx,
  remarkCtx,
} from "@milkdown/core";
import {
  preserveLockMarkers,
  restoreLockMarkers,
  validateRecoveredLocks,
} from "../../utils/editorMarkdown";
import { commonmark } from "@milkdown/preset-commonmark";
import { nord } from "@milkdown/theme-nord";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { Plugin } from "@milkdown/prose/state";
import { useLockManager, LockManagerProvider } from "../../contexts/LockManagerContext";
import type { LockManager } from "../../services/LockManager";
import { createLockTransactionFilter } from "./TransactionFilter";
import { applyLockDecorations, refreshLockDecorations } from "./LockDecorations";
import { useWritingState, type AgentMode } from "../../hooks/useWritingState";
import { useLokiTimer } from "../../hooks/useLokiTimer";
import { extractLastSentences } from "../../utils/contextExtractor";
import {
  triggerMuseIntervention,
  triggerLokiIntervention,
} from "../../services/api/interventionClient";
import type { RemoteSession } from "../../services/api/remoteSession";
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
import {
  DEFAULT_FEEDBACK_DURATION_MS,
  REJECTION_FEEDBACK_DURATION_MS,
  MANUAL_ANIMATION_DURATION_MS,
  LOKI_COOLDOWN_MS,
  DELETE_RESET_DELAY_MS,
  EDITOR_RETRY_INTERVAL_MS,
  EDITOR_MAX_RETRY_ATTEMPTS,
  MIN_DOCUMENT_SIZE_FOR_DELETE,
  DEFAULT_DELETE_PERCENTAGE,
  MAX_DELETE_LENGTH,
  MIN_DELETE_LENGTH,
} from "../../config/animation";

const EMPTY_CONTEXT_FALLBACK = "用户尚未输入内容，但请求 Muse 提供一个开场提示来打破空白。";

const ensureContext = (text: string) =>
  text && text.trim().length > 0 ? text : EMPTY_CONTEXT_FALLBACK;

declare global {
  interface Window {
    lockManager?: LockManager;
    editorInstance?: Editor;
    insertLockedContentForTest?: (content: string, lockId: string, source?: AgentSource) => void;
    rewriteLockedContentForTest?: (content: string, lockId: string, source?: AgentSource) => void;
    triggerManualDeleteForTest?: () => void;
    triggerMuseRewriteForTest?: () => void;
  }
}

interface EditorCoreProps {
  /** Captured authenticated session; null pauses AI while allowing local writing. */
  session?: RemoteSession | null;
  /** Stable identity of the currently displayed account draft. */
  requestIdentity?: string;
  /** Report recovery failure while retaining the original content and metadata. */
  onRecoveryError?: (error: Error) => void;
  initialContent?: string;
  mode?: AgentMode;
  onChange?: (markdown: string, lockIds: string[]) => void;
  onReady?: (editor: Editor) => void;
  /**
   * Initial lock IDs loaded from persistence.
   */
  initialLocks?: string[];
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
  /**
   * Content version counter for triggering content updates without remounting.
   * When this changes, the editor will update its content but keep state.
   */
  contentVersion?: number;
}

// Create logger instance for EditorCore namespace
const logger = createLogger("EditorCore");

/**
 * Inner component that uses useEditor hook.
 * Must be wrapped by MilkdownProvider.
 *
 * @param root0 - Component props
 * @param root0.initialContent - Initial Markdown content loaded into the editor
 * @param root0.mode - Current agent mode controlling intervention behavior
 * @param root0.onChange - Callback receiving markdown and lock ids on content change
 * @param root0.onReady - Callback invoked once the editor instance is ready
 * @param root0.initialLocks - Initial lock ids loaded from persistence
 * @param root0.externalTrigger - External trigger for manual AI intervention
 * @param root0.onTriggerProcessed - Callback when the external trigger is processed
 * @param root0.onTimerUpdate - Callback with remaining seconds in Muse mode
 * @param root0.onInterventionError - Callback surfacing intervention errors to parent UI
 * @param root0.contentVersion - Counter triggering content updates without remounting
 * @param root0.session - Current remote authorization or null for local writing
 * @param root0.requestIdentity - Stable identity of the current account draft
 * @param root0.onRecoveryError - Callback reporting unsafe draft recovery
 * @returns The rendered editor with toolbars and sensory feedback
 */
const EditorCoreInner: React.FC<EditorCoreProps> = ({
  initialContent = "",
  mode = "off",
  onChange,
  onReady,
  initialLocks,
  externalTrigger,
  onTriggerProcessed,
  onTimerUpdate,
  onInterventionError,
  contentVersion,
  session,
  requestIdentity,
  onRecoveryError,
}) => {
  // Get LockManager from context (DIP - Article IV)
  const lockManager = useLockManager();

  const editorRef = useRef<Editor | null>(null);
  const recoveryBlockedRef = useRef(true);
  const [recoveryFailure, setRecoveryFailure] = useState<{ error: Error; markdown: string } | null>(
    null
  );
  const onRecoveryErrorRef = useRef(onRecoveryError);
  const mountedRef = useRef(true);
  const requestContextRef = useRef({ session, requestIdentity });
  useLayoutEffect(() => {
    requestContextRef.current = { session, requestIdentity };
    onRecoveryErrorRef.current = onRecoveryError;
  }, [session, requestIdentity, onRecoveryError]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const isCurrentRequest = useCallback(
    (
      editor: Editor,
      identity: string | undefined,
      capturedSession: RemoteSession | null | undefined
    ) =>
      mountedRef.current &&
      !recoveryBlockedRef.current &&
      editorRef.current === editor &&
      requestContextRef.current.requestIdentity === identity &&
      requestContextRef.current.session === capturedSession &&
      capturedSession !== null &&
      (!capturedSession || (capturedSession.isCurrent() && !capturedSession.signal.aborted)),
    []
  );
  const [docVersion, setDocVersion] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [currentAction, setCurrentAction] = useState<AIActionType | null>(null);

  // T014: Expose editor instance for FloatingToolbar
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const remoteEnabled =
    session !== null &&
    !recoveryFailure &&
    (!session || (session.isCurrent() && !session.signal.aborted));

  // T017: Responsive toolbar - detect mobile viewport
  const isMobile = useMediaQuery("(max-width: 767px)");

  // Prevent multiple initializations (critical for preventing infinite loop)
  const editorInitializedRef = useRef(false);

  // Stable refs for callbacks to avoid useEffect re-runs
  const onReadyRef = useRef(onReady);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onReadyRef.current = onReady;
    onChangeRef.current = onChange;
  }, [onReady, onChange]);

  // Track last processed trigger to prevent duplicates
  const lastProcessedTriggerRef = useRef<AIActionType | null>(null);

  // Track if we're currently processing a trigger to prevent re-entry
  const isProcessingTriggerRef = useRef(false);

  // Track if delete is currently executing (separate from trigger processing)
  const isDeletingRef = useRef(false);

  // Uncontrolled content/locks are a mount-time value, even if props arrive later.
  const initialDocumentRef = useRef({ initialContent, initialLocks });
  const lastLoadedContentRef = useRef<{
    content: string;
    version: number;
    locks: string[];
  } | null>(null);

  const recoverLocks = useCallback(
    (editor: Editor, markdown: string, locks: string[]): string[] | null => {
      return editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        try {
          const ids = validateRecoveredLocks(
            markdown,
            locks,
            ctx.get(remarkCtx),
            ctx.get(parserCtx)
          );
          recoveryBlockedRef.current = false;
          setRecoveryFailure(null);
          view.setProps({ editable: () => !recoveryBlockedRef.current });
          return ids;
        } catch (error) {
          const failure = error instanceof Error ? error : new Error(String(error));
          recoveryBlockedRef.current = true;
          view.setProps({ editable: () => false });
          setRecoveryFailure({ error: failure, markdown });
          onRecoveryErrorRef.current?.(failure);
          return null;
        }
      });
    },
    []
  );

  const reconcileContent = useCallback(
    (editor: Editor) => {
      if (contentVersion === undefined) return;
      const locks = initialLocks ?? [];
      const previous = lastLoadedContentRef.current;
      if (
        previous?.version === contentVersion &&
        previous.content === initialContent &&
        previous.locks.length === locks.length &&
        previous.locks.every((lock, index) => lock === locks[index])
      ) {
        return;
      }
      const recoveredIds = recoverLocks(editor, initialContent, locks);
      if (!recoveredIds) return;

      const loaded = editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const currentContent = restoreLockMarkers(
          ctx.get(serializerCtx)(view.state.doc),
          ctx.get(remarkCtx)
        );
        const document = ctx.get(parserCtx)(
          preserveLockMarkers(initialContent, ctx.get(remarkCtx))
        );
        if (!document) return false;
        // Markdown serializers normalize spacing and final newlines. Compare
        // parsed documents before attempting a replacement protected by locks.
        const canonicalContent = restoreLockMarkers(
          ctx.get(serializerCtx)(document),
          ctx.get(remarkCtx)
        );
        if (
          currentContent !== initialContent &&
          currentContent !== canonicalContent &&
          !view.state.doc.eq(document)
        ) {
          const before = view.state.doc;
          view.dispatch(
            view.state.tr
              .replaceWith(0, before.content.size, document.content)
              .setMeta("loadedContent", true)
              .setMeta("addToHistory", false)
          );
          // Native filters still decide whether the replacement is permitted.
          if (view.state.doc === before) return false;
        }
        recoveredIds.forEach((lockId) => lockManager.applyLock(lockId));
        lockManager
          .extractLockEntriesFromMarkdown(initialContent)
          .filter(({ lockId }) => recoveredIds.includes(lockId))
          .forEach(({ lockId, source }) => lockManager.applyLock(lockId, { source }));
        refreshLockDecorations(view);
        return true;
      });
      if (!loaded) {
        const failure = new Error(
          "The restored draft could not replace the current locked document. Export the original and retry recovery."
        );
        recoveryBlockedRef.current = true;
        editor.action((ctx) => ctx.get(editorViewCtx).setProps({ editable: () => false }));
        setRecoveryFailure({ error: failure, markdown: initialContent });
        onRecoveryErrorRef.current?.(failure);
        return;
      }

      lastLoadedContentRef.current = {
        content: initialContent,
        version: contentVersion,
        locks: [...locks],
      };
    },
    [contentVersion, initialContent, initialLocks, lockManager, recoverLocks]
  );

  // The asynchronous initializer must reconcile the latest committed props.
  const reconcileContentRef = useRef(reconcileContent);
  useEffect(() => {
    reconcileContentRef.current = reconcileContent;
    if (editorInstance) reconcileContent(editorInstance);
  }, [reconcileContent, editorInstance]);

  // Animation durations from centralized config
  const actionResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSensoryAction = useCallback(
    (
      action: AIActionType,
      options?: {
        duration?: number;
        onComplete?: () => void;
      }
    ) => {
      const duration = options?.duration ?? DEFAULT_FEEDBACK_DURATION_MS;
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
  }, [showSensoryAction]);

  // Handle STUCK state intervention (Muse mode)
  const handleStuck = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;
    const captured = requestContextRef.current;
    if (!isCurrentRequest(editor, captured.requestIdentity, captured.session)) return;

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

      const response = await triggerMuseIntervention(contextWindow, cursorPosition, docVersion, {
        session: captured.session,
      });
      if (!isCurrentRequest(editor, captured.requestIdentity, captured.session)) return;

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
      if (!isCurrentRequest(editor, captured.requestIdentity, captured.session)) return;
      logger.error("Muse intervention failed", error);
      onInterventionError?.(error as Error);
      showSensoryAction(AIActionType.ERROR);
    }
  }, [
    cursorPosition,
    docVersion,
    lockManager,
    onInterventionError,
    showSensoryAction,
    isCurrentRequest,
  ]);

  // Handle Loki chaos trigger
  const handleLokiTrigger = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;
    const captured = requestContextRef.current;
    if (!isCurrentRequest(editor, captured.requestIdentity, captured.session)) return;

    const now = Date.now();
    if (now - lastLokiTriggerRef.current < LOKI_COOLDOWN_MS) {
      return;
    }
    lastLokiTriggerRef.current = now;

    try {
      const view = editor.action((ctx) => ctx.get(editorViewCtx));
      const fullText = view.state.doc.textContent;
      const contextWindow = ensureContext(extractLastSentences(fullText, 3));

      const response = await triggerLokiIntervention(contextWindow, cursorPosition, docVersion, {
        session: captured.session,
      });
      if (!isCurrentRequest(editor, captured.requestIdentity, captured.session)) return;

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
      if (!isCurrentRequest(editor, captured.requestIdentity, captured.session)) return;
      logger.error("Loki intervention failed", error);
      onInterventionError?.(error as Error);
      showSensoryAction(AIActionType.ERROR);
    }
  }, [
    cursorPosition,
    docVersion,
    lockManager,
    onInterventionError,
    showSensoryAction,
    isCurrentRequest,
  ]);

  // Handle manual delete trigger (Test Delete button)
  const handleManualDelete = useCallback(() => {
    // CRITICAL: Prevent re-entry at the function level
    if (isDeletingRef.current) {
      return;
    }

    const editor = editorRef.current;
    if (!editor) return;

    const captured = requestContextRef.current;
    if (!isCurrentRequest(editor, captured.requestIdentity, captured.session)) return;

    // Set flag IMMEDIATELY before any other operations
    isDeletingRef.current = true;

    try {
      const view = editor.action((ctx) => ctx.get(editorViewCtx));
      const { state } = view;
      const docSize = state.doc.content.size;

      // Safety check: Don't delete if document is too small
      if (docSize < MIN_DOCUMENT_SIZE_FOR_DELETE) {
        showSensoryAction(AIActionType.ERROR, { duration: MANUAL_ANIMATION_DURATION_MS }); // Show error feedback
        return;
      }

      // Find the last paragraph or sentence (approximately 50-100 characters)
      // Simple heuristic: delete last 20% of document or minimum 50 chars
      const deleteLength = Math.min(
        Math.max(Math.floor(docSize * DEFAULT_DELETE_PERCENTAGE), MIN_DELETE_LENGTH),
        MAX_DELETE_LENGTH
      );
      const from = Math.max(0, docSize - deleteLength);
      const to = docSize;

      if (from < to && to <= docSize) {
        showSensoryAction(AIActionType.DELETE, { duration: MANUAL_ANIMATION_DURATION_MS });
        deleteContentAtAnchor(view, { type: "range", from, to });
      }
    } finally {
      // Reset flag after a delay to allow React to process state updates
      setTimeout(() => {
        isDeletingRef.current = false;
      }, DELETE_RESET_DELAY_MS); // Ensure all state updates complete
    }
  }, [showSensoryAction, isCurrentRequest]);

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
    mode: remoteEnabled ? mode : "off",
    onStuck: handleStuck,
    onTimerUpdate, // T004: Forward timer updates to parent (App.tsx)
  });

  // Use ref to avoid including onInput in useEffect dependencies
  const onInputRef = useRef(onInput);
  useEffect(() => {
    onInputRef.current = onInput;
  }, [onInput]);

  const lastLokiTriggerRef = useRef(0);
  // Loki cooldown from centralized config

  // Random chaos timer (Loki mode)
  useLokiTimer({
    mode: remoteEnabled ? mode : "off",
    onTrigger: handleLokiTrigger,
  });

  // Manual animation duration from centralized config

  // Handle external manual trigger
  useEffect(() => {
    if (!remoteEnabled) {
      lastProcessedTriggerRef.current = externalTrigger ?? null;
      isProcessingTriggerRef.current = false;
      if (externalTrigger) onTriggerProcessed?.();
      return;
    }
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
        showSensoryAction(AIActionType.REWRITE, { duration: MANUAL_ANIMATION_DURATION_MS });
        handleStuckRef.current();
        const timer = setTimeout(() => {
          isProcessingTriggerRef.current = false;
        }, MANUAL_ANIMATION_DURATION_MS);
        return () => clearTimeout(timer);
      }

      if (externalTrigger === AIActionType.DELETE) {
        showSensoryAction(AIActionType.DELETE, { duration: MANUAL_ANIMATION_DURATION_MS });
        handleManualDeleteRef.current();
        const timer = setTimeout(() => {
          isProcessingTriggerRef.current = false;
        }, MANUAL_ANIMATION_DURATION_MS);
        return () => clearTimeout(timer);
      }

      if (externalTrigger === AIActionType.CHAOS && mode === "loki") {
        Promise.resolve(handleLokiTriggerRef.current?.()).finally(() => {
          isProcessingTriggerRef.current = false;
        });
        return;
      }

      showSensoryAction(externalTrigger, { duration: MANUAL_ANIMATION_DURATION_MS });
      const timer = setTimeout(() => {
        isProcessingTriggerRef.current = false;
      }, MANUAL_ANIMATION_DURATION_MS);

      return () => {
        clearTimeout(timer);
      };
    } else if (!externalTrigger) {
      // Reset the ref when trigger is cleared
      lastProcessedTriggerRef.current = null;
      isProcessingTriggerRef.current = false;
    }
  }, [externalTrigger, onTriggerProcessed, mode, showSensoryAction, remoteEnabled]);

  // Initialize editor - don't use loading state
  const { get } = useEditor((root) => {
    return (
      Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root);
          ctx.update(editorViewOptionsCtx, (options) => ({
            ...options,
            editable: () => !recoveryBlockedRef.current,
          }));
          // Use empty string as default if no initialContent provided
          ctx.set(defaultValueCtx, preserveLockMarkers(initialContent || "", ctx.get(remarkCtx)));
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
    const maxAttempts = EDITOR_MAX_RETRY_ATTEMPTS;

    const initEditor = async () => {
      const getEditor = getRef.current;
      if (!getEditor) {
        logger.error("Editor getter unavailable");
        return;
      }

      // Poll for editor with retry logic
      let editor = getEditor();

      while (!editor && mounted && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, EDITOR_RETRY_INTERVAL_MS));
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
      const initialDocument = initialDocumentRef.current;
      const recoveredIds = recoverLocks(
        editor,
        initialDocument.initialContent,
        initialDocument.initialLocks ?? []
      );

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
          if (recoveryBlockedRef.current) return;
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
        recoveredIds?.forEach((lockId) => lockManager.applyLock(lockId));
        applyLockDecorations(view, lockManager);
      });

      // Apply lock transaction filter for lock enforcement AFTER decorations
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const lockFilter = createLockTransactionFilter(lockManager, () => {
          showSensoryAction(AIActionType.REJECT, { duration: REJECTION_FEEDBACK_DURATION_MS });
        });

        view.updateState(
          view.state.reconfigure({
            plugins: [
              ...view.state.plugins,
              new Plugin({
                filterTransaction: (tr) => !tr.docChanged || !recoveryBlockedRef.current,
              }),
              new Plugin({ filterTransaction: lockFilter }),
            ],
          })
        );
      });

      // Extract locks from initial content
      if (recoveredIds && initialDocumentRef.current.initialContent) {
        const entries = lockManager.extractLockEntriesFromMarkdown(
          initialDocumentRef.current.initialContent
        );
        entries
          .filter(({ lockId }) => recoveredIds.includes(lockId))
          .forEach(({ lockId, source }) => lockManager.applyLock(lockId, { source }));
      }

      reconcileContentRef.current(editor);

      // Add listener for user input
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const originalDispatchTransaction = view.dispatch.bind(view);
        let dispatchDepth = 0;

        view.dispatch = (tr) => {
          if (
            !mountedRef.current ||
            editorRef.current !== editor ||
            (tr.docChanged && recoveryBlockedRef.current)
          )
            return;
          // Let every installed state plugin filter the transaction before
          // reporting input or persistence changes for an accepted edit.
          const previousState = view.state;
          dispatchDepth++;
          try {
            originalDispatchTransaction(tr);
          } finally {
            dispatchDepth--;
          }
          // Commonmark updates heading IDs via a nested dispatch. Report the
          // final document once for the outer edit, including those updates.
          if (dispatchDepth > 0 || view.state === previousState || tr.getMeta("loadedContent"))
            return;

          if (tr.docChanged) {
            setDocVersion((v) => v + 1);
            const newPos = tr.selection.$head.pos;
            setCursorPosition(newPos);
            // Use ref to avoid dependency issues
            onInputRef.current();

            // Auto-detect and register locks from content changes
            // Register accepted locks before the NEXT transaction (e.g., deletion).
            // Uses same pattern as LockDecorations (which successfully detects locks).
            const liveLocks = new Set<string>();
            view.state.doc.descendants((node) => {
              if (node.type.name === "code_block") return false;
              if (node.isText && node.marks.some((mark) => mark.type.name === "inlineCode")) return;
              if (!node.isTextblock && !node.isText) return;
              const metadata = extractLockAttributes(node, lockManager);
              if (node.isTextblock && metadata) {
                let prose = "";
                node.descendants((child) => {
                  if (child.isText)
                    prose += child.marks.some((mark) => mark.type.name === "inlineCode")
                      ? "\n"
                      : child.textContent;
                });
                const markers = [
                  ...prose.matchAll(/<!--\s*lock:([^\s>]+)(?:\s+source:([^\s>]+))?\s*-->/gi),
                ];
                markers.forEach((match) => liveLocks.add(match[1]!));
                if (!markers.some((match) => match[1] === metadata.lockId)) return;
              }
              if (metadata?.lockId) liveLocks.add(metadata.lockId);
              if (metadata?.lockId && !lockManager.hasLock(metadata.lockId)) {
                lockManager.applyLock(metadata.lockId, { source: metadata.source });
                refreshLockDecorations(view);
              }
            });

            // Only an accepted AI action may retire locks whose writing it
            // intentionally removed. Recovery and ordinary edits keep strict
            // missing-lock validation instead of silently discarding locks.
            if (tr.getMeta("aiAction")) {
              lockManager.getAllLocks().forEach((id) => {
                if (!liveLocks.has(id)) lockManager.removeLock(id);
              });
              refreshLockDecorations(view);
            }
            const markdown = restoreLockMarkers(
              ctx.get(serializerCtx)(view.state.doc),
              ctx.get(remarkCtx)
            );
            onChangeRef.current?.(markdown, lockManager.getAllLocks());
          }
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
  }, [lockManager, showSensoryAction, recoverLocks]);

  // Always render immediately - no loading state
  return (
    <div
      className="editor-container"
      style={{ position: "relative" }}
      data-testid="editor-ready"
      data-state={recoveryFailure ? "recovery-error" : "ready"}
    >
      {recoveryFailure && (
        <>
          <p role="alert">{recoveryFailure.error.message}</p>
          <pre data-testid="unrecovered-draft">{recoveryFailure.markdown}</pre>
        </>
      )}
      <div hidden={Boolean(recoveryFailure)}>
        <Milkdown />
      </div>
      <SensoryFeedback actionType={currentAction} />
      {/* T017-T018: Responsive toolbar - conditional rendering based on viewport */}
      {!recoveryFailure &&
        (isMobile ? (
          <BottomDockedToolbar editor={editorInstance} />
        ) : (
          <FloatingToolbar editor={editorInstance} />
        ))}
    </div>
  );
};

/**
 * EditorCore - Wrapper component with MilkdownProvider and LockManagerProvider
 *
 * Fixes React 19 + Milkdown compatibility by:
 * - Providing Milkdown context at root level
 * - Providing LockManager context for dependency injection (Article IV)
 * - Removing loading state blocking
 * - Using stable refs for callbacks
 *
 * @param props - EditorCore props forwarded to the inner editor component
 * @returns The inner editor wrapped in MilkdownProvider and LockManagerProvider
 */
export const EditorCore: React.FC<EditorCoreProps> = (props) => {
  return (
    <LockManagerProvider>
      <MilkdownProvider>
        <EditorCoreInner {...props} />
      </MilkdownProvider>
    </LockManagerProvider>
  );
};

export default EditorCore;
