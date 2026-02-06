/**
 * useCreateTask Hook
 *
 * React hook for creating new tasks via the API.
 *
 * Uses React Query's useMutation for data mutations with automatic cache invalidation.
 * After successful creation, the task list cache is invalidated to trigger a refetch.
 *
 * Constitutional Compliance:
 * - Article I (Simplicity): Uses configured library (@tanstack/react-query)
 * - Article V (Documentation): Complete JSDoc comments
 *
 * @module hooks/useCreateTask
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createTask } from "../services/api/taskClient";
import type { TaskRecord } from "../types/task";

export interface UseCreateTaskResult {
  /** Function to trigger the mutation (no return value, fire-and-forget) */
  mutate: (variables: CreateTaskVariables) => void;
  /** Function to trigger the mutation and wait for completion */
  mutateAsync: (variables: CreateTaskVariables) => Promise<TaskRecord>;
  /** Whether the mutation is in progress */
  isLoading: boolean;
  /** Error object if the mutation failed */
  error: Error | null;
}

export interface CreateTaskVariables {
  /** Task content (Markdown text) */
  content: string;
  /** Optional list of lock IDs to associate with the task */
  lockIds?: string[];
}

/**
 * Hook for creating a new task.
 *
 * Provides mutation function for creating tasks with automatic cache invalidation.
 * After successful creation, the task list query cache is invalidated to trigger
 * a refetch of the task list.
 *
 * @returns Object containing mutate, mutateAsync, isLoading, and error
 *
 * @example
 * ```tsx
 * function CreateTaskForm() {
 *   const { mutate, isLoading, error } = useCreateTask();
 *
 *   const handleSubmit = (content: string) => {
 *     mutate({ content });
 *   };
 *
 *   return (
 *     <form onSubmit={(e) => handleSubmit(e.target.content.value)}>
 *       <textarea name="content" />
 *       <button disabled={isLoading}>Create</button>
 *       {error && <span>Error: {error.message}</span>}
 *     </form>
 *   );
 * }
 * ```
 */
export function useCreateTask(): UseCreateTaskResult {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (variables: CreateTaskVariables) => {
      return createTask(variables.content, variables.lockIds ?? []);
    },
    onSuccess: () => {
      // Invalidate the task list query to trigger a refetch
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  return {
    mutate: (variables) => mutation.mutate(variables),
    mutateAsync: (variables) => mutation.mutateAsync(variables),
    isLoading: mutation.isPending,
    error: mutation.error ?? null,
  };
}
