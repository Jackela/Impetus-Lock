import type { StyleVector } from "./types";

interface StyleComparisonChartProps {
  vector1: StyleVector;
  vector2: StyleVector;
  label1?: string;
  label2?: string;
}

export function StyleComparisonChart({
  vector1,
  vector2,
  label1 = "Style 1",
  label2 = "Style 2",
}: StyleComparisonChartProps) {
  const commonKeys = Object.keys(vector1).filter((k) => k in vector2);

  const maxValue = Math.max(...commonKeys.map((k) => Math.max(vector1[k] || 0, vector2[k] || 0)));

  return (
    <div className="style-comparison-chart">
      <h4>Style Comparison</h4>
      <div className="comparison-grid">
        {commonKeys.map((key) => (
          <div key={key} className="comparison-row">
            <div className="comparison-label">{key}</div>
            <div className="comparison-bars">
              <div className="bar-container">
                <div
                  className="bar bar-1"
                  style={{ width: `${((vector1[key] || 0) / maxValue) * 100}%` }}
                />
                <span className="bar-value">{vector1[key]?.toFixed(2)}</span>
              </div>
              <div className="bar-container">
                <div
                  className="bar bar-2"
                  style={{ width: `${((vector2[key] || 0) / maxValue) * 100}%` }}
                />
                <span className="bar-value">{vector2[key]?.toFixed(2)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="legend">
        <span className="legend-item">
          <span className="legend-color bar-1" /> {label1}
        </span>
        <span className="legend-item">
          <span className="legend-color bar-2" /> {label2}
        </span>
      </div>
    </div>
  );
}
