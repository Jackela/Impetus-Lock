import { cookieAuthOptions } from "./cookieAuth";
import { assertCurrentSession, sessionFetch, type RemoteRequestOptions } from "./remoteSession";

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
  /** HTTP status code. */
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "AchievementAPIError";
  }
}

/**
 * Fetch all achievements earned by the current user.
 *
 * @param options - Query cancellation and captured account authorization
 * @returns The earned achievement records and total count
 */
export async function fetchAchievements(options?: RemoteRequestOptions): Promise<{
  achievements: AchievementRecord[];
  total: number;
}> {
  const res = await sessionFetch(
    `${API_BASE_URL}/achievements/`,
    cookieAuthOptions({ credentials: "include" }),
    options
  );
  if (!res.ok) throw new AchievementAPIError(res.status, "Failed to fetch achievements");
  const data = await res.json();
  assertCurrentSession(options?.session);
  return data;
}

/**
 * Fetch all achievement definitions available to earn.
 *
 * @param options - Query cancellation and captured account authorization
 * @returns The achievement definitions
 */
export async function fetchAchievementDefinitions(options?: RemoteRequestOptions): Promise<{
  achievements: AchievementDefinition[];
}> {
  const res = await sessionFetch(
    `${API_BASE_URL}/achievements/definitions`,
    cookieAuthOptions({ credentials: "include" }),
    options
  );
  if (!res.ok) throw new AchievementAPIError(res.status, "Failed to fetch definitions");
  const data = await res.json();
  assertCurrentSession(options?.session);
  return data;
}
