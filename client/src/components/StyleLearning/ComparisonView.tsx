import { useCallback, useRef } from "react";
import type { StyleHistoryRecord } from "../../services/api/styleHistoryClient";
import { StyleComparisonChart } from "./StyleComparisonChart";
import { useStyleComparison } from "../../hooks/useStyleComparison";
import styles from "./ComparisonView.module.css";

interface ComparisonViewProps {
  historyItems: StyleHistoryRecord[];
}

export function ComparisonView({ historyItems }: ComparisonViewProps) {
  const {
    firstStyle,
    secondStyle,
    comparisonResult,
    loading,
    error,
    selectFirstStyle,
    selectSecondStyle,
    performComparison,
  } = useStyleComparison();
  const chartRef = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback(
    (record: StyleHistoryRecord) => {
      if (firstStyle?.id === record.id) {
        selectFirstStyle({ ...record, id: "" } as StyleHistoryRecord);
      } else if (secondStyle?.id === record.id) {
        selectSecondStyle({ ...record, id: "" } as StyleHistoryRecord);
      } else if (!firstStyle || !firstStyle.id) {
        selectFirstStyle(record);
      } else if (!secondStyle || !secondStyle.id) {
        selectSecondStyle(record);
      } else {
        selectSecondStyle(record);
      }
    },
    [firstStyle, secondStyle, selectFirstStyle, selectSecondStyle]
  );

  const handleCompare = useCallback(async () => {
    await performComparison();
  }, [performComparison]);

  const handleExport = useCallback(() => {
    if (!chartRef.current) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 600;

    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const svgElement = chartRef.current.querySelector("svg");
    if (svgElement) {
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const img = new Image();
      const svgBlob = new Blob([svgData], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        ctx.drawImage(img, 50, 50, 700, 450);

        ctx.fillStyle = "#e5e5e5";
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Style Comparison", canvas.width / 2, 30);

        const link = document.createElement("a");
        link.download = `style-comparison-${Date.now()}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();

        URL.revokeObjectURL(url);
      };

      img.src = url;
    }
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isItemSelected = (id: string) => firstStyle?.id === id || secondStyle?.id === id;

  const selectedCount = [firstStyle, secondStyle].filter((s) => s && s.id).length;

  const canCompare = firstStyle?.id && secondStyle?.id && !loading;

  const hasResult = firstStyle?.id && secondStyle?.id;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Compare Styles</h3>
        <span className={styles.subtitle}>
          Select two items to compare their style characteristics
        </span>
      </div>

      <div className={styles.selectionPanel}>
        <div className={styles.selectionHeader}>
          <span className={styles.selectionTitle}>Select Items to Compare</span>
          <div className={styles.selectedCount}>{selectedCount} / 2 selected</div>
        </div>

        <div className={styles.itemList}>
          {historyItems.length === 0 ? (
            <div className={styles.empty}>No history items available</div>
          ) : (
            historyItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${styles.itemButton} ${isItemSelected(item.id) ? styles.selected : ""}`}
                onClick={() => handleSelect(item)}
              >
                <div className={styles.itemDate}>{formatDate(item.created_at)}</div>
                <div className={styles.itemPreview}>
                  {item.text.substring(0, 100)}
                  {item.text.length > 100 ? "..." : ""}
                </div>
              </button>
            ))
          )}
        </div>

        <button
          type="button"
          className={styles.compareButton}
          onClick={handleCompare}
          disabled={!canCompare}
        >
          {loading ? "Loading..." : "Compare Selected"}
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {hasResult && (
        <div className={styles.comparisonResult}>
          <div className={styles.textComparison}>
            <div className={styles.textColumn}>
              <h4>Item 1</h4>
              <div className={styles.dateLabel}>{formatDate(firstStyle!.created_at)}</div>
              <div className={styles.textContent}>{firstStyle!.text}</div>
            </div>
            <div className={styles.textColumn}>
              <h4>Item 2</h4>
              <div className={styles.dateLabel}>{formatDate(secondStyle!.created_at)}</div>
              <div className={styles.textContent}>{secondStyle!.text}</div>
            </div>
          </div>

          <div className={styles.chartSection} ref={chartRef}>
            <div className={styles.chartHeader}>
              <h4>Style Analysis Comparison</h4>
              <button type="button" className={styles.exportButton} onClick={handleExport}>
                Export as PNG
              </button>
            </div>
            <StyleComparisonChart
              vector1={firstStyle!.style_vector}
              vector2={secondStyle!.style_vector}
              label1={`Item 1 (${formatDate(firstStyle!.created_at)})`}
              label2={`Item 2 (${formatDate(secondStyle!.created_at)})`}
            />
          </div>

          {comparisonResult && (
            <div className={styles.metricsSection}>
              <h4>Comparison Metrics</h4>
              <div className={styles.metricsGrid}>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Similarity Score</span>
                  <span className={styles.metricValue}>
                    {(comparisonResult.similarity_score * 100).toFixed(1)}%
                  </span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Sentence Length Diff</span>
                  <span className={styles.metricValue}>
                    {comparisonResult.metric_differences.avg_sentence_length_diff.toFixed(2)}
                  </span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Vocabulary Diff</span>
                  <span className={styles.metricValue}>
                    {comparisonResult.metric_differences.vocab_richness_diff.toFixed(2)}
                  </span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Punctuation Diff</span>
                  <span className={styles.metricValue}>
                    {comparisonResult.metric_differences.punctuation_density_diff.toFixed(2)}
                  </span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Paragraph Diff</span>
                  <span className={styles.metricValue}>
                    {comparisonResult.metric_differences.paragraph_length_avg_diff.toFixed(2)}
                  </span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Dialogue Diff</span>
                  <span className={styles.metricValue}>
                    {comparisonResult.metric_differences.dialogue_ratio_diff.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className={styles.comparedAt}>
                Compared at: {formatDate(comparisonResult.compared_at)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
