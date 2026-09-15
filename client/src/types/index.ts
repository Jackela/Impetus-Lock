/**
 * Types module exports.
 *
 * Centralized exports for all TypeScript types.
 */

/** Re-export of the LockBlock type. */
export type { LockBlock } from "./lock";
/** Re-export of the isLockBlock type guard. */
export { isLockBlock } from "./lock";

/** Re-export of the writing state and event types. */
export type { WritingState, WritingEvent } from "./state";
/** Re-export of the isWritingState type guard. */
export { isWritingState } from "./state";

/** Re-export of the AgentMode type. */
export type { AgentMode } from "./mode";
/** Re-export of the isAgentMode type guard and agent mode metadata. */
export { isAgentMode, AGENT_MODE_META } from "./mode";

// Re-export API types from generated file
/** Re-export of the generated OpenAPI component schemas. */
export type { components } from "./api.generated";

// Error types
/** Re-export of the application error classes and helpers. */
export {
  AppError,
  APIError,
  NetworkError,
  ValidationError,
  EditorError,
  LockError,
  isAppError,
  isAPIError,
  getErrorMessage,
  getErrorCode,
} from "./errors";
