/**
 * Lock Block Types
 *
 * Type definitions for un-deletable text blocks with lock_id markers.
 * Matches data-model.md entity specification.
 *
 * Constitutional Compliance:
 * - Article V (Documentation): Complete JSDoc for all exported types
 *
 * @module types/lock
 */

import type { AgentMode } from "./mode";

/**
 * Un-deletable text block with unique lock_id identifier.
 *
 * Created by AI interventions (Muse or Loki mode).
 * Enforced as un-deletable through editor transaction filtering.
 *
 * @example
 * ```typescript
 * const block: LockBlock = {
 *   lock_id: "lock_01j4z3m8a6q3qz2x8j4z3m8a",
 *   content: "> [AI施压 - Muse]: 门后传来低沉的呼吸声。",
 *   source: "muse",
 *   created_at: Date.now(),
 *   is_deletable: false
 * };
 * ```
 */
export interface LockBlock {
  /**
   * Unique lock identifier (UUID v4 format).
   * Prefix: "lock_" for readability.
   */
  lock_id: string;

  /**
   * Markdown blockquote content.
   * Format: "> [AI施压 - {Mode}]: {content}"
   */
  content: string;

  /**
   * Agent mode that created this lock ("muse" or "loki").
   */
  source: AgentMode;

  /**
   * Creation timestamp (Unix milliseconds).
   */
  created_at: number;

  /**
   * Always false - lock blocks are un-deletable by definition.
   * Included for explicit type safety.
   */
  is_deletable: false;
}

/**
 * Type guard to check if a block is a LockBlock.
 *
 * @param block - Potential lock block object
 * @returns True if block has lock_id and is_deletable === false
 *
 * @example
 * ```typescript
 * if (isLockBlock(block)) {
 *   console.log('Cannot delete:', block.lock_id);
 * }
 * ```
 */
export function isLockBlock(block: unknown): block is LockBlock {
  return (
    typeof block === "object" &&
    block !== null &&
    typeof block.lock_id === "string" &&
    block.is_deletable === false
  );
}
