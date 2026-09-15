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
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "StatsAPIError";
  }
}

/**
 * Fetch aggregate writing statistics for the current user.
 *
 * @returns The stats record
 */
export async function fetchStats(): Promise<StatsRecord> {
  const res = await fetch(`${API_BASE_URL}/stats/`, { credentials: "include" });
  if (!res.ok) throw new StatsAPIError(res.status, "Failed to fetch stats");
  return res.json();
}

/**
 * Fetch the Muse vs Loki intervention breakdown.
 *
 * @returns The intervention count breakdown
 */
export async function fetchInterventionBreakdown(): Promise<InterventionBreakdown> {
  const res = await fetch(`${API_BASE_URL}/stats/breakdown`, { credentials: "include" });
  if (!res.ok) throw new StatsAPIError(res.status, "Failed to fetch breakdown");
  return res.json();
}
