/**
 * Style Learning Panel Component
 *
 * Container component that combines StyleInputForm and StyleAnalysisResult
 * with state management.
 *
 * @module components/StyleLearning/StyleLearningPanel
 */

import { useCallback } from "react";
import { StyleInputForm } from "./StyleInputForm";
import { StyleAnalysisResult } from "./StyleAnalysisResult";
import { useStyleLearning } from "../../hooks/useStyleLearning";
import "./StyleLearningPanel.css";

/**
 * Props for the StyleLearningPanel component.
 */
export interface StyleLearningPanelProps {
  /** User ID for style association */
  userId: string;
  /** Callback when style is applied (optional) */
  onApplyStyle?: (result: { userId: string; intensity: number }) => void;
  /** Default user ID if not provided */
  defaultUserId?: string;
}

/**
 * Style Learning Panel Component
 *
 * Provides a complete style learning interface with input form and result display.
 *
 * @param props - Component props
 * @returns The rendered panel component
 *
 * @example
 * ```tsx
 * <StyleLearningPanel
 *   userId={currentUser.id}
 *   onApplyStyle={({ userId }) => applyStyleToTask(userId)}
 * />
 * ```
 */
export function StyleLearningPanel({
  userId,
  onApplyStyle,
}: StyleLearningPanelProps): JSX.Element {
  const { isLoading, result, error, analyze, clearError } = useStyleLearning();

  const handleSubmit = useCallback(
    async (text: string) => {
      await analyze(text, userId);
    },
    [analyze, userId]
  );

  const handleApplyClick = useCallback(() => {
    if (result && onApplyStyle) {
      onApplyStyle({ userId: result.user_id, intensity: 1.0 });
    }
  }, [result, onApplyStyle]);

  return (
    <div className="style-learning-panel" data-testid="style-learning-panel">
      <h2 className="panel-title">Style Learning</h2>
      <p className="panel-description">
        Paste a writing sample (minimum 500 words) to analyze your unique writing style.
        Once analyzed, you can apply your style to transform text.
      </p>

      <StyleInputForm
        onSubmit={handleSubmit}
        isLoading={isLoading}
        error={error ?? undefined}
        onErrorClear={clearError}
      />

      {result && (
        <div className="result-container">
          <StyleAnalysisResult
            result={result}
            onApplyClick={handleApplyClick}
            isApplyDisabled={isLoading}
          />
        </div>
      )}
    </div>
  );
}
