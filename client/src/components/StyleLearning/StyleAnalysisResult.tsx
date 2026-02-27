/**
 * Style Analysis Result Component
 *
 * Displays style analysis results including style vector metrics
 * and confidence score with visual indicator.
 *
 * @module components/StyleLearning/StyleAnalysisResult
 */

import type { StyleAnalysisResponse, StyleVector } from "./types";
import "./StyleAnalysisResult.css";

/**
 * Props for the StyleAnalysisResult component.
 */
export interface StyleAnalysisResultProps {
  /** Style analysis result from API */
  result: StyleAnalysisResponse;
  /** Callback when Apply to Task button is clicked */
  onApplyClick?: () => void;
  /** Whether the Apply button should be disabled */
  isApplyDisabled?: boolean;
}

/**
 * Format a decimal value as percentage.
 *
 * @param value - Decimal value (0-1)
 * @returns Formatted percentage string
 */
function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Format a number with specified decimal places.
 *
 * @param value - Number to format
 * @param decimals - Number of decimal places
 * @returns Formatted number string
 */
function formatNumber(value: number, decimals: number = 1): string {
  return value.toFixed(decimals);
}

/**
 * Format ISO timestamp to readable date.
 *
 * @param isoString - ISO timestamp string
 * @returns Formatted date string
 */
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Metric item configuration.
 */
interface MetricConfig {
  key: keyof StyleVector;
  label: string;
  format: (value: number) => string;
}

/** Metric configurations for display */
const METRICS: MetricConfig[] = [
  { key: "avg_sentence_length", label: "Average Sentence Length", format: (v) => formatNumber(v) },
  { key: "vocab_richness", label: "Vocabulary Richness", format: formatPercent },
  { key: "punctuation_density", label: "Punctuation Density", format: formatPercent },
  { key: "paragraph_length_avg", label: "Paragraph Length", format: (v) => formatNumber(v) },
  { key: "dialogue_ratio", label: "Dialogue Ratio", format: formatPercent },
];

/**
 * Style Analysis Result Component
 *
 * Displays the results of style analysis including individual metrics
 * and an overall confidence score.
 *
 * @param props - Component props
 * @returns The rendered result component
 *
 * @example
 * ```tsx
 * <StyleAnalysisResult
 *   result={analysisResult}
 *   onApplyClick={() => applyStyle(currentText, userId)}
 *   isApplyDisabled={isApplying}
 * />
 * ```
 */
export function StyleAnalysisResult({
  result,
  onApplyClick,
  isApplyDisabled = false,
}: StyleAnalysisResultProps): JSX.Element {
  const { style_vector, confidence, analyzed_at } = result;

  return (
    <div className="style-analysis-result" data-testid="style-analysis-result">
      <h3 className="result-heading">Style Analysis</h3>

      <div className="metrics-grid">
        {METRICS.map((metric) => (
          <div key={metric.key} className="metric-item">
            <span className="metric-label">{metric.label}</span>
            <span className="metric-value">{metric.format(style_vector[metric.key])}</span>
          </div>
        ))}
      </div>

      <div className="confidence-section">
        <div className="confidence-header">
          <span className="confidence-label">Confidence</span>
          <span className="confidence-value">{formatPercent(confidence)}</span>
        </div>
        <div className="confidence-bar">
          <div
            className="confidence-bar-fill"
            style={{ width: formatPercent(confidence) }}
            aria-label={`${formatPercent(confidence)} confidence`}
          />
        </div>
      </div>

      <div className="metadata-section">
        <span className="analyzed-date">Analyzed: {formatDate(analyzed_at)}</span>
      </div>

      <button
        type="button"
        className="apply-button"
        onClick={onApplyClick}
        disabled={isApplyDisabled}
        aria-disabled={isApplyDisabled}
      >
        Apply to Task
      </button>
    </div>
  );
}
