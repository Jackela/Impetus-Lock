/**
 * useStyleLearning Hook
 *
 * Custom hook for managing Style Learning feature state.
 * Handles analysis, state management, and error handling.
 *
 * @module hooks/useStyleLearning
 */

import { useState, useCallback } from "react";
import { analyzeStyle, StyleAPIError } from "../services/api/styleClient";
import type { StyleAnalysisResponse } from "../components/StyleLearning/types";
import { useOptionalAuth } from "../contexts/AuthContext";
import type { RemoteSession } from "../services/api/remoteSession";

/**
 * State for style learning feature.
 */
export interface StyleLearningState {
  /** Whether analysis is in progress */
  isLoading: boolean;
  /** Analysis result (null if no result yet) */
  result: StyleAnalysisResponse | null;
  /** Error message (null if no error) */
  error: string | null;
}

/**
 * Return type for useStyleLearning hook.
 */
export interface UseStyleLearningReturn extends StyleLearningState {
  /** Analyze text for style */
  analyze: (text: string, userId: string) => Promise<void>;
  /** Clear the current result */
  clearResult: () => void;
  /** Clear the current error */
  clearError: () => void;
  /** Reset all state */
  reset: () => void;
}

/**
 * Hook for managing Style Learning feature.
 *
 * Provides state management and API integration for style analysis.
 *
 * @returns Style learning state and actions
 *
 * @example
 * ```tsx
 * const { isLoading, result, error, analyze, clearError } = useStyleLearning();
 *
 * const handleSubmit = async (text: string) => {
 *   await analyze(text, userId);
 * };
 *
 * if (isLoading) return <Spinner />;
 * if (error) return <Error message={error} />;
 * if (result) return <StyleAnalysisResult result={result} />;
 * ```
 */
export function useStyleLearning(): UseStyleLearningReturn {
  const auth = useOptionalAuth();
  const session = auth?.session;
  const [state, setState] = useState<StyleLearningState & { session?: RemoteSession | null }>({
    isLoading: false,
    result: null,
    error: null,
  });

  const analyze = useCallback(
    async (text: string, uid: string) => {
      const current = (): boolean => auth === undefined || !!session?.isCurrent();
      if (!current()) return;
      setState((prev) => ({
        isLoading: true,
        result: prev.session === session ? prev.result : null,
        error: null,
        session,
      }));

      try {
        const result = await analyzeStyle(
          text,
          session?.userId ?? uid,
          auth ? { session } : undefined
        );
        if (current()) setState({ isLoading: false, result, error: null, session });
      } catch (err) {
        if (!current()) return;
        const errorMessage =
          err instanceof StyleAPIError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Failed to analyze style";

        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
      }
    },
    [auth, session]
  );

  const clearResult = useCallback(() => {
    setState((prev) => ({ ...prev, result: null }));
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const reset = useCallback(() => {
    setState({ isLoading: false, result: null, error: null });
  }, []);

  const visible = auth === undefined || (state.session === session && !!session?.isCurrent());
  return {
    isLoading: visible && state.isLoading,
    result: visible ? state.result : null,
    error: visible ? state.error : null,
    analyze,
    clearResult,
    clearError,
    reset,
  };
}
