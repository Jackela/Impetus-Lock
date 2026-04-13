import { useQuery } from "@tanstack/react-query";
import { fetchStats } from "../services/api/statsClient";

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
  });
}
