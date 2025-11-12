import { useManualTrigger } from "../hooks/useManualTrigger";
import type { AgentMode } from "../types/mode";
import { AIActionType } from "../types/ai-actions";

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
 * @param props.onTrigger - Callback for sensory feedback (receives AIActionType: PROVOKE on success, ERROR on failure)
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
  onTrigger?: (actionType: AIActionType) => void;
}) {
  const { trigger, isLoading } = useManualTrigger();

  const isMuseMode = mode === "muse";
  const isLokiMode = mode === "loki";

  // FR-002: Button only enabled in Muse mode
  const isMuseEnabled = isMuseMode && !isLoading;

  /**
   * Handle button click with error feedback (P3 US3: T010).
   *
   * On success: Triggers PROVOKE sensory feedback
   * On failure: Triggers ERROR sensory feedback (red flash + buzz sound)
   *
   * @see FR-005 (ERROR visual feedback)
   * @see FR-006 (ERROR audio feedback)
   */
  const handleClick = async () => {
    if (!isMuseMode || !isMuseEnabled) {
      return;
    }

    // Trigger PROVOKE feedback immediately (don't wait for API)
    // This provides instant user feedback even if backend is unavailable
    onTrigger?.(AIActionType.PROVOKE);

    try {
      await trigger();
    } catch (error) {
      // P3 US3: Trigger ERROR feedback on API failure
      onTrigger?.(AIActionType.ERROR);
      console.error("Manual trigger failed:", error);
    }
  };

  /**
   * Handle DELETE action trigger (development only - P3 US1: T032).
   *
   * Triggers DELETE sensory feedback (fade-out animation + whoosh sound).
   * This button is only available in development mode for testing Loki delete feedback.
   *
   * @see FR-011 (DELETE visual feedback)
   * @see FR-012 (DELETE audio feedback)
   */
  const handleDeleteTrigger = () => {
    onTrigger?.(AIActionType.DELETE);
  };

  /**
   * Handle manual Loki chaos trigger for deterministic testing.
   */
  const handleLokiChaosTrigger = () => {
    onTrigger?.(AIActionType.CHAOS);
  };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={!isMuseEnabled}
        aria-label="I'm stuck! Trigger AI assistance"
        data-testid="manual-trigger-button"
        className="manual-trigger-button"
        data-loading={isLoading}
        data-mode={mode}
      >
        {isLoading && <span className="button-spinner"></span>}
        <span>{isLoading ? "Thinking..." : "I'm stuck!"}</span>
      </button>

      {isLokiMode && (
        <button
          onClick={handleLokiChaosTrigger}
          aria-label="Trigger Loki chaos"
          data-testid="manual-loki-trigger"
          className="manual-trigger-button"
          style={{ backgroundColor: "#ef4444" }}
        >
          Summon Loki
        </button>
      )}

      {/* P3 US1: Development-only DELETE trigger for testing Loki delete feedback */}
      {import.meta.env.DEV && (
        <button
          onClick={handleDeleteTrigger}
          aria-label="Test Delete feedback (dev only)"
          data-testid="manual-delete-trigger"
          className="manual-trigger-button dev-only"
          style={{ marginLeft: "8px", backgroundColor: "#ef4444" }}
        >
          Test Delete
        </button>
      )}
    </>
  );
}
