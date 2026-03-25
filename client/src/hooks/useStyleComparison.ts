/**
 * useStyleComparison Hook
 *
 * Custom hook for managing style comparison state and operations.
 * Provides functionality to select two history items and compare their style vectors.
 *
 * @module hooks/useStyleComparison
 */

import { useState, useCallback } from "react";
import type { StyleVector, StyleComparisonResponse } from "../services/api/styleComparisonClient";
import { compareStyles } from "../services/api/styleComparisonClient";
import type { StyleHistoryRecord } from "../services/api/styleHistoryClient";

/**
 * Return type for useStyleComparison hook.
 */
interface UseStyleComparisonResult {
  /** First selected style for comparison (null if not selected) */
  firstStyle: StyleHistoryRecord | null;
  /** Second selected style for comparison (null if not selected) */
  secondStyle: StyleHistoryRecord | null;
  /** Comparison result from the API (null if not yet compared) */
  comparisonResult: StyleComparisonResponse | null;
  /** Whether a comparison operation is in progress */
  loading: boolean;
  /** Error message if comparison failed */
  error: string | null;
  /**
   * Select the first style for comparison.
   * @param record - The history record to select
   */
  selectFirstStyle: (record: StyleHistoryRecord) => void;
  /**
   * Select the second style for comparison.
   * @param record - The history record to select
   */
  selectSecondStyle: (record: StyleHistoryRecord) => void;
  /**
   * Perform the style comparison.
   * Compares the two selected styles and stores the result.
   * @returns True if comparison was successful
   */
  performComparison: () => Promise<boolean>;
  /**
   * Clear the comparison state (selected styles and results).
   */
  clearComparison: () => void;
  /**
   * Swap the first and second selected styles.
   */
  swapStyles: () => void;
}

export function useStyleComparison(): UseStyleComparisonResult {
  const [firstStyle, setFirstStyle] = useState<StyleHistoryRecord | null>(null);
  const [secondStyle, setSecondStyle] = useState<StyleHistoryRecord | null>(null);
  const [comparisonResult, setComparisonResult] = useState<StyleComparisonResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectFirstStyle = useCallback((record: StyleHistoryRecord) => {
    setFirstStyle(record);
    setComparisonResult(null);
    setError(null);
  }, []);

  const selectSecondStyle = useCallback((record: StyleHistoryRecord) => {
    setSecondStyle(record);
    setComparisonResult(null);
    setError(null);
  }, []);

  const performComparison = useCallback(async (): Promise<boolean> => {
    if (!firstStyle || !secondStyle) {
      setError("Both styles must be selected before comparing");
      return false;
    }

    setLoading(true);
    setError(null);
    setComparisonResult(null);

    try {
      const result = await compareStyles(firstStyle.style_vector, secondStyle.style_vector);
      setComparisonResult(result);
      return true;
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to compare styles");
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, [firstStyle, secondStyle]);

  const clearComparison = useCallback(() => {
    setFirstStyle(null);
    setSecondStyle(null);
    setComparisonResult(null);
    setError(null);
    setLoading(false);
  }, []);

  const swapStyles = useCallback(() => {
    setFirstStyle((prev) => {
      setSecondStyle(prev);
      return secondStyle;
    });
    setComparisonResult(null);
    setError(null);
  }, [secondStyle]);

  return {
    firstStyle,
    secondStyle,
    comparisonResult,
    loading,
    error,
    selectFirstStyle,
    selectSecondStyle,
    performComparison,
    clearComparison,
    swapStyles,
  };
}
