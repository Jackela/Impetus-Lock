/**
 * Animation and timing configuration constants.
 *
 * Centralizes all animation durations, delays, and timing values
 * to ensure consistency across the application.
 *
 * @module config/animation
 */

/**
 * Default duration for sensory feedback animations (milliseconds)
 * Used for glitch effects, shake animations, etc.
 */
export const DEFAULT_FEEDBACK_DURATION_MS = 1500;

/**
 * Duration for manual trigger animations (milliseconds)
 * Used when user manually triggers AI actions
 */
export const MANUAL_ANIMATION_DURATION_MS = 1000;

/**
 * Duration for lock rejection feedback (milliseconds)
 * Shorter duration for error/rejection states
 */
export const REJECTION_FEEDBACK_DURATION_MS = 1000;

/**
 * Cooldown period between Loki triggers (milliseconds)
 * Prevents rapid-fire Loki interventions
 */
export const LOKI_COOLDOWN_MS = 4000;

/**
 * Delay before resetting delete operation flag (milliseconds)
 * Ensures all state updates complete before allowing new operations
 */
export const DELETE_RESET_DELAY_MS = 1500;

/**
 * Default z-index for floating UI elements
 * Positioned above editor content but below modals
 */
export const FLOATING_UI_Z_INDEX = 1000;

/**
 * Editor initialization retry interval (milliseconds)
 */
export const EDITOR_RETRY_INTERVAL_MS = 100;

/**
 * Maximum retry attempts for editor initialization
 */
export const EDITOR_MAX_RETRY_ATTEMPTS = 50;

/**
 * Muse mode STUCK detection timeout (milliseconds)
 * Time of inactivity before triggering STUCK state
 */
export const MUSE_STUCK_TIMEOUT_MS = 60000;

/**
 * Muse mode idle timeout (milliseconds)
 * Time before transitioning from WRITING to IDLE
 */
export const MUSE_IDLE_TIMEOUT_MS = 5000;

/**
 * Loki mode minimum trigger interval (milliseconds)
 */
export const LOKI_MIN_INTERVAL_MS = 30000;

/**
 * Loki mode maximum trigger interval (milliseconds)
 */
export const LOKI_MAX_INTERVAL_MS = 120000;

/**
 * Minimum document size for delete operations (characters)
 * Prevents deleting very short documents
 */
export const MIN_DOCUMENT_SIZE_FOR_DELETE = 50;

/**
 * Default delete percentage (0-1)
 * Percentage of document to delete in manual delete operation
 */
export const DEFAULT_DELETE_PERCENTAGE = 0.2;

/**
 * Maximum delete length (characters)
 * Upper limit for single delete operation
 */
export const MAX_DELETE_LENGTH = 200;

/**
 * Minimum delete length (characters)
 * Lower limit for single delete operation
 */
export const MIN_DELETE_LENGTH = 50;
