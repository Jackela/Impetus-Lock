/**
 * Editor initialization hook.
 *
 * Handles Milkdown editor setup, retry logic, and cleanup.
 *
 * @module hooks/useEditorInitialization
 */

import { useEffect, useRef, useCallback } from "react";
import type { Editor } from "@milkdown/core";
import { EDITOR_RETRY_INTERVAL_MS, EDITOR_MAX_RETRY_ATTEMPTS } from "../config/animation";
import { createLogger } from "../utils/logger";

const logger = createLogger("useEditorInitialization");

/**
 * Options for useEditorInitialization hook.
 */
export interface UseEditorInitializationOptions {
  /** Editor getter function from useEditor hook */
  getEditor: (() => Editor | undefined) | null;
  /** Callback when editor is ready */
  onReady?: (editor: Editor) => void;
}

/**
 * Return value from useEditorInitialization hook.
 */
export interface UseEditorInitializationReturn {
  /** Reference to the editor instance */
  editorRef: React.MutableRefObject<Editor | null>;
  /** Whether initialization is complete */
  isInitialized: boolean;
}

/**
 * Hook for initializing Milkdown editor with retry logic.
 *
 * @param options - Hook configuration
 * @returns Editor reference and initialization state
 */
export function useEditorInitialization(
  options: UseEditorInitializationOptions
): UseEditorInitializationReturn {
  const { getEditor, onReady } = options;
  const editorRef = useRef<Editor | null>(null);
  const initializedRef = useRef(false);
  const onReadyRef = useRef(onReady);

  // Keep callback ref up to date
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  const initialize = useCallback(async () => {
    if (initializedRef.current || !getEditor) {
      return;
    }

    let attempts = 0;
    let mounted = true;

    const tryInitialize = async () => {
      let editor = getEditor();

      while (!editor && mounted && attempts < EDITOR_MAX_RETRY_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, EDITOR_RETRY_INTERVAL_MS));
        editor = getEditor();
        attempts++;
      }

      if (!editor || !mounted) {
        if (!editor) {
          logger.error("Editor failed to initialize", { timeoutMs: attempts * EDITOR_RETRY_INTERVAL_MS });
        }
        return;
      }

      editorRef.current = editor;
      initializedRef.current = true;

      if (onReadyRef.current) {
        onReadyRef.current(editor);
      }
    };

    await tryInitialize();

    return () => {
      mounted = false;
    };
  }, [getEditor]);

  useEffect(() => {
    const cleanup = initialize();
    return () => {
      cleanup?.then((cleanupFn) => cleanupFn?.());
    };
  }, [initialize]);

  return {
    editorRef,
    isInitialized: initializedRef.current,
  };
}
