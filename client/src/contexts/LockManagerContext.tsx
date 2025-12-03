/**
 * LockManager React Context
 *
 * Provides the LockManager instance through React Context instead of a singleton.
 * This enables proper dependency injection and testability.
 *
 * Constitutional Compliance:
 * - Article I (Simplicity): React Context (no Redux/MobX)
 * - Article IV (DIP): Components depend on context abstraction, not singleton
 * - Article V (Documentation): Complete JSDoc
 *
 * @module contexts/LockManagerContext
 */

import React, { createContext, useContext, useMemo, type ReactNode } from "react";
import { LockManager } from "../services/LockManager";

/**
 * Context type containing the LockManager instance.
 */
interface LockManagerContextValue {
  lockManager: LockManager;
}

/**
 * React Context for LockManager instance.
 * Default value is undefined - must be used within LockManagerProvider.
 */
const LockManagerContext = createContext<LockManagerContextValue | undefined>(undefined);

/**
 * Props for LockManagerProvider component.
 */
interface LockManagerProviderProps {
  children: ReactNode;
  /**
   * Optional LockManager instance for testing.
   * If not provided, creates a new instance.
   */
  lockManager?: LockManager;
}

/**
 * Provider component that creates and provides a LockManager instance.
 *
 * Wrap your application (or editor subtree) with this provider to enable
 * lock management functionality via the `useLockManager` hook.
 *
 * @param props - Provider props
 * @returns Provider component wrapping children
 *
 * @example
 * ```typescript
 * // In App.tsx or root component:
 * function App() {
 *   return (
 *     <LockManagerProvider>
 *       <EditorCore />
 *     </LockManagerProvider>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // In tests with mock LockManager:
 * const mockLockManager = new LockManager();
 * mockLockManager.applyLock('test-lock', { source: 'muse' });
 *
 * render(
 *   <LockManagerProvider lockManager={mockLockManager}>
 *     <ComponentUnderTest />
 *   </LockManagerProvider>
 * );
 * ```
 */
export function LockManagerProvider({
  children,
  lockManager: providedLockManager,
}: LockManagerProviderProps): React.ReactElement {
  // Create single LockManager instance for the provider's lifetime
  const lockManager = useMemo(() => providedLockManager ?? new LockManager(), [providedLockManager]);

  const value = useMemo(() => ({ lockManager }), [lockManager]);

  return <LockManagerContext.Provider value={value}>{children}</LockManagerContext.Provider>;
}

/**
 * Hook to access the LockManager instance from context.
 *
 * Must be called within a LockManagerProvider. Throws if used outside provider.
 *
 * @returns LockManager instance from context
 * @throws Error if called outside LockManagerProvider
 *
 * @example
 * ```typescript
 * function EditorComponent() {
 *   const lockManager = useLockManager();
 *
 *   const handleIntervention = (lockId: string) => {
 *     lockManager.applyLock(lockId, { source: 'muse' });
 *   };
 *
 *   return <Editor onIntervention={handleIntervention} />;
 * }
 * ```
 */
export function useLockManager(): LockManager {
  const context = useContext(LockManagerContext);

  if (!context) {
    throw new Error("useLockManager must be used within a LockManagerProvider");
  }

  return context.lockManager;
}

/**
 * Hook to safely access LockManager, returning undefined if outside provider.
 *
 * Useful for optional lock functionality or graceful degradation.
 *
 * @returns LockManager instance or undefined if outside provider
 *
 * @example
 * ```typescript
 * function OptionalLockFeature() {
 *   const lockManager = useLockManagerSafe();
 *
 *   if (!lockManager) {
 *     return <div>Lock features unavailable</div>;
 *   }
 *
 *   return <LockDisplay locks={lockManager.getAllLocks()} />;
 * }
 * ```
 */
export function useLockManagerSafe(): LockManager | undefined {
  const context = useContext(LockManagerContext);
  return context?.lockManager;
}
