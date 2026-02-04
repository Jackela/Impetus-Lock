/**
 * Intervention API Error Utilities
 *
 * Type guard and error re-exports for intervention API errors.
 *
 * @module hooks/useInterventionApiError
 */

import { InterventionAPIError } from "../services/api/interventionClient";

export type { InterventionAPIError };

/**
 * Type guard for InterventionAPIError.
 *
 * Checks if an unknown error is an instance of InterventionAPIError.
 * Useful for error handling in try-catch blocks.
 *
 * @param error - Unknown error to check
 * @returns True if error is InterventionAPIError
 *
 * @example
 * ```ts
 * try {
 *   await generateIntervention(request);
 * } catch (error) {
 *   if (isInterventionAPIError(error)) {
 *     console.error(`API error ${error.status}: ${error.message}`);
 *   } else {
 *     console.error('Unknown error:', error);
 *   }
 * }
 * ```
 */
export function isInterventionAPIError(error: unknown): error is InterventionAPIError {
  return error instanceof InterventionAPIError;
}
