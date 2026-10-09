/**
 * useTasks Hook
 *
 * React hook for fetching and managing task list from the API.
 *
 * Uses React Query's useQuery for data fetching with caching, refetching,
 * and automatic re-querying. Leverages the QueryClientProvider configured
 * in main.tsx with 5-minute staleTime.
 *
 * Constitutional Compliance:
 * - Article I (Simplicity): Uses configured library (@tanstack/react-query)
 * - Article V (Documentation): Complete JSDoc comments
 *
 * @module hooks/useTasks
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { fetchTasks, type TaskListResponse } from "../services/api/taskClient";
import type { TaskRecord } from "../types/task";
import { useOptionalAuth } from "../contexts/AuthContext";

/** Result object returned by the useTasks hook. */
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
  refetch: UseQueryResult<TaskListResponse, Error>["refetch"];
}

/**
 * Query key factory for useTasks hook.
 * Provides stable query keys for React Query caching.
 *
 * @param limit - Maximum number of tasks to fetch
 * @param offset - Number of tasks to skip for pagination
 * @param userId - Confirmed account ID, null while checking, or omitted for standalone use
 * @param generation - Authorization lifetime, so restored accounts start fresh requests
 * @returns Stable React Query key for the given page
 */
function getQueryKey(limit: number, offset: number, userId?: string | null, generation?: number) {
  return userId === undefined
    ? (["tasks", { limit, offset }] as const)
    : (["tasks", userId, { limit, offset }, generation] as const);
}

/**
 * Hook for fetching and managing the task list.
 *
 * Provides loading state, error handling, and manual refetch capability.
 * Tasks are fetched on mount and can be refreshed via the refetch function.
 * Data is cached for 5 minutes (configured in main.tsx QueryClient).
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
export function useTasks(options: { limit?: number; offset?: number } = {}): UseTasksResult {
  const { limit = 100, offset = 0 } = options;
  const auth = useOptionalAuth();
  const session = auth?.session;

  const query = useQuery({
    queryKey: getQueryKey(
      limit,
      offset,
      auth ? (auth.user?.id ?? null) : undefined,
      auth?.generation
    ),
    enabled: auth === undefined || auth.remoteEnabled,
    queryFn: ({ signal }) => fetchTasks({ limit, offset }, auth ? { session, signal } : undefined),
    ...(auth
      ? {
          retry: (failures: number, error: Error) =>
            error.name !== "AbortError" &&
            (!("status" in error) || ![401, 403].includes(Number(error.status))) &&
            failures < 2,
        }
      : {}),
  });

  return {
    data: query.data?.tasks ?? [],
    isLoading: query.isLoading,
    error: query.error ?? null,
    total: query.data?.total ?? 0,
    limit,
    offset,
    refetch: query.refetch,
  };
}
