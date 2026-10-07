import { useOptionalAuth } from "../contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { fetchAchievements, fetchAchievementDefinitions } from "../services/api/achievementClient";

/**
 * Fetches earned achievements and their definitions via React Query.
 *
 * @returns Query results for earned achievements and achievement definitions
 */
export function useAchievements() {
  const auth = useOptionalAuth();
  const session = auth?.session;
  const enabled = auth === undefined || auth.remoteEnabled;
  const retry = auth
    ? (failures: number, error: Error): boolean =>
        error.name !== "AbortError" &&
        (!("status" in error) || ![401, 403].includes(Number(error.status))) &&
        failures < 2
    : undefined;
  const achievements = useQuery({
    queryKey: auth ? ["achievements", auth.user?.id ?? null, auth.generation] : ["achievements"],
    enabled,
    ...(auth ? { retry } : {}),
    queryFn: ({ signal }) => fetchAchievements(auth ? { session, signal } : undefined),
  });
  const definitions = useQuery({
    queryKey: auth
      ? ["achievement-definitions", auth.user?.id ?? null, auth.generation]
      : ["achievement-definitions"],
    enabled,
    ...(auth ? { retry } : {}),
    queryFn: ({ signal }) => fetchAchievementDefinitions(auth ? { session, signal } : undefined),
  });
  return { achievements, definitions };
}
