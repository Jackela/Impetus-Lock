/**
 * Services module exports.
 *
 * Centralized exports for all services.
 */

/** Re-export of the LockManager class and its default instance. */
export { LockManager, lockManager } from "./LockManager";
/** Re-export of the LockMetadata type. */
export type { LockMetadata } from "./LockManager";
/** Re-export of the intervention client's public API. */
export { generateIntervention, checkHealth, InterventionAPIError } from "./api/interventionClient";

// Re-export context for dependency injection (Article IV - DIP)
/** Re-export of the lock manager context providers and hooks. */
export {
  LockManagerProvider,
  useLockManager,
  useLockManagerSafe,
} from "../contexts/LockManagerContext";
