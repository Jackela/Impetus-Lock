/**
 * TimerIndicator Component
 *
 * Displays a subtle progress bar showing STUCK timer state in Muse mode.
 * Non-intrusive design (2px bar, 0.6 opacity, purple) maintains Zen writing aesthetic.
 *
 * **Design Decisions**:
 * - Fixed position at top of viewport (below header)
 * - Width animated from 0-100% over 60 seconds
 * - pointer-events: none to avoid blocking editor interaction
 * - Accessible via ARIA progressbar role
 *
 * **Requirements**:
 * - Only visible when Muse mode active (`visible` prop)
 * - Resets to 0% when user types (parent state management)
 * - Smooth linear animation (1s transition for progress updates)
 *
 * @see specs/chrome-audit-polish/specs/timer-visibility/spec.md
 * @see openspec/changes/chrome-audit-polish/design.md#2-timer-visibility
 */

import React from 'react';

interface TimerIndicatorProps {
  /**
   * Progress percentage (0-100) of STUCK timer.
   * 0% = just started, 100% = about to trigger AI intervention
   */
  progress: number;

  /**
   * Whether timer indicator should be visible.
   * Only true when mode === 'muse', false in Off/Loki modes.
   */
  visible: boolean;

  /**
   * Remaining time in seconds (for ARIA label).
   * Used by screen readers to announce timer state.
   */
  remainingTime: number;
}

/**
 * Timer progress indicator for Muse mode STUCK detection.
 *
 * Shows ambient awareness of 60s timer without distracting from writing.
 *
 * @example
 * ```tsx
 * <TimerIndicator
 *   progress={50}          // 50% complete (30s elapsed)
 *   visible={mode === 'muse'}
 *   remainingTime={30}     // 30s remaining
 * />
 * ```
 */
export function TimerIndicator({ progress, visible, remainingTime }: TimerIndicatorProps) {
  if (!visible) {
    return null;
  }

  return (
    <div
      className="timer-indicator"
      role="progressbar"
      aria-label={`STUCK timer: ${remainingTime} seconds remaining`}
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        width: `${progress}%`,
      }}
    />
  );
}
