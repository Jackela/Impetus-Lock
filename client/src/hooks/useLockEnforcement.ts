/**
 * useLockEnforcement Hook
 *
 * React hook for lock enforcement in editor components.
 * Provides lock state management and enforcement utilities.
 *
 * Constitutional Compliance:
 * - Article I (Simplicity): Uses React hooks (no Redux/MobX)
 * - Article IV (DIP): Uses context injection, not singleton
 * - Article V (Documentation): Complete JSDoc
 *
 * @module hooks/useLockEnforcement
 */

import { useState, useCallback } from "react";
import { useLockManager } from "../contexts/LockManagerContext";
import type { LockMetadata } from "../services/LockManager";

/**
 * Hook return type.
 */
interface UseLockEnforcementReturn {
  /**
   * Array of all active lock IDs.
   */
  locks: string[];

  /**
   * Total count of active locks.
   */
  lockCount: number;

  /**
   * Loading state for lock operations.
   */
  isLoading: boolean;

  /**
   * Error state for lock operations.
   */
  error: Error | null;

  /**
   * Apply a lock ID to the manager.
   */
  applyLock: (lockId: string, metadata?: LockMetadata) => void;

  /**
   * Remove a lock ID from the manager.
   */
  removeLock: (lockId: string) => void;

  /**
   * Check if a lock ID exists.
   */
  hasLock: (lockId: string) => boolean;

  /**
   * Extract locks from Markdown content.
   */
  extractLocks: (markdown: string) => string[];

  /**
   * Inject lock comment into content.
   */
  injectLockComment: (content: string, lockId: string, metadata?: LockMetadata) => string;

  /**
   * Clear error state.
   */
  clearError: () => void;
}

/**
 * React hook for lock enforcement.
 *
 * Provides reactive lock state management using the LockManager from context.
 * Re-renders component when locks change.
 *
 * Must be used within a LockManagerProvider.
 *
 * @returns Lock enforcement utilities and state
 *
 * @example
 * ```typescript
 * function Editor() {
 *   const { locks, applyLock, hasLock } = useLockEnforcement();
 *
 *   const handleAIIntervention = (response: InterventionResponse) => {
 *     if (response.action === 'provoke') {
 *       // Apply lock to injected content
 *       applyLock(response.lock_id);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <p>Active locks: {locks.length}</p>
 *       <Editor onIntervention={handleAIIntervention} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useLockEnforcement(): UseLockEnforcementReturn {
  const lockManager = useLockManager();
  const [lockCount, setLockCount] = useState(lockManager.getLockCount());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateLockCount = useCallback(() => {
    setLockCount(lockManager.getLockCount());
  }, [lockManager]);

  const applyLock = useCallback(
    (lockId: string, metadata?: LockMetadata) => {
      try {
        setIsLoading(true);
        setError(null);
        lockManager.applyLock(lockId, metadata);
        updateLockCount();
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    },
    [lockManager, updateLockCount]
  );

  const removeLock = useCallback(
    (lockId: string) => {
      try {
        setIsLoading(true);
        setError(null);
        lockManager.removeLock(lockId);
        updateLockCount();
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    },
    [lockManager, updateLockCount]
  );

  const hasLock = useCallback(
    (lockId: string) => {
      return lockManager.hasLock(lockId);
    },
    [lockManager]
  );

  const extractLocks = useCallback(
    (markdown: string) => {
      try {
        setError(null);
        return lockManager.extractLocksFromMarkdown(markdown);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        return [];
      }
    },
    [lockManager]
  );

  const injectLockComment = useCallback(
    (content: string, lockId: string, metadata?: LockMetadata) => {
      try {
        setError(null);
        return lockManager.injectLockComment(content, lockId, metadata);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        return content;
      }
    },
    [lockManager]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const locks = lockManager.getAllLocks();

  return {
    locks,
    lockCount,
    isLoading,
    error,
    applyLock,
    removeLock,
    hasLock,
    extractLocks,
    injectLockComment,
    clearError,
  };
}
