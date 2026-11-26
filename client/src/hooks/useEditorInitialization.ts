/**
 * Editor initialization hook.
 *
 * Handles Milkdown editor setup, retry logic, and cleanup.
 *
 * @module hooks/useEditorInitialization
 */

import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
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

function createEditorReadiness() {
  let ready = false;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => ready,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    markReady() {
      ready = true;
      listeners.forEach((listener) => listener());
    },
  };
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
  const [readiness] = useState(createEditorReadiness);
  const isInitialized = useSyncExternalStore(
    readiness.subscribe,
    readiness.getSnapshot,
    () => false
  );
  const reportReady = useEffectEvent((editor: Editor) => onReady?.(editor));

  useEffect(() => {
    if (!getEditor || readiness.getSnapshot()) return;

    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      const editor = getEditor();
      if (editor) {
        editorRef.current = editor;
        readiness.markReady();
        reportReady(editor);
      } else if (attempts < EDITOR_MAX_RETRY_ATTEMPTS) {
        attempts++;
        timer = setTimeout(check, EDITOR_RETRY_INTERVAL_MS);
      } else {
        logger.error("Editor failed to initialize", {
          timeoutMs: attempts * EDITOR_RETRY_INTERVAL_MS,
        });
      }
    };

    check();
    return () => clearTimeout(timer);
  }, [getEditor, readiness]);

  return { editorRef, isInitialized };
}
