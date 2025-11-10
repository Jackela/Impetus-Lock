/**
 * LockManager - Lock State Management
 *
 * Manages un-deletable lock IDs for AI-injected content blocks.
 * Provides lock persistence via Markdown comments and lock state tracking.
 *
 * Constitutional Compliance:
 * - Article I (Simplicity): In-memory Map for metadata (no Redux/Zustand)
 * - Article IV (SOLID): SRP - Handles only lock state, not editor operations
 * - Article V (Documentation): Complete JSDoc for all public methods
 *
 * @module services/LockManager
 */

import type { AgentSource } from "../types/mode";

/**
 * Metadata associated with a lock ID.
 */
export interface LockMetadata {
  /** Agent source responsible for the lock (Muse/Loki) */
  source?: AgentSource;
  shape?: "inline" | "block";
}

/**
 * Lock state manager for un-deletable content blocks.
 *
 * Maintains metadata for each lock ID and provides utilities for:
 * - Adding/removing locks
 * - Checking lock existence
 * - Extracting locks (and sources) from Markdown comments
 * - Persisting locks across page refreshes
 *
 * @example
 * ```typescript
 * const manager = new LockManager();
 *
 * // Apply lock from AI intervention
 * manager.applyLock('lock_01j4z3m8a6q3qz2x8j4z3m8a', { source: 'muse' });
 *
 * // Check if position has lock
 * if (manager.hasLock('lock_01j4z3m8a6q3qz2x8j4z3m8a')) {
 *   console.log('Block is locked - prevent deletion');
 * }
 *
 * // Extract locks from Markdown on page load
 * const markdown = '> Content <!-- lock:lock_001 source:muse -->';
 * const locks = manager.extractLockEntriesFromMarkdown(markdown);
 * locks.forEach(({ lockId, source }) => manager.applyLock(lockId, { source }));
 * ```
 */
export class LockManager {
  /**
   * Map of active lock IDs with metadata.
   * Provides O(1) lookup and easy metadata enrichment.
   */
  private locks: Map<string, LockMetadata> = new Map();

  /**
   * Apply a lock ID to the active set.
   *
   * Idempotent operation - applying same lock twice merges metadata.
   *
   * @param lockId - Lock identifier (UUID v4 format, e.g., "lock_01j4z3...")
   * @param metadata - Optional metadata (agent source, etc.)
   *
   * @example
   * ```typescript
   * manager.applyLock('lock_001', { source: 'muse' });
   * manager.applyLock('lock_001', { source: 'muse' }); // Safe - merges metadata
   * console.log(manager.getLockCount()); // 1
   * ```
   */
  applyLock(lockId: string, metadata: LockMetadata = {}): void {
    const existing = this.locks.get(lockId) || {};
    this.locks.set(lockId, { ...existing, ...metadata });
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
    return Array.from(this.locks.keys());
  }

  /**
   * Retrieve metadata for a given lock.
   *
   * @param lockId - Lock identifier
   * @returns Stored metadata or undefined
   */
  getLockMetadata(lockId: string): LockMetadata | undefined {
    return this.locks.get(lockId);
  }

  /**
   * Convenience helper to read only the source metadata.
   */
  getLockSource(lockId: string): AgentSource | undefined {
    return this.locks.get(lockId)?.source;
  }

  /**
   * Extract lock IDs (and optional metadata) from Markdown comments.
   *
   * Parses HTML comments in format: `<!-- lock:lock_id [source:muse] -->`
   * Used for persistence - locks survive page refresh by being embedded in Markdown.
   *
   * @param markdown - Markdown content to parse
   * @returns Array of extracted lock IDs
   *
   * @example
   * ```typescript
   * const markdown = `
   * > Content 1 <!-- lock:lock_001 source:muse -->
   *
   * > Content 2 <!-- lock:lock_002 source:loki -->
   * `;
   *
   * const locks = manager.extractLocksFromMarkdown(markdown);
   * console.log(locks); // ['lock_001', 'lock_002']
   * ```
   */
  extractLocksFromMarkdown(markdown: string): string[] {
    return this.extractLockEntriesFromMarkdown(markdown).map((entry) => entry.lockId);
  }

  /**
   * Extract lock entries (ID + metadata) from Markdown content.
   *
   * @param markdown - Markdown content to parse
   * @returns Array of entries with lockId and optional metadata
   */
  extractLockEntriesFromMarkdown(
    markdown: string
  ): Array<{ lockId: string; source?: AgentSource }> {
    // Regex pattern: <!-- lock:lock_id [source:muse] -->
    const lockPattern = /<!--\s*lock:([^\s>]+)(?:\s+source:([^\s>]+))?\s*-->/gi;
    const entries: Array<{ lockId: string; source?: AgentSource }> = [];

    let match: RegExpExecArray | null;
    while ((match = lockPattern.exec(markdown)) !== null) {
      const lockId = match[1];
      const sourceRaw = match[2]?.toLowerCase();
      const source =
        sourceRaw === "muse" || sourceRaw === "loki" ? (sourceRaw as AgentSource) : undefined;

      if (lockId && lockId.length > 0) {
        entries.push({ lockId, source });
      }
    }

    return entries;
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
   * const content = '> Muse intervention';
   * const withLock = manager.injectLockComment(content, 'lock_001', { source: 'muse' });
   * console.log(withLock);
   * // '> Muse intervention <!-- lock:lock_001 source:muse -->'
   * ```
   */
  injectLockComment(content: string, lockId: string, metadata: LockMetadata = {}): string {
    const parts = [`lock:${lockId}`];
    if (metadata.source) {
      parts.push(`source:${metadata.source}`);
    }
    return `${content} <!-- ${parts.join(" ")} -->`;
  }
}

/**
 * Singleton instance for global access.
 *
 * In P1, use a single global instance for simplicity.
 * Future: Consider React Context or dependency injection.
 */
export const lockManager = new LockManager();
