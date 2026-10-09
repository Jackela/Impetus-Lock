import { cookieAuthOptions } from "./cookieAuth";
import { assertCurrentSession, sessionFetch, type RemoteRequestOptions } from "./remoteSession";

/**
 * Stats API Client
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/** Aggregate writing statistics for the current user. */
export interface StatsRecord {
  total_tasks: number;
  total_muse_interventions: number;
  total_loki_interventions: number;
  total_locks_created: number;
  writing_minutes: number;
  last_activity_at: string | null;
}

/** Muse vs Loki intervention counts. */
export interface InterventionBreakdown {
  muse_count: number;
  loki_count: number;
}

/** Error thrown when a stats API request fails. */
export class StatsAPIError extends Error {
  /** HTTP status code. */
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "StatsAPIError";
  }
}

/**
 * Fetch aggregate writing statistics for the current user.
 *
 * @param options - Query cancellation and captured account authorization
 * @returns The stats record
 */
export async function fetchStats(options?: RemoteRequestOptions): Promise<StatsRecord> {
  const res = await sessionFetch(
    `${API_BASE_URL}/stats/`,
    cookieAuthOptions({ credentials: "include" }),
    options
  );
  if (!res.ok) throw new StatsAPIError(res.status, "Failed to fetch stats");
  const data = await res.json();
  assertCurrentSession(options?.session);
  return data;
}

/**
 * Fetch the Muse vs Loki intervention breakdown.
 *
 * @param options - Query cancellation and captured account authorization
 * @returns The intervention count breakdown
 */
export async function fetchInterventionBreakdown(
  options?: RemoteRequestOptions
): Promise<InterventionBreakdown> {
  const res = await sessionFetch(
    `${API_BASE_URL}/stats/breakdown`,
    cookieAuthOptions({ credentials: "include" }),
    options
  );
  if (!res.ok) throw new StatsAPIError(res.status, "Failed to fetch breakdown");
  const data = await res.json();
  assertCurrentSession(options?.session);
  return data;
}
