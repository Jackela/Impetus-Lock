/**
 * Achievement API Client
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface AchievementRecord {
  id: string;
  achievement_type: string;
  name: string;
  description: string;
  earned_at: string;
  metadata: Record<string, unknown> | null;
}

export interface AchievementDefinition {
  achievement_type: string;
  name: string;
  description: string;
  icon: string | null;
}

export class AchievementAPIError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "AchievementAPIError";
  }
}

export async function fetchAchievements(): Promise<{
  achievements: AchievementRecord[];
  total: number;
}> {
  const res = await fetch(`${API_BASE_URL}/achievements/`, { credentials: "include" });
  if (!res.ok) throw new AchievementAPIError(res.status, "Failed to fetch achievements");
  return res.json();
}

export async function fetchAchievementDefinitions(): Promise<{
  achievements: AchievementDefinition[];
}> {
  const res = await fetch(`${API_BASE_URL}/achievements/definitions`, { credentials: "include" });
  if (!res.ok) throw new AchievementAPIError(res.status, "Failed to fetch definitions");
  return res.json();
}
