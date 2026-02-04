/**
 * useTasks Hook
 *
 * React hook for fetching and managing task list from the API.
 *
 * Uses native React hooks (useState, useEffect, useCallback) for data fetching.
 * Follows the simplicity principle of Article I - no external dependencies like React Query.
 *
 * Constitutional Compliance:
 * - Article I (Simplicity): Uses framework-native hooks, no external data fetching libraries
 * - Article V (Documentation): Complete JSDoc comments
 *
 * @module hooks/useTasks
 */

import { useCallback, useEffect, useState } from "react";

import { fetchTasks, TaskAPIError, type TaskListResponse } from "../services/api/taskClient";
import type { TaskRecord } from "../types/task";

export interface UseTasksResult {
  /** List of tasks (empty array when loading or on error) */
  data: TaskRecord[];
  /** Whether the request is in progress */
  isLoading: boolean;
  /** Error object if the request failed */
  error: Error | null;
  /** Total number of tasks (for pagination) */
  total: number;
  /** Current page limit */
  limit: number;
  /** Current page offset */
  offset: number;
  /** Function to manually refetch the tasks */
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching and managing the task list.
 *
 * Provides loading state, error handling, and manual refetch capability.
 * Tasks are fetched on mount and can be refreshed via the refetch function.
 *
 * @param options - Optional configuration for the query
 * @param options.limit - Maximum number of tasks to fetch (default: 100)
 * @param options.offset - Number of tasks to skip for pagination (default: 0)
 * @returns Object containing data, loading state, error, and refetch function
 *
 * @example
 * ```tsx
 * function TaskListPage() {
 *   const { data, isLoading, error, refetch } = useTasks();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return (
 *     <div>
 *       <button onClick={refetch}>Refresh</button>
 *       {data.map(task => <TaskCard key={task.id} task={task} />)}
 *     </div>
 *   );
 * }
 * ```
 */
export function useTasks(
  options: { limit?: number; offset?: number } = {}
): UseTasksResult {
  const { limit = 100, offset = 0 } = options;

  const [data, setData] = useState<TaskRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result: TaskListResponse = await fetchTasks(limit, offset);
      setData(result.tasks);
      setTotal(result.total);
    } catch (err) {
      const errorObj =
        err instanceof TaskAPIError || err instanceof Error
          ? err
          : new Error("Failed to fetch tasks");
      setError(errorObj);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [limit, offset]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return {
    data,
    isLoading,
    error,
    total,
    limit,
    offset,
    refetch: fetch,
  };
}
