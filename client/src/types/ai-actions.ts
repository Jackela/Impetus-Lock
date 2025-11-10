/**
 * AI action types for Impetus Lock intervention system.
 *
 * These actions represent different AI behaviors based on the current mode:
 * - PROVOKE: Injects provocative content in Muse mode to overcome writer's block
 * - REWRITE: Replaces inline spans using anchors from the agent
 * - DELETE: Deletes user-selected text in Loki mode as punishment
 * - REJECT: Prevents deletion of locked content (lock enforcement)
 * - ERROR: API failure error feedback (P3 US3)
 *
 * @see {@link ../config/sensory-feedback.ts} for action-specific feedback configuration
 */
export enum AIActionType {
  /** Muse mode: Inject provocative content to help overcome writer's block */
  PROVOKE = "provoke",

  /** Muse/Loki mode: Replace inline spans with locked rewrites */
  REWRITE = "rewrite",

  /** Loki mode: Delete user-selected text as punishment */
  DELETE = "delete",

  /** Lock enforcement: Prevent deletion of locked content */
  REJECT = "reject",

  /** API failure: Display error feedback when AI actions fail (P3 US3) */
  ERROR = "error",
}
