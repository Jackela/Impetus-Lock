/**
 * Services module exports.
 *
 * Centralized exports for all services.
 */

export { LockManager, lockManager } from "./LockManager";
export type { LockMetadata } from "./LockManager";
export { generateIntervention, checkHealth, InterventionAPIError } from "./api/interventionClient";

// Re-export context for dependency injection (Article IV - DIP)
export {
  LockManagerProvider,
  useLockManager,
  useLockManagerSafe,
} from "../contexts/LockManagerContext";
