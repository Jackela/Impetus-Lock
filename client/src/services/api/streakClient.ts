/**
 * Streak API Client
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/** Streak state for the current user. */
export interface StreakRecord {
  current_streak_days: number;
  longest_streak_days: number;
  streak_start_date: string | null;
  last_activity_date: string | null;
  grace_used: boolean;
}

/** Error thrown when a streak API request fails. */
export class StreakAPIError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "StreakAPIError";
  }
}

/**
 * Fetch the current user's streak state.
 *
 * @returns The streak record
 */
export async function fetchStreak(): Promise<StreakRecord> {
  const res = await fetch(`${API_BASE_URL}/streaks/`, { credentials: "include" });
  if (!res.ok) throw new StreakAPIError(res.status, "Failed to fetch streak");
  return res.json();
}

/**
 * Record today's writing activity and refresh the streak.
 *
 * @returns The updated streak record
 */
export async function updateStreak(): Promise<StreakRecord> {
  const res = await fetch(`${API_BASE_URL}/streaks/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new StreakAPIError(res.status, "Failed to update streak");
  return res.json();
}
