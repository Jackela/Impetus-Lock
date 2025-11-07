import { useState, useCallback, useRef } from "react";
import { triggerMuseIntervention } from "../services/api/interventionClient";

/**
 * Hook for manual AI intervention trigger with debouncing and loading state.
 *
 * Provides a debounced trigger function that calls the P1 Provoke API endpoint
 * and manages loading state for UI feedback. Implements a 2-second cooldown
 * to prevent rapid-fire API requests.
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
   * Calls the existing P1 triggerProvoke() API endpoint if the cooldown period
   * has elapsed since the last trigger. Manages loading state for UI feedback.
   *
   * @throws {Error} If API call fails (network timeout, server error)
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
      // Call P1 Provoke API endpoint (FR-003)
      // Note: For manual trigger, we send minimal context
      // The backend will handle STUCK detection logic
      await triggerMuseIntervention(
        "", // Empty context - manual trigger doesn't need content analysis
        0, // Cursor position not relevant for manual trigger
        0 // Doc version not relevant for manual trigger
      );
    } catch (error) {
      // Error handling - FR-016: Display error feedback
      console.error("Manual trigger failed:", error);
      // TODO: Trigger error feedback (red flash + buzz sound)
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { trigger, isLoading };
}
