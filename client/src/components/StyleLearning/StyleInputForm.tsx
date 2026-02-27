/**
 * Style Input Form Component
 *
 * Form for users to input writing samples for style analysis.
 * Includes word count validation (minimum 500 words) and loading states.
 *
 * @module components/StyleLearning/StyleInputForm
 */

import { useState, useCallback, type FormEvent, type ChangeEvent } from "react";
import "./StyleInputForm.css";

/**
 * Props for the StyleInputForm component.
 */
export interface StyleInputFormProps {
  /** Callback when form is submitted with valid text */
  onSubmit: (text: string) => void;
  /** Whether the form is in a loading/submission state */
  isLoading?: boolean;
  /** Error message to display */
  error?: string;
  /** Callback when error should be cleared */
  onErrorClear?: () => void;
}

/** Minimum word count required for style analysis */
const MIN_WORD_COUNT = 500;

/**
 * Count words in a text string.
 *
 * @param text - Text to count words in
 * @returns Number of words
 */
function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * Style Input Form Component
 *
 * Provides a textarea for users to input writing samples with real-time
 * word count validation and submission handling.
 *
 * @param props - Component props
 * @returns The rendered form component
 *
 * @example
 * ```tsx
 * <StyleInputForm
 *   onSubmit={(text) => analyzeStyle(text, userId)}
 *   isLoading={isAnalyzing}
 *   error={analysisError}
 *   onErrorClear={() => clearError()}
 * />
 * ```
 */
export function StyleInputForm({
  onSubmit,
  isLoading = false,
  error,
  onErrorClear,
}: StyleInputFormProps): JSX.Element {
  const [text, setText] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const wordCount = countWords(text);
  const isValid = wordCount >= MIN_WORD_COUNT;

  const handleTextChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value;
      setText(newText);

      // Clear validation error when user types
      if (validationError) {
        setValidationError(null);
      }

      // Clear external error when user types
      if (error && onErrorClear) {
        onErrorClear();
      }
    },
    [validationError, error, onErrorClear]
  );

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();

      if (!isValid) {
        setValidationError(
          `Please enter at least ${MIN_WORD_COUNT} words (${wordCount}/${MIN_WORD_COUNT})`
        );
        return;
      }

      onSubmit(text);
    },
    [isValid, wordCount, text, onSubmit]
  );

  const isWordCountLow = wordCount > 0 && wordCount < MIN_WORD_COUNT;
  const descriptionId = "word-count-description";

  return (
    <form className="style-input-form" onSubmit={handleSubmit} data-testid="style-input-form">
      <div className="form-group">
        <label htmlFor="writing-sample" className="form-label">
          Writing Sample
        </label>
        <textarea
          id="writing-sample"
          className={`form-textarea ${isWordCountLow ? "warning" : ""}`}
          value={text}
          onChange={handleTextChange}
          disabled={isLoading}
          placeholder="Paste your writing sample here (minimum 500 words)..."
          rows={12}
          aria-label="Writing sample input"
          aria-describedby={descriptionId}
          aria-invalid={isWordCountLow}
        />
        <div id={descriptionId} className="word-count-hint">
          <span className={`word-count ${isWordCountLow ? "low" : ""}`}>{wordCount} words</span>
          <span className="min-requirement">(minimum {MIN_WORD_COUNT} words)</span>
        </div>
      </div>

      {validationError && (
        <div className="validation-error" role="alert" data-testid="validation-error">
          {validationError}
        </div>
      )}

      {error && (
        <div className="form-error" role="alert" data-testid="form-error">
          {error}
        </div>
      )}

      <button
        type="submit"
        className="submit-button"
        disabled={!isValid || isLoading}
        aria-disabled={!isValid || isLoading}
      >
        {isLoading ? "Analyzing..." : "Analyze Style"}
      </button>
    </form>
  );
}
