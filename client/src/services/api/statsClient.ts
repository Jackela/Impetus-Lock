/**
 * Stats API Client
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface StatsRecord {
  total_tasks: number;
  total_muse_interventions: number;
  total_loki_interventions: number;
  total_locks_created: number;
  writing_minutes: number;
  last_activity_at: string | null;
}

export interface InterventionBreakdown {
  muse_count: number;
  loki_count: number;
}

export class StatsAPIError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "StatsAPIError";
  }
}

export async function fetchStats(): Promise<StatsRecord> {
  const res = await fetch(`${API_BASE_URL}/stats/`, { credentials: "include" });
  if (!res.ok) throw new StatsAPIError(res.status, "Failed to fetch stats");
  return res.json();
}

export async function fetchInterventionBreakdown(): Promise<InterventionBreakdown> {
  const res = await fetch(`${API_BASE_URL}/stats/breakdown`, { credentials: "include" });
  if (!res.ok) throw new StatsAPIError(res.status, "Failed to fetch breakdown");
  return res.json();
}
