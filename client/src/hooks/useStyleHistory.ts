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

interface UseStyleHistoryResult {
  history: StyleHistoryRecord[];
  total: number;
  loading: boolean;
  error: string | null;
  fetchHistory: (userId: string, limit?: number, offset?: number) => Promise<void>;
  fetchById: (id: string) => Promise<StyleHistoryRecord | null>;
  remove: (id: string) => Promise<boolean>;
}

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
