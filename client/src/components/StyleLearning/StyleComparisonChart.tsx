import type { StyleVector } from "./types";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { useRef, useCallback } from "react";
import html2canvas from "html2canvas";
import { createLogger } from "../../utils/logger";

const logger = createLogger("StyleComparisonChart");

interface StyleComparisonChartProps {
  vector1: StyleVector;
  vector2: StyleVector;
  label1?: string;
  label2?: string;
  text1?: string;
  text2?: string;
}

interface ChartDataPoint {
  metric: string;
  text1: number;
  text2: number;
}

function prepareChartData(vector1: StyleVector, vector2: StyleVector): ChartDataPoint[] {
  const metrics = [
    { key: "complexity", label: "Complexity" },
    { key: "emotion", label: "Emotion" },
    { key: "formality", label: "Formality" },
    { key: "descriptiveness", label: "Descriptiveness" },
    { key: "rhythm", label: "Rhythm" },
  ];

  return metrics.map(({ key, label }) => ({
    metric: label,
    text1: vector1[key as keyof StyleVector] as number,
    text2: vector2[key as keyof StyleVector] as number,
  }));
}

export function StyleComparisonChart({
  vector1,
  vector2,
  label1 = "Style 1",
  label2 = "Style 2",
  text1,
  text2,
}: StyleComparisonChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  const handleExport = useCallback(async () => {
    if (!chartRef.current) return;

    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });
      const link = document.createElement("a");
      link.download = "style-comparison-chart.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      logger.error("Failed to export chart", error);
    }
  }, []);

  const data = prepareChartData(vector1, vector2);

  const displayLabel1 = text1 || label1;
  const displayLabel2 = text2 || label2;

  const COLORS = {
    text1: "#8884d8",
    text2: "#82ca9d",
  };

  return (
    <div className="style-comparison-chart">
      <h4>Style Comparison</h4>
      <div ref={chartRef} style={{ width: "100%", height: 400 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
            <PolarGrid />
            <PolarAngleAxis dataKey="metric" />
            <PolarRadiusAxis angle={30} domain={[0, 1]} />
            <Radar
              name={displayLabel1}
              dataKey="text1"
              stroke={COLORS.text1}
              fill={COLORS.text1}
              fillOpacity={0.3}
            />
            <Radar
              name={displayLabel2}
              dataKey="text2"
              stroke={COLORS.text2}
              fill={COLORS.text2}
              fillOpacity={0.3}
            />
            <Tooltip
              formatter={(value: number) => value.toFixed(2)}
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <button
        onClick={handleExport}
        className="export-button"
        style={{
          marginTop: "1rem",
          padding: "0.5rem 1rem",
          backgroundColor: "#007bff",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        Export as PNG
      </button>
    </div>
  );
}
