/**
 * Manual delete operation hook.
 *
 * Handles manual delete trigger with safety checks and animation.
 *
 * @module hooks/useManualDelete
 */

import { useCallback, useRef } from "react";
import type { Editor } from "@milkdown/core";
import { editorViewCtx } from "@milkdown/core";
import { deleteContentAtAnchor } from "../services/ContentInjector";
import { AIActionType } from "../types/ai-actions";
import {
  DELETE_RESET_DELAY_MS,
  MIN_DOCUMENT_SIZE_FOR_DELETE,
  DEFAULT_DELETE_PERCENTAGE,
  MAX_DELETE_LENGTH,
  MIN_DELETE_LENGTH,
} from "../config/animation";

/**
 * Options for useManualDelete hook.
 */
export interface UseManualDeleteOptions {
  /** Callback to trigger sensory feedback */
  onSensoryFeedback: (action: AIActionType, options?: { duration?: number }) => void;
}

/**
 * Return value from useManualDelete hook.
 */
export interface UseManualDeleteReturn {
  /** Handle manual delete trigger */
  handleManualDelete: (editor: Editor | null) => void;
  /** Whether delete is currently executing */
  isDeleting: boolean;
}

/**
 * Hook for managing manual delete operations.
 *
 * @param options - Hook configuration
 * @returns Delete handler and state
 */
export function useManualDelete(options: UseManualDeleteOptions): UseManualDeleteReturn {
  const { onSensoryFeedback } = options;
  const isDeletingRef = useRef(false);

  const handleManualDelete = useCallback(
    (editor: Editor | null) => {
      // Prevent re-entry
      if (isDeletingRef.current) {
        return;
      }

      if (!editor) return;

      // Set flag immediately
      isDeletingRef.current = true;

      try {
        const view = editor.action((ctx) => ctx.get(editorViewCtx));
        const { state } = view;
        const docSize = state.doc.content.size;

        // Safety check: Don't delete if document is too small
        if (docSize < MIN_DOCUMENT_SIZE_FOR_DELETE) {
          onSensoryFeedback(AIActionType.ERROR, { duration: DELETE_RESET_DELAY_MS });
          return;
        }

        // Calculate delete length
        const deleteLength = Math.min(
          Math.max(Math.floor(docSize * DEFAULT_DELETE_PERCENTAGE), MIN_DELETE_LENGTH),
          MAX_DELETE_LENGTH
        );
        const from = Math.max(0, docSize - deleteLength);
        const to = docSize;

        if (from < to && to <= docSize) {
          onSensoryFeedback(AIActionType.DELETE, { duration: DELETE_RESET_DELAY_MS });
          deleteContentAtAnchor(view, { type: "range", from, to });
        }
      } finally {
        // Reset flag after delay
        setTimeout(() => {
          isDeletingRef.current = false;
        }, DELETE_RESET_DELAY_MS);
      }
    },
    [onSensoryFeedback]
  );

  return {
    handleManualDelete,
    isDeleting: isDeletingRef.current,
  };
}
