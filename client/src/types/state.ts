/**
 * Writing State Types
 *
 * State machine types for STUCK detection (Muse mode).
 * Matches data-model.md state machine specification.
 *
 * Constitutional Compliance:
 * - Article V (Documentation): Complete JSDoc for all exported types
 *
 * @module types/state
 */

/**
 * User writing state enum.
 *
 * State transitions:
 * - WRITING → IDLE (after 5s of no input)
 * - IDLE → STUCK (after 60s total of no input)
 * - STUCK → WRITING (on any keystroke)
 * - WRITING → WRITING (continuous typing)
 *
 * @example
 * ```typescript
 * let state: WritingState = 'WRITING';
 *
 * // After 5s no input
 * state = 'IDLE';
 *
 * // After 60s total no input
 * state = 'STUCK'; // Triggers Muse intervention
 *
 * // On keystroke
 * state = 'WRITING';
 * ```
 */
export type WritingState =
  /**
   * User is actively typing (last keystroke <5s ago).
   */
  | "WRITING"

  /**
   * User paused typing (5-60s since last keystroke).
   */
  | "IDLE"

  /**
   * User stuck (>60s since last keystroke).
   * Triggers Muse mode intervention.
   */
  | "STUCK";

/**
 * State machine events that trigger transitions.
 *
 * @example
 * ```typescript
 * type WritingEvent = 'KEYSTROKE' | 'TIMEOUT_IDLE' | 'TIMEOUT_STUCK';
 *
 * const transitions: Record<WritingState, Record<WritingEvent, WritingState>> = {
 *   WRITING: {
 *     KEYSTROKE: 'WRITING',
 *     TIMEOUT_IDLE: 'IDLE',
 *   },
 *   IDLE: {
 *     KEYSTROKE: 'WRITING',
 *     TIMEOUT_STUCK: 'STUCK',
 *   },
 *   STUCK: {
 *     KEYSTROKE: 'WRITING',
 *   }
 * };
 * ```
 */
export type WritingEvent =
  | "KEYSTROKE" // User typed a character
  | "TIMEOUT_IDLE" // 5s elapsed since last keystroke
  | "TIMEOUT_STUCK"; // 60s elapsed since last keystroke

/**
 * Type guard to validate WritingState.
 *
 * @param state - Potential WritingState value
 * @returns True if state is valid
 */
export function isWritingState(state: unknown): state is WritingState {
  return ["WRITING", "IDLE", "STUCK"].includes(state);
}
