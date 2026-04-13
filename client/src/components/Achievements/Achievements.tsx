import { useAchievements } from "../../hooks/useAchievements";

export function Achievements() {
  const { achievements, definitions } = useAchievements();

  if (achievements.isLoading || definitions.isLoading) {
    return <div className="achievements-loading">Loading achievements...</div>;
  }

  const earned = new Set((achievements.data?.achievements || []).map((a) => a.achievement_type));
  const defs = definitions.data?.achievements || [];

  return (
    <div className="achievements-panel">
      <h3>Achievements</h3>
      <div className="achievements-grid">
        {defs.map((def) => (
          <div
            key={def.achievement_type}
            className={`achievement-badge ${earned.has(def.achievement_type) ? "earned" : "locked"}`}
          >
            <span className="achievement-icon">{def.icon || "🏆"}</span>
            <span className="achievement-name">{def.name}</span>
            <span className="achievement-desc">{def.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
