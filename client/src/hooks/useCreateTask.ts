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

import {
  createTask,
  fetchTask,
  fetchTasks,
  TaskAPIError,
  TaskCreationUnknownError,
} from "../services/api/taskClient";
import type { TaskRecord } from "../types/task";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  readModalCreateAttempts,
  retainModalCreateAttempt,
} from "../services/modalCreateAttemptStore";
import { writeOwnedDraft, type DraftSnapshot } from "../services/draftStore";
import { useOptionalAuth } from "../contexts/AuthContext";
import {
  assertCurrentSession,
  RemoteAccountMismatchError,
  type RemoteSession,
} from "../services/api/remoteSession";

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
  /** A prior POST may have committed and ordinary submission is paused. */
  creationUncertain: boolean;
  /** Complete immutable body of the selected unconfirmed attempt. */
  pendingAttempt: DraftSnapshot | null;
  /** Unconfirmed attempts remain separate recovery records. */
  pendingAttempts: DraftSnapshot[];
  /** Explicit all-page recheck supplies candidates without assigning them. */
  checkCreation: () => Promise<TaskRecord[]>;
  /** Adopt only a rechecked candidate selected by the writer. */
  adoptCreation: (taskId: string) => Promise<TaskRecord>;
  /** Select another retained attempt for inspection and recheck. */
  selectAttempt: (draftId: string) => void;
  /** Retry reading retained records after browser storage becomes available. */
  retryRecovery: () => void;
  /** Recheck or candidate adoption is waiting. */
  isCheckingCreation: boolean;
  /** A failed recovery read must be retried before a new request. */
  recoveryReadFailed: boolean;
}

/** Input variables accepted by the create-task mutation. */
export interface CreateTaskVariables {
  /** Task content (Markdown text) */
  content: string;
  /** Optional list of lock IDs to associate with the task */
  lockIds?: string[];
  /** Only set after the writer explicitly accepts the duplicate-task risk. */
  allowDuplicate?: boolean;
}

