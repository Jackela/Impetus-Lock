/**
 * LockManager - Lock State Management
 *
 * Manages un-deletable lock IDs for AI-injected content blocks.
 * Provides lock persistence via Markdown comments and lock state tracking.
 *
 * Constitutional Compliance:
 * - Article I (Simplicity): In-memory Set for P1 (no Redux/Zustand)
 * - Article IV (SOLID): SRP - Handles only lock state, not editor operations
 * - Article V (Documentation): Complete JSDoc for all public methods
 *
 * @module services/LockManager
 */

/**
 * Lock state manager for un-deletable content blocks.
 *
 * Maintains a Set of active lock IDs and provides utilities for:
 * - Adding/removing locks
 * - Checking lock existence
 * - Extracting locks from Markdown comments
 * - Persisting locks across page refreshes
 *
 * @example
 * ```typescript
 * const manager = new LockManager();
 *
 * // Apply lock from AI intervention
 * manager.applyLock('lock_01j4z3m8a6q3qz2x8j4z3m8a');
 *
 * // Check if position has lock
 * if (manager.hasLock('lock_01j4z3m8a6q3qz2x8j4z3m8a')) {
 *   console.log('Block is locked - prevent deletion');
 * }
 *
 * // Extract locks from Markdown on page load
 * const markdown = '> Content <!-- lock:lock_001 -->';
 * const locks = manager.extractLocksFromMarkdown(markdown);
 * locks.forEach(id => manager.applyLock(id));
 * ```
 */
export class LockManager {
  /**
   * Set of active lock IDs (UUID strings).
   * Uses Set for O(1) lookup performance.
   */
  private locks: Set<string> = new Set();

  /**
   * Apply a lock ID to the active set.
   *
   * Idempotent operation - applying same lock twice is safe.
   *
   * @param lockId - Lock identifier (UUID v4 format, e.g., "lock_01j4z3...")
   *
   * @example
   * ```typescript
   * manager.applyLock('lock_001');
   * manager.applyLock('lock_001'); // Safe - no duplicate
   * console.log(manager.getLockCount()); // 1
   * ```
   */
  applyLock(lockId: string): void {
    this.locks.add(lockId);
  }

  /**
   * Remove a lock ID from the active set.
   *
   * Note: In P1, locks are un-deletable, so this is primarily for:
   * - Testing purposes
   * - Future admin override functionality
   * - Revert token mechanism
   *
   * @param lockId - Lock identifier to remove
   *
   * @example
   * ```typescript
   * manager.removeLock('lock_001');
   * console.log(manager.hasLock('lock_001')); // false
   * ```
   */
  removeLock(lockId: string): void {
    this.locks.delete(lockId);
  }

  /**
   * Check if a lock ID exists in the active set.
   *
   * Used by transaction filter to determine if content is locked.
   *
   * @param lockId - Lock identifier to check
   * @returns True if lock exists, false otherwise
   *
   * @example
   * ```typescript
   * if (manager.hasLock('lock_001')) {
   *   // Block deletion attempt
   * }
   * ```
   */
  hasLock(lockId: string): boolean {
    return this.locks.has(lockId);
  }

  /**
   * Get total count of active locks.
   *
   * @returns Number of locks in the set
   *
   * @example
   * ```typescript
   * console.log(`Active locks: ${manager.getLockCount()}`);
   * ```
   */
  getLockCount(): number {
    return this.locks.size;
  }

  /**
   * Get all lock IDs as an array.
   *
   * @returns Array of lock ID strings
   *
   * @example
   * ```typescript
   * const allLocks = manager.getAllLocks();
   * console.log('Locks:', allLocks);
   * // ['lock_001', 'lock_002', 'lock_003']
   * ```
   */
  getAllLocks(): string[] {
    return Array.from(this.locks);
  }

  /**
   * Extract lock IDs from Markdown comments.
   *
   * Parses HTML comments in format: `<!-- lock:lock_id -->`
   * Used for persistence - locks survive page refresh by being embedded in Markdown.
   *
   * @param markdown - Markdown content to parse
   * @returns Array of extracted lock IDs
   *
   * @example
   * ```typescript
   * const markdown = `
   * > [AI施压]: Content 1 <!-- lock:lock_001 -->
   *
   * Normal text.
   *
   * > [AI施压]: Content 2 <!-- lock:lock_002 -->
   * `;
   *
   * const locks = manager.extractLocksFromMarkdown(markdown);
   * console.log(locks); // ['lock_001', 'lock_002']
   *
   * // Apply extracted locks
   * locks.forEach(id => manager.applyLock(id));
   * ```
   */
  extractLocksFromMarkdown(markdown: string): string[] {
    // Regex pattern: <!-- lock:lock_id -->
    // Matches: lock:, followed by non-whitespace characters, before -->
    const lockPattern = /<!--\s*lock:(\S+)\s*-->/g;
    const locks: string[] = [];

    let match: RegExpExecArray | null;
    while ((match = lockPattern.exec(markdown)) !== null) {
      const lockId = match[1];
      // Validate lock_id format (non-empty string)
      if (lockId && lockId.length > 0) {
        locks.push(lockId);
      }
    }

    return locks;
  }

  /**
   * Clear all locks from the set.
   *
   * Primarily for testing. In production, locks should persist.
   *
   * @example
   * ```typescript
   * manager.clear();
   * console.log(manager.getLockCount()); // 0
   * ```
   */
  clear(): void {
    this.locks.clear();
  }

  /**
   * Inject lock comment into Markdown content.
   *
   * Helper method to append lock comment to content.
   * Used when AI intervention adds locked content.
   *
   * @param content - Markdown content (e.g., blockquote)
   * @param lockId - Lock ID to inject
   * @returns Content with lock comment appended
   *
   * @example
   * ```typescript
   * const content = '> [AI施压 - Muse]: 门后传来低沉的呼吸声。';
   * const withLock = manager.injectLockComment(content, 'lock_001');
   * console.log(withLock);
   * // '> [AI施压 - Muse]: 门后传来低沉的呼吸声。 <!-- lock:lock_001 -->'
   * ```
   */
  injectLockComment(content: string, lockId: string): string {
    return `${content} <!-- lock:${lockId} -->`;
  }
}

/**
 * Singleton instance for global access.
 *
 * In P1, use a single global instance for simplicity.
 * Future: Consider React Context or dependency injection.
 */
export const lockManager = new LockManager();
