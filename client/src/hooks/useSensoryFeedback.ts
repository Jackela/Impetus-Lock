/**
 * Sensory feedback hook.
 *
 * Manages visual and audio feedback for AI actions.
 *
 * @module hooks/useSensoryFeedback
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { AIActionType } from "../types/ai-actions";
import { DEFAULT_FEEDBACK_DURATION_MS } from "../config/animation";

/**
 * Options for useSensoryFeedback hook.
 */
export interface UseSensoryFeedbackOptions {
  /** Default duration for feedback animations (milliseconds) */
  defaultDuration?: number;
}

/**
 * Return value from useSensoryFeedback hook.
 */
export interface UseSensoryFeedbackReturn {
  /** Current active action type */
  currentAction: AIActionType | null;
  /** Trigger sensory feedback for an action */
  showSensoryAction: (
    action: AIActionType,
    options?: {
      duration?: number;
      onComplete?: () => void;
    }
  ) => void;
  /** Clear current feedback */
  clearSensoryAction: () => void;
}

/**
 * Hook for managing sensory feedback (visual + audio).
 *
 * @param options - Hook configuration
 * @returns Sensory feedback state and control functions
 */
export function useSensoryFeedback(
  options: UseSensoryFeedbackOptions = {}
): UseSensoryFeedbackReturn {
  const { defaultDuration = DEFAULT_FEEDBACK_DURATION_MS } = options;
  const [currentAction, setCurrentAction] = useState<AIActionType | null>(null);
  const actionResetTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearSensoryAction = useCallback(() => {
    if (actionResetTimerRef.current) {
      clearTimeout(actionResetTimerRef.current);
      actionResetTimerRef.current = null;
    }
    setCurrentAction(null);
  }, []);

  const showSensoryAction = useCallback(
    (
      action: AIActionType,
      options?: {
        duration?: number;
        onComplete?: () => void;
      }
    ) => {
      const duration = options?.duration ?? defaultDuration;

      // Clear any existing timer
      if (actionResetTimerRef.current) {
        clearTimeout(actionResetTimerRef.current);
      }

      setCurrentAction(action);

      actionResetTimerRef.current = setTimeout(() => {
        setCurrentAction(null);
        actionResetTimerRef.current = null;
        options?.onComplete?.();
      }, duration);
    },
    [defaultDuration]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (actionResetTimerRef.current) {
        clearTimeout(actionResetTimerRef.current);
      }
    };
  }, []);

  return {
    currentAction,
    showSensoryAction,
    clearSensoryAction,
  };
}