interface CreationScope {
  session?: RemoteSession | null;
  ownerId?: string;
  attempts: DraftSnapshot[];
  selected: DraftSnapshot | null;
  storageError: Error | null;
  busy: boolean;
  checking: boolean;
  candidates: TaskRecord[];
}
type ScopedCreateVariables = CreateTaskVariables & { scope: CreationScope };
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
  const ownerId = auth?.user?.id;
  const [, update] = useState(0);
  const scope = useMemo<CreationScope>(() => {
    let attempts: DraftSnapshot[] = [];
    let storageError: Error | null = null;
    try {
      if (ownerId) attempts = readModalCreateAttempts(ownerId);
    } catch {
      storageError = new Error(
        "Task creation records could not be read. Retry recovery before creating a task."
      );
    }
    return {
      session,
      ownerId,
      attempts,
      selected: attempts[0] ?? null,
      storageError,
      busy: false,
      checking: false,
      candidates: [],
    };
  }, [ownerId, session]);
  const active = useRef(scope);
  active.current = scope;
  const notify = useCallback((captured: CreationScope) => {
    if (active.current === captured) update((revision) => revision + 1);
  }, []);

  const mutation = useMutation<TaskRecord, Error, ScopedCreateVariables>({
    mutationFn: async (variables) => {
      const captured = variables.scope;
      assertCurrentSession(captured.session);
      if (captured.storageError) throw captured.storageError;
      if (captured.selected && !variables.allowDuplicate) throw new TaskCreationUnknownError();
      let attempt: DraftSnapshot;
      try {
        attempt = retainModalCreateAttempt(
          captured.ownerId,
          variables.content,
          variables.lockIds ?? []
        );
        captured.attempts = [attempt, ...captured.attempts];
        captured.selected = attempt;
        notify(captured);
      } catch {
        throw new Error(
          "The task draft could not be retained. Keep this form open and retry when browser storage is available. No creation request was sent."
        );
      }
      try {
        const task = await createTask(
          { content: variables.content, lockIds: variables.lockIds ?? [] },
          { session: captured.session }
        );
        if (captured.ownerId)
          writeOwnedDraft(captured.ownerId, {
            ...attempt,
            taskId: task.id,
            version: task.version,
            versionKnown: true,
            dirty: false,
            creationUncertain: false,
          });
        captured.attempts = captured.attempts.filter((item) => item.draftId !== attempt.draftId);
        captured.selected = captured.attempts[0] ?? null;
        notify(captured);
        return task;
      } catch (failure) {
        const rejected =
          failure instanceof RemoteAccountMismatchError ||
          (failure instanceof TaskAPIError && failure.status >= 400 && failure.status < 500);
        if (rejected) {
          if (captured.ownerId)
            writeOwnedDraft(captured.ownerId, { ...attempt, creationUncertain: false });
          captured.attempts = captured.attempts.filter((item) => item.draftId !== attempt.draftId);
          captured.selected = captured.attempts[0] ?? null;
          notify(captured);
        }
        throw failure;
      }
    },
    onSuccess: (_task, variables) => {
      if (variables.scope.session && !variables.scope.session.isCurrent()) return;
      // Invalidate the task list query to trigger a refetch
      return queryClient.invalidateQueries({
        queryKey: variables.scope.session ? ["tasks", variables.scope.session.userId] : ["tasks"],
      });
    },
    onSettled: (_data, _error, variables) => {
      variables.scope.busy = false;
      notify(variables.scope);
    },
    retry: false,
  });
  const { mutate: execute, mutateAsync: executeAsync } = mutation;
  const mutate: UseCreateTaskResult["mutate"] = useCallback(
    (variables, options) => {
      if (scope.busy) return;
      scope.busy = true;
      execute(
        { ...variables, lockIds: [...(variables.lockIds ?? [])], scope },
        scopedCallbacks(variables, options, session)
      );
    },
    [execute, session, scope]
  );
  const mutateAsync: UseCreateTaskResult["mutateAsync"] = useCallback(
    async (variables, options) => {
      if (scope.busy) throw new Error("Task creation is already in progress.");
      scope.busy = true;
      const task = await executeAsync(
        { ...variables, lockIds: [...(variables.lockIds ?? [])], scope },
        scopedCallbacks(variables, options, session)
      );
      assertCurrentSession(session);
      return task;
    },
    [executeAsync, session, scope]
  );

  const retryRecovery = useCallback(() => {
    if (!scope.ownerId) return;
    try {
      scope.attempts = readModalCreateAttempts(scope.ownerId);
      scope.selected =
        scope.attempts.find((item) => item.draftId === scope.selected?.draftId) ??
        scope.attempts[0] ??
        null;
      scope.storageError = null;
    } catch {
      scope.storageError = new Error(
        "Task creation records could not be read. Retry recovery before creating a task."
      );
    }
    notify(scope);
  }, [scope, notify]);
  const selectAttempt = useCallback(
    (draftId: string) => {
      if (scope.busy || scope.checking) return;
      scope.selected = scope.attempts.find((item) => item.draftId === draftId) ?? scope.selected;
      scope.candidates = [];
      notify(scope);
    },
    [scope, notify]
  );
  const checkCreation = useCallback(async () => {
    assertCurrentSession(scope.session);
    const attempt = scope.selected;
    if (!attempt || scope.busy || scope.checking)
      throw new Error("Select an unconfirmed task creation to recheck.");
    scope.checking = true;
    scope.candidates = [];
    notify(scope);
    try {
      const candidates: TaskRecord[] = [];
      const seen = new Set<string>();
      let offset = 0;
      let total: number | null = null;
      do {
        const page = await fetchTasks(
          { limit: 100, offset, sort: { field: "created_at", order: "asc" } },
          { session: scope.session }
        );
        total ??= page.total;
        if (
          !Number.isInteger(total) ||
          total < 0 ||
          page.total !== total ||
          page.offset !== offset ||
          page.limit !== 100 ||
          page.tasks.length !== Math.min(100, total - offset)
        )
          throw new Error("The task collection changed. Please recheck creation.");
        for (const task of page.tasks) {
          if (!task.id || seen.has(task.id))
            throw new Error("The task collection changed. Please recheck creation.");
          seen.add(task.id);
          if (
            task.content === attempt.content &&
            JSON.stringify(task.lock_ids) === JSON.stringify(attempt.lockIds)
          )
            candidates.push(task);
        }
        offset += page.tasks.length;
      } while (offset < total);
      assertCurrentSession(scope.session);
      scope.candidates = candidates;
      return candidates;
    } finally {
      scope.checking = false;
      notify(scope);
    }
  }, [scope, notify]);
  const adoptCreation = useCallback(
    async (taskId: string) => {
      assertCurrentSession(scope.session);
      const attempt = scope.selected;
      if (
        !attempt ||
        scope.busy ||
        scope.checking ||
        !scope.candidates.some((task) => task.id === taskId)
      )
        throw new Error("Recheck creation and select a matching task first.");
      scope.checking = true;
      notify(scope);
      try {
        const task = await fetchTask(taskId, { session: scope.session });
        assertCurrentSession(scope.session);
        if (
          task.content !== attempt.content ||
          JSON.stringify(task.lock_ids) !== JSON.stringify(attempt.lockIds)
        )
          throw new Error("The selected task changed. Recheck creation before choosing it.");
        if (scope.ownerId)
          writeOwnedDraft(scope.ownerId, {
            ...attempt,
            taskId: task.id,
            version: task.version,
            versionKnown: true,
            dirty: false,
            creationUncertain: false,
          });
        scope.attempts = scope.attempts.filter((item) => item.draftId !== attempt.draftId);
        scope.selected = scope.attempts[0] ?? null;
        scope.candidates = [];
        await queryClient.invalidateQueries({
          queryKey: scope.session ? ["tasks", scope.session.userId] : ["tasks"],
        });
        assertCurrentSession(scope.session);
        return task;
      } finally {
        scope.checking = false;
        notify(scope);
      }
    },
    [scope, notify, queryClient]
  );

  const ownsMutation =
    mutation.variables?.scope === scope &&
    (auth === undefined || !!mutation.variables.scope.session?.isCurrent());
  return {
    mutate,
    mutateAsync,
    isLoading: ownsMutation && mutation.isPending,
    error: scope.storageError ?? (ownsMutation ? (mutation.error ?? null) : null),
    creationUncertain: scope.selected !== null,
    pendingAttempt: scope.selected,
    pendingAttempts: scope.attempts,
    checkCreation,
    adoptCreation,
    selectAttempt,
    retryRecovery,
    isCheckingCreation: scope.checking,
    recoveryReadFailed: scope.storageError !== null,
  };
}
