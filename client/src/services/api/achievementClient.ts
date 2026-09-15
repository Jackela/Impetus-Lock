/**
 * Achievement API Client
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/** An achievement earned by the user. */
export interface AchievementRecord {
  id: string;
  achievement_type: string;
  name: string;
  description: string;
  earned_at: string;
  metadata: Record<string, unknown> | null;
}

/** An achievement definition describing an earnable achievement. */
export interface AchievementDefinition {
  achievement_type: string;
  name: string;
  description: string;
  icon: string | null;
}

/** Error thrown when an achievements API request fails. */
export class AchievementAPIError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "AchievementAPIError";
  }
}

/**
 * Fetch all achievements earned by the current user.
 *
 * @returns The earned achievement records and total count
 */
export async function fetchAchievements(): Promise<{
  achievements: AchievementRecord[];
  total: number;
}> {
  const res = await fetch(`${API_BASE_URL}/achievements/`, { credentials: "include" });
  if (!res.ok) throw new AchievementAPIError(res.status, "Failed to fetch achievements");
  return res.json();
}

/**
 * Fetch all achievement definitions available to earn.
 *
 * @returns The achievement definitions
 */
export async function fetchAchievementDefinitions(): Promise<{
  achievements: AchievementDefinition[];
}> {
  const res = await fetch(`${API_BASE_URL}/achievements/definitions`, { credentials: "include" });
  if (!res.ok) throw new AchievementAPIError(res.status, "Failed to fetch definitions");
  return res.json();
}
