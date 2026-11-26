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
import { useCallback, useMemo, useSyncExternalStore } from "react";
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

interface CreationState {
  attempts: DraftSnapshot[];
  selected: DraftSnapshot | null;
  storageError: Error | null;
  busy: boolean;
  checking: boolean;
  candidates: TaskRecord[];
}
function createCreationScope(ownerId?: string, session?: RemoteSession | null) {
  let snapshot: CreationState = {
    attempts: [],
    selected: null,
    storageError: null,
    busy: false,
    checking: false,
    candidates: [],
  };
  const listeners = new Set<() => void>();
  const update = (patch: Partial<CreationState>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener());
  };
  const retryRecovery = () => {
    if (!ownerId) return;
    try {
      const attempts = readModalCreateAttempts(ownerId);
      const selected =
        attempts.find((item) => item.draftId === snapshot.selected?.draftId) ?? attempts[0] ?? null;
      update({ attempts, selected, storageError: null });
    } catch {
      update({
        storageError: new Error(
          "Task creation records could not be read. Retry recovery before creating a task."
        ),
      });
    }
  };
  const removeAttempt = (draftId: string) => {
    const attempts = snapshot.attempts.filter((item) => item.draftId !== draftId);
    update({ attempts, selected: attempts[0] ?? null });
  };

  retryRecovery();
  return {
    ownerId,
    session,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update,
    retryRecovery,
    removeAttempt,
  };
}

type CreationScope = ReturnType<typeof createCreationScope>;
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
  const scope = useMemo(() => createCreationScope(ownerId, session), [ownerId, session]);
  const state = useSyncExternalStore(scope.subscribe, scope.getSnapshot, scope.getSnapshot);

  const mutation = useMutation<TaskRecord, Error, ScopedCreateVariables>({
    mutationFn: async (variables) => {
      const captured = variables.scope;
      assertCurrentSession(captured.session);
      const { attempts, selected, storageError } = captured.getSnapshot();
      if (storageError) throw storageError;
      if (selected && !variables.allowDuplicate) throw new TaskCreationUnknownError();
      let attempt: DraftSnapshot;
      try {
        attempt = retainModalCreateAttempt(
          captured.ownerId,
          variables.content,
          variables.lockIds ?? []
        );
        captured.update({ attempts: [attempt, ...attempts], selected: attempt });
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
        captured.removeAttempt(attempt.draftId);
        return task;
      } catch (failure) {
        const rejected =
          failure instanceof RemoteAccountMismatchError ||
          (failure instanceof TaskAPIError && failure.status >= 400 && failure.status < 500);
        if (rejected) {
          if (captured.ownerId)
            writeOwnedDraft(captured.ownerId, { ...attempt, creationUncertain: false });
          captured.removeAttempt(attempt.draftId);
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
      variables.scope.update({ busy: false });
    },
    retry: false,
  });
  const { mutate: execute, mutateAsync: executeAsync } = mutation;
  const mutate: UseCreateTaskResult["mutate"] = useCallback(
    (variables, options) => {
      if (scope.getSnapshot().busy) return;
      scope.update({ busy: true });
      execute(
        { ...variables, lockIds: [...(variables.lockIds ?? [])], scope },
        scopedCallbacks(variables, options, session)
      );
    },
    [execute, session, scope]
  );
  const mutateAsync: UseCreateTaskResult["mutateAsync"] = useCallback(
    async (variables, options) => {
      if (scope.getSnapshot().busy) throw new Error("Task creation is already in progress.");
      scope.update({ busy: true });
      const task = await executeAsync(
        { ...variables, lockIds: [...(variables.lockIds ?? [])], scope },
        scopedCallbacks(variables, options, session)
      );
      assertCurrentSession(session);
      return task;
    },
    [executeAsync, session, scope]
  );

  const selectAttempt = useCallback(
    (draftId: string) => {
      const { busy, checking, attempts, selected } = scope.getSnapshot();
      if (busy || checking) return;
      scope.update({
        selected: attempts.find((item) => item.draftId === draftId) ?? selected,
        candidates: [],
      });
    },
    [scope]
  );
  const checkCreation = useCallback(async () => {
    assertCurrentSession(scope.session);
    const { selected: attempt, busy, checking } = scope.getSnapshot();
    if (!attempt || busy || checking)
      throw new Error("Select an unconfirmed task creation to recheck.");
    scope.update({ checking: true, candidates: [] });
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
      scope.update({ candidates });
      return candidates;
    } finally {
      scope.update({ checking: false });
    }
  }, [scope]);
  const adoptCreation = useCallback(
    async (taskId: string) => {
      assertCurrentSession(scope.session);
      const { selected: attempt, busy, checking, candidates } = scope.getSnapshot();
      if (!attempt || busy || checking || !candidates.some((task) => task.id === taskId))
        throw new Error("Recheck creation and select a matching task first.");
      scope.update({ checking: true });
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
        scope.removeAttempt(attempt.draftId);
        scope.update({ candidates: [] });
        await queryClient.invalidateQueries({
          queryKey: scope.session ? ["tasks", scope.session.userId] : ["tasks"],
        });
        assertCurrentSession(scope.session);
        return task;
      } finally {
        scope.update({ checking: false });
      }
    },
    [scope, queryClient]
  );

  const isActiveScope = auth === undefined || !!session?.isCurrent();
  const ownsMutation = mutation.variables?.scope === scope && isActiveScope;
  return {
    mutate,
    mutateAsync,
    isLoading: isActiveScope && state.busy,
    error: state.storageError ?? (ownsMutation ? (mutation.error ?? null) : null),
    creationUncertain: !state.busy && state.selected !== null,
    pendingAttempt: state.selected,
    pendingAttempts: state.attempts,
    checkCreation,
    adoptCreation,
    selectAttempt,
    retryRecovery: scope.retryRecovery,
    isCheckingCreation: state.checking,
    recoveryReadFailed: state.storageError !== null,
  };
}
