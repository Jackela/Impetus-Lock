import { useManualTrigger } from "../hooks/useManualTrigger";
import type { AgentMode } from "../types/mode";

/**
 * Manual trigger button for instant AI intervention in Muse mode.
 *
 * Provides users with a way to immediately request AI assistance without waiting
 * for automatic STUCK detection (60-second timeout). Button is only enabled in
 * Muse mode and implements debouncing to prevent rapid-fire API requests.
 *
 * **Requirements**:
 * - FR-001: Display clearly labeled manual trigger button when Muse mode is active
 * - FR-002: Button disabled (non-clickable, visually grayed out) in Loki/Off modes
 * - FR-003: Immediately trigger AI Provoke action on button click in Muse mode
 * - FR-004: Debounce clicks to prevent multiple simultaneous API requests (2s cooldown)
 * - FR-005: Show loading/disabled state while AI action is in progress
 *
 * **Accessibility**:
 * - `aria-label`: Descriptive label for screen readers
 * - `disabled` attribute: Properly disabled in non-Muse modes and during loading
 * - `data-testid`: Test identifier for E2E/unit tests
 *
 * @param props - Component props
 * @param props.mode - Current agent mode (muse/loki/off)
 * @param props.onTrigger - Callback when manual trigger succeeds (for sensory feedback)
 *
 * @example
 * ```typescript
 * <ManualTriggerButton
 *   mode="muse"
 *   onTrigger={() => setActionType(AIActionType.PROVOKE)}
 * />
 * ```
 */
export function ManualTriggerButton({
  mode,
  onTrigger,
}: {
  mode: AgentMode;
  onTrigger?: () => void;
}) {
  const { trigger, isLoading } = useManualTrigger();

  // FR-002: Button only enabled in Muse mode
  const isEnabled = mode === "muse" && !isLoading;

  const handleClick = async () => {
    // Trigger sensory feedback immediately (don't wait for API)
    // This provides instant user feedback even if backend is unavailable
    onTrigger?.();

    try {
      await trigger();
    } catch (error) {
      // Error already logged in useManualTrigger
      // Sensory feedback already shown, so user knows button was clicked
      console.error("Manual trigger button: API call failed", error);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={!isEnabled}
      aria-label="I'm stuck! Trigger AI assistance"
      data-testid="manual-trigger-button"
      className="manual-trigger-button"
      data-loading={isLoading}
    >
      {isLoading && <span className="button-spinner"></span>}
      <span>{isLoading ? "Thinking..." : "I'm stuck!"}</span>
    </button>
  );
}
