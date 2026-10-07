import { useOptionalAuth } from "../contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { fetchStats } from "../services/api/statsClient";

/**
 * Fetches aggregate writing statistics via React Query.
 *
 * @returns The stats query result
 */
export function useStats() {
  const auth = useOptionalAuth();
  const session = auth?.session;
  const enabled = auth === undefined || auth.remoteEnabled;
  const retry = auth
    ? (failures: number, error: Error): boolean =>
        error.name !== "AbortError" &&
        (!("status" in error) || ![401, 403].includes(Number(error.status))) &&
        failures < 2
    : undefined;
  return useQuery({
    queryKey: auth ? ["stats", auth.user?.id ?? null, auth.generation] : ["stats"],
    enabled,
    ...(auth ? { retry } : {}),
    queryFn: ({ signal }) => fetchStats(auth ? { session, signal } : undefined),
  });
}
