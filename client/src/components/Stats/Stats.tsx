import { useStats } from "../../hooks/useStats";

export function Stats() {
  const { data: stats, isLoading, error } = useStats();

  if (isLoading) return <div className="stats-loading">Loading stats...</div>;
  if (error || !stats) return <div className="stats-error">Failed to load stats</div>;

  return (
    <div className="stats-panel">
      <h3>Writing Statistics</h3>
      <div className="stats-grid">
        <div className="stat-item">
          <span className="stat-value">{stats.total_tasks}</span>
          <span className="stat-label">Total Tasks</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.total_muse_interventions}</span>
          <span className="stat-label">Muse Interventions</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.total_loki_interventions}</span>
          <span className="stat-label">Loki Interventions</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.total_locks_created}</span>
          <span className="stat-label">Locks Created</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.writing_minutes}</span>
          <span className="stat-label">Minutes Written</span>
        </div>
      </div>
    </div>
  );
}
