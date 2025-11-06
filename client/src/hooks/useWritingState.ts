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
 */
const IDLE_THRESHOLD = 5000; // 5 seconds
const STUCK_THRESHOLD = 60000; // 60 seconds

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
  const { mode, onStuck } = options;

  // Current writing state
  const [state, setState] = useState<WritingState>("WRITING");

  // Track last input timestamp
  const lastInputTime = useRef<number>(Date.now());

  // Track if onStuck was already called for current STUCK transition
  const stuckCallbackFired = useRef<boolean>(false);

  // Timer reference for cleanup
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Handle user input event.
   * Resets idle timers and transitions back to WRITING.
   */
  const onInput = useCallback(() => {
    if (mode !== "muse") {
      // State machine disabled for non-Muse modes
      return;
    }

    // Update last input timestamp
    lastInputTime.current = Date.now();

    // Reset state to WRITING
    if (state !== "WRITING") {
      setState("WRITING");
      stuckCallbackFired.current = false;
    }
  }, [mode, state]);

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

  /**
   * State machine timer effect.
   * Checks idle time every 1 second and transitions states.
   */
  useEffect(() => {
    // Disable state machine for non-Muse modes
    if (mode !== "muse") {
      setState("WRITING");
      return;
    }

    // Setup interval to check idle time
    timerRef.current = setInterval(() => {
      const idleTime = Date.now() - lastInputTime.current;

      if (idleTime >= STUCK_THRESHOLD) {
        // Transition to STUCK after 60s idle
        if (state !== "STUCK") {
          setState("STUCK");

          // Call onStuck callback (only once per transition)
          if (onStuck && !stuckCallbackFired.current) {
            stuckCallbackFired.current = true;
            onStuck();
          }
        }
      } else if (idleTime >= IDLE_THRESHOLD) {
        // Transition to IDLE after 5s idle
        if (state !== "IDLE") {
          setState("IDLE");
        }
      }
    }, 1000); // Check every second

    // Cleanup on unmount or mode change
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [mode, state, onStuck]);

  return {
    state,
    onInput,
    manualTrigger,
  };
}
