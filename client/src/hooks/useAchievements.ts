import { useQuery } from "@tanstack/react-query";
import { fetchAchievements, fetchAchievementDefinitions } from "../services/api/achievementClient";

/**
 * Fetches earned achievements and their definitions via React Query.
 *
 * @returns Query results for earned achievements and achievement definitions
 */
export function useAchievements() {
  const achievements = useQuery({
    queryKey: ["achievements"],
    queryFn: fetchAchievements,
  });
  const definitions = useQuery({
    queryKey: ["achievement-definitions"],
    queryFn: fetchAchievementDefinitions,
  });
  return { achievements, definitions };
}
