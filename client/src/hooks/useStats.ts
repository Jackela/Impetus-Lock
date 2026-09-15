import { useQuery } from "@tanstack/react-query";
import { fetchStats } from "../services/api/statsClient";

/**
 * Fetches aggregate writing statistics via React Query.
 *
 * @returns The stats query result
 */
export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
  });
}
