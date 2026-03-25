/**
 * useStyleHistory Hook
 *
 * Custom hook for managing style analysis history.
 * Provides data fetching, state management, and CRUD operations for style history records.
 *
 * @module hooks/useStyleHistory
 */

import { useState, useCallback } from "react";
import type {
  StyleHistoryListResponse,
  StyleHistoryRecord,
} from "../services/api/styleHistoryClient";
import {
  getStyleHistory,
  getStyleHistoryById,
  deleteStyleHistory,
} from "../services/api/styleHistoryClient";

/**
 * Return type for useStyleHistory hook.
 */
interface UseStyleHistoryResult {
  /** Array of style history records */
  history: StyleHistoryRecord[];
  /** Total count of records (for pagination) */
  total: number;
  /** Whether a fetch operation is in progress */
  loading: boolean;
  /** Error message if a fetch operation failed */
  error: string | null;
  /**
   * Fetch paginated style history for a user.
   * @param userId - The user ID to fetch history for
   * @param limit - Maximum number of records to fetch (default: 10)
   * @param offset - Number of records to skip (default: 0)
   */
  fetchHistory: (userId: string, limit?: number, offset?: number) => Promise<void>;
  /**
   * Fetch a single style history record by ID.
   * @param id - The record ID to fetch
   * @returns The style history record or null if not found
   */
  fetchById: (id: string) => Promise<StyleHistoryRecord | null>;
  /**
   * Delete a style history record by ID.
   * @param id - The record ID to delete
   * @returns True if deletion was successful
   */
  remove: (id: string) => Promise<boolean>;
}

/**
 * Hook for managing style analysis history.
 *
 * Provides state management and API integration for fetching, viewing,
 * and deleting style analysis history records.
 *
 * @returns Style history state and CRUD operations
 *
 * @example
 * ```tsx
 * function StyleHistoryPanel({ userId }: { userId: string }) {
 *   const { history, loading, error, fetchHistory, remove } = useStyleHistory();
 *
 *   useEffect(() => {
 *     fetchHistory(userId, 10, 0);
 *   }, [userId, fetchHistory]);
 *
 *   if (loading) return <Spinner />;
 *   if (error) return <Error message={error} />;
 *
 *   return (
 *     <ul>
 *       {history.map((record) => (
 *         <li key={record.id}>
 *           {record.style_name}
 *           <button onClick={() => remove(record.id)}>Delete</button>
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useStyleHistory(): UseStyleHistoryResult {
  const [history, setHistory] = useState<StyleHistoryRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async (userId: string, limit = 10, offset = 0) => {
    setLoading(true);
    setError(null);
    try {
      const response: StyleHistoryListResponse = await getStyleHistory(userId, limit, offset);
      setHistory(response.items);
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch style history");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchById = useCallback(async (id: string): Promise<StyleHistoryRecord | null> => {
    setLoading(true);
    setError(null);
    try {
      return await getStyleHistoryById(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch style history");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await deleteStyleHistory(id);
      setHistory((prev) => prev.filter((item) => item.id !== id));
      setTotal((prev) => prev - 1);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete style history");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    history,
    total,
    loading,
    error,
    fetchHistory,
    fetchById,
    remove,
  };
}
