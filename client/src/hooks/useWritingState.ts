/**
 * Writing state machine hook for Muse mode STUCK detection.
 *
 * State diagram:
 * ```
 *   WRITING → (5s idle) → IDLE → (55s idle) → STUCK
 *      ↑                     ↑                    ↑
 *      └─────────────────────┴────────────────────┘
 *                  (user input resumes)
 * ```
 *
 * Constitutional Compliance:
 * - Article I (Simplicity): Native setInterval, no external state libraries
 * - Article V (Documentation): Complete JSDoc with state diagram
 *
 * Success Criteria:
 * - SC-002: STUCK detection accuracy ≥95%
 *
 * @example
 * ```tsx
 * const { state, onInput, manualTrigger } = useWritingState({
 *   mode: 'muse',
 *   onStuck: () => {
 *     // Trigger Muse intervention
 *     console.log('User is stuck! Injecting creative pressure...');
 *   }
 * });
 *
 * // In editor onChange handler
 * editor.on('input', onInput);
 * ```
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { MUSE_IDLE_TIMEOUT_MS, MUSE_STUCK_TIMEOUT_MS } from "../config/animation";
import { useInterval } from "./useInterval";

/**
 * Writing state values.
 */
export type WritingState = "WRITING" | "IDLE" | "STUCK";

/**
 * Agent mode values.
 */
export type AgentMode = "muse" | "loki" | "off";

/**
 * useWritingState hook options.
 */
export interface UseWritingStateOptions {
  /**
   * Agent mode. State machine only active when mode="muse".
   */
  mode: AgentMode;

  /**
   * Callback triggered when state transitions to STUCK.
   * Only called once per STUCK transition.
   */
  onStuck?: () => void;

  /**
   * Callback for timer updates (called every second in Muse mode).
   * Receives remaining time in seconds until STUCK (0-60).
   * Used for visual timer indicator (T004).
   */
  onTimerUpdate?: (remainingSeconds: number) => void;
}

/**
 * useWritingState hook return value.
 */
export interface UseWritingStateReturn {
  /**
   * Current writing state.
   */
  state: WritingState;

  /**
   * Call this when user types (resets idle timers).
   */
  onInput: () => void;

  /**
   * Manual trigger for Demo mode (US4).
   * Forces immediate transition to STUCK and calls onStuck.
   */
  manualTrigger: () => void;
}

/**
 * Time thresholds for state transitions (milliseconds).
 * Imported from centralized animation config.
 */
const IDLE_THRESHOLD = MUSE_IDLE_TIMEOUT_MS;
const STUCK_THRESHOLD = MUSE_STUCK_TIMEOUT_MS;

/**
 * Hook for detecting writing state (WRITING → IDLE → STUCK).
 *
 * Implements state machine for Muse mode automatic intervention.
 * State transitions based on idle time since last user input.
 *
 * @param options - Hook configuration
 * @returns Current state and control functions
 *
 * @example
 * ```tsx
 * const { state, onInput } = useWritingState({ mode: 'muse' });
 *
 * useEffect(() => {
 *   editor.on('input', onInput);
 *   return () => editor.off('input', onInput);
 * }, [editor, onInput]);
 * ```
 */
export function useWritingState(options: UseWritingStateOptions): UseWritingStateReturn {
  const { mode, onStuck, onTimerUpdate } = options;

  // Current writing state
  const [state, setState] = useState<WritingState>("WRITING");

  // Track last input timestamp
  const lastInputTime = useRef<number>(Date.now());

  // Track if onStuck was already called for current STUCK transition
  const stuckCallbackFired = useRef<boolean>(false);

  // State machine tick function
  const stateMachineTick = useCallback(() => {
    const idleTime = Date.now() - lastInputTime.current;

    const remainingMs = Math.max(0, STUCK_THRESHOLD - idleTime);
    const remainingSeconds = Math.ceil(remainingMs / 1000);

    if (onTimerUpdate) {
      onTimerUpdate(remainingSeconds);
    }

    setState((prev) => {
      if (idleTime >= STUCK_THRESHOLD && prev !== "STUCK") {
        if (onStuck && !stuckCallbackFired.current) {
          stuckCallbackFired.current = true;
          onStuck();
        }
        return "STUCK";
      } else if (idleTime >= IDLE_THRESHOLD && prev !== "IDLE") {
        return "IDLE";
      }
      return prev;
    });
  }, [onStuck, onTimerUpdate]);

  // Use generic interval hook for state machine
  const { restart: restartTimer } = useInterval({
    callback: stateMachineTick,
    delay: mode === "muse" ? 1000 : null,
  });

  /**
   * Handle user input event.
   * Resets idle timers and transitions back to WRITING.
   */
  const onInput = useCallback(() => {
    if (mode !== "muse") {
      return;
    }

    lastInputTime.current = Date.now();

    setState((prev) => {
      if (prev !== "WRITING") {
        stuckCallbackFired.current = false;
        return "WRITING";
      }
      return prev;
    });

    restartTimer();
  }, [mode, restartTimer]);

  /**
   * Manual trigger for Demo mode.
   * Forces immediate STUCK transition.
   */
  const manualTrigger = useCallback(() => {
    setState("STUCK");

    if (onStuck && !stuckCallbackFired.current) {
      stuckCallbackFired.current = true;
      onStuck();
    }
  }, [onStuck]);

  // Reset state when mode changes
  useEffect(() => {
    if (mode !== "muse") {
      setState("WRITING");
    }
  }, [mode]);

  return {
    state,
    onInput,
    manualTrigger,
  };
}
