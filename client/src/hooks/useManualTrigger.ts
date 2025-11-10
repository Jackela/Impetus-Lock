import { useState, useCallback, useRef } from "react";

/**
 * Hook for manual AI intervention trigger with debouncing and loading state.
 *
 * Provides a debounced trigger function that manages loading state for the
 * manual button. Actual intervention requests are executed inside EditorCore
 * once the external trigger propagates. This hook simply enforces a 2-second
 * cooldown window so users can't spam the button.
 *
 * **Requirements**:
 * - FR-003: Immediately trigger AI Provoke action when manual trigger button is clicked
 * - FR-004: Debounce manual trigger button clicks (minimum 2-second cooldown)
 * - FR-005: Show loading/disabled state while AI action is in progress
 *
 * **Performance Target**:
 * - SC-001: Manual trigger response <2s (button click → AI Provoke action received)
 *
 * @returns Object containing trigger function and loading state
 *
 * @example
 * ```typescript
 * function ManualTriggerButton() {
 *   const { trigger, isLoading } = useManualTrigger();
 *
 *   return (
 *     <button onClick={trigger} disabled={isLoading}>
 *       {isLoading ? 'Thinking...' : "I'm stuck!"}
 *     </button>
 *   );
 * }
 * ```
 */
export function useManualTrigger() {
  const [isLoading, setIsLoading] = useState(false);
  const lastTriggerTime = useRef<number>(0);
  const COOLDOWN_MS = 2000; // 2 seconds (FR-004)

  /**
   * Trigger function with 2-second cooldown debouncing.
   *
   * Starts a cooldown timer and exposes loading state so the UI can mirror the
   * “thinking” feedback while EditorCore performs the actual API call.
   */
  const trigger = useCallback(async () => {
    const now = Date.now();
    const timeSinceLastTrigger = now - lastTriggerTime.current;

    // Debounce: Ignore if within cooldown period (FR-004)
    if (timeSinceLastTrigger < COOLDOWN_MS) {
      return;
    }

    lastTriggerTime.current = now;
    setIsLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, COOLDOWN_MS));
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { trigger, isLoading };
}
