import { InterventionAPIError } from "../services/api/interventionClient";

export type { InterventionAPIError };

export function isInterventionAPIError(error: unknown): error is InterventionAPIError {
  return error instanceof InterventionAPIError;
}
