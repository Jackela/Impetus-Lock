import { useQuery } from "@tanstack/react-query";
import { fetchAchievements, fetchAchievementDefinitions } from "../services/api/achievementClient";

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
