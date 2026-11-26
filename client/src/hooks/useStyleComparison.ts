/**
 * useStyleComparison Hook
 *
 * Custom hook for managing style comparison state and operations.
 * Provides functionality to select two history items and compare their style vectors.
 *
 * @module hooks/useStyleComparison
 */

import { useState, useCallback } from "react";
import type { StyleComparisonResponse } from "../services/api/styleComparisonClient";
import { compareStyles } from "../services/api/styleComparisonClient";
import { useOptionalAuth } from "../contexts/AuthContext";
import type { StyleHistoryRecord } from "../services/api/styleHistoryClient";
import type { RemoteSession } from "../services/api/remoteSession";

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

type ComparisonState = Pick<
  UseStyleComparisonResult,
  "firstStyle" | "secondStyle" | "comparisonResult" | "loading" | "error"
> & { session: RemoteSession | null | undefined };

const emptyComparison = {
  firstStyle: null,
  secondStyle: null,
  comparisonResult: null,
  loading: false,
  error: null,
};

/**
 * Manages selection and comparison of two historical style profiles.
 *
 * @returns Selected styles, comparison result, and selection/comparison actions
 */
export function useStyleComparison(): UseStyleComparisonResult {
  const auth = useOptionalAuth();
  const session = auth?.session;
  const [comparison, setComparison] = useState<ComparisonState>({ ...emptyComparison, session });
  if (comparison.session !== session) {
    setComparison({ ...emptyComparison, session });
  }
  const { firstStyle, secondStyle, comparisonResult, loading, error } = comparison;

  const selectFirstStyle = useCallback((record: StyleHistoryRecord) => {
    setComparison((previous) => ({
      ...previous,
      firstStyle: record,
      comparisonResult: null,
      error: null,
    }));
  }, []);

  const selectSecondStyle = useCallback((record: StyleHistoryRecord) => {
    setComparison((previous) => ({
      ...previous,
      secondStyle: record,
      comparisonResult: null,
      error: null,
    }));
  }, []);

  const performComparison = useCallback(async (): Promise<boolean> => {
    const current = () => auth === undefined || !!session?.isCurrent();
    if (!current()) return false;
    if (!firstStyle || !secondStyle) {
      setComparison((previous) => ({
        ...previous,
        error: "Both styles must be selected before comparing",
      }));
      return false;
    }

    setComparison((previous) => ({
      ...previous,
      loading: true,
      error: null,
      comparisonResult: null,
    }));

    try {
      const result = await compareStyles(
        firstStyle.style_vector,
        secondStyle.style_vector,
        auth ? { session } : undefined
      );
      if (!current()) return false;
      setComparison((previous) => ({ ...previous, comparisonResult: result, loading: false }));
      return true;
    } catch (err) {
      if (!current()) return false;
      const message = err instanceof Error ? err.message : "Failed to compare styles";
      setComparison((previous) => ({ ...previous, error: message, loading: false }));
      return false;
    }
  }, [firstStyle, secondStyle, auth, session]);

  const clearComparison = useCallback(() => {
    setComparison((previous) => ({ ...emptyComparison, session: previous.session }));
  }, []);

  const swapStyles = useCallback(() => {
    setComparison((previous) => ({
      ...previous,
      firstStyle: previous.secondStyle,
      secondStyle: previous.firstStyle,
      comparisonResult: null,
      error: null,
    }));
  }, []);

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
