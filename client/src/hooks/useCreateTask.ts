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

import {
  useMutation,
  useQueryClient,
  type UseMutateFunction,
  type UseMutateAsyncFunction,
} from "@tanstack/react-query";

import { createTask } from "../services/api/taskClient";
import type { TaskRecord } from "../types/task";
import { useCallback } from "react";
import { useOptionalAuth } from "../contexts/AuthContext";
import { assertCurrentSession, type RemoteSession } from "../services/api/remoteSession";

/** Result object returned by the useCreateTask hook. */
export interface UseCreateTaskResult {
  /** Function to trigger the mutation (no return value, fire-and-forget) */
  mutate: UseMutateFunction<TaskRecord, Error, CreateTaskVariables>;
  /** Function to trigger the mutation and wait for completion */
  mutateAsync: UseMutateAsyncFunction<TaskRecord, Error, CreateTaskVariables>;
  /** Whether the mutation is in progress */
  isLoading: boolean;
  /** Error object if the mutation failed */
  error: Error | null;
}

/** Input variables accepted by the create-task mutation. */
export interface CreateTaskVariables {
  /** Task content (Markdown text) */
  content: string;
  /** Optional list of lock IDs to associate with the task */
  lockIds?: string[];
}

type ScopedCreateVariables = CreateTaskVariables & { session?: RemoteSession | null };
type CreateCallbacks = Parameters<UseCreateTaskResult["mutate"]>[1];

function scopedCallbacks(
  variables: CreateTaskVariables,
  options: CreateCallbacks,
  session?: RemoteSession | null
): CreateCallbacks {
  if (!options) return options;
  const current = (): boolean =>
    session === undefined || (session !== null && session.isCurrent() && !session.signal.aborted);
  return {
    ...options,
    onSuccess: (data, _variables, result, context) => {
      if (current()) options.onSuccess?.(data, variables, result, context);
    },
    onError: (error, _variables, result, context) => {
      if (current()) options.onError?.(error, variables, result, context);
    },
    onSettled: (data, error, _variables, result, context) => {
      if (current()) options.onSettled?.(data, error, variables, result, context);
    },
  };
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
  const auth = useOptionalAuth();
  const session = auth?.session;

  const mutation = useMutation<TaskRecord, Error, ScopedCreateVariables>({
    mutationFn: async (variables) => {
      return createTask(
        { content: variables.content, lockIds: variables.lockIds ?? [] },
        { session: variables.session }
      );
    },
    onSuccess: (_task, variables) => {
      if (variables.session && !variables.session.isCurrent()) return;
      // Invalidate the task list query to trigger a refetch
      return queryClient.invalidateQueries({
        queryKey: variables.session ? ["tasks", variables.session.userId] : ["tasks"],
      });
    },
    ...(auth ? { retry: false } : {}),
  });
  const { mutate: execute, mutateAsync: executeAsync } = mutation;
  const mutate: UseCreateTaskResult["mutate"] = useCallback(
    (variables, options) => {
      execute({ ...variables, session }, scopedCallbacks(variables, options, session));
    },
    [execute, session]
  );
  const mutateAsync: UseCreateTaskResult["mutateAsync"] = useCallback(
    async (variables, options) => {
      const task = await executeAsync(
        { ...variables, session },
        scopedCallbacks(variables, options, session)
      );
      assertCurrentSession(session);
      return task;
    },
    [executeAsync, session]
  );

  const ownsMutation = auth === undefined || !!mutation.variables?.session?.isCurrent();
  return {
    mutate,
    mutateAsync,
    isLoading: ownsMutation && mutation.isPending,
    error: ownsMutation ? (mutation.error ?? null) : null,
  };
}
