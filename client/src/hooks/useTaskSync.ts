/**
 * Task Sync Hook
 *
 * React hook for synchronizing editor content with task API.
 * Handles optimistic locking, conflict resolution, and local caching.
 *
 * @module hooks/useTaskSync
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createTask,
  fetchTask,
  updateTask,
  TaskAPIError,
  type TaskRecord,
} from "../services/api/taskClient";

const LOCAL_CACHE_KEY = "impetus.task.cache";
const LOCAL_META_KEY = "impetus.task.meta";

/**
 * Error message constants for task synchronization.
 *
 * Centralized error messages to enable consistent error handling
 * and future internationalization (i18n) support.
 */
export const TaskSyncErrorMessages = {
  /** Network connectivity error */
  NETWORK_ERROR: "Network connection failed. Please check your internet connection.",

  /** Server-side error (5xx) */
  SERVER_ERROR: "Server error occurred. Please try again later.",

  /** Task loading failure */
  LOAD_FAILED: "Failed to load task. Please try again.",

  /** Version conflict during save */
  CONFLICT_REFRESHED: "Content refreshed due to newer version on server.",
  CONFLICT_REFRESH_FAILED: "Version conflict; could not refresh latest content.",

  /** Save operation failure */
  SAVE_FAILED: "Save failed. Changes kept locally.",

  /** API unavailable (fallback to local) */
  API_UNAVAILABLE: "Task API unavailable. Using local draft.",

  /** Generic fallback error */
  GENERIC_ERROR: "An unexpected error occurred. Please try again.",
} as const;

/**
 * Error type classification for task sync operations.
 */
export type TaskSyncErrorType =
  | "network"
  | "server"
  | "conflict"
  | "auth"
  | "validation"
  | "unknown";

/**
 * Classify an error into a specific type.
 *
 * @param error - Error to classify
 * @returns Error type classification
 */
function classifyError(error: unknown): TaskSyncErrorType {
  if (error instanceof TaskAPIError) {
    if (error.status >= 500) return "server";
    if (error.status === 409) return "conflict";
    if (error.status === 401 || error.status === 403) return "auth";
    if (error.status === 422) return "validation";
    return "unknown";
  }

  // Network errors (fetch failures, timeouts, etc.)
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return "network";
  }

  return "unknown";
}

/**
 * Get user-friendly error message for an error.
 *
 * @param error - Error to get message for
 * @param context - Additional context for the error
 * @returns User-friendly error message
 */
function getErrorMessage(error: unknown, context?: { operation?: "load" | "save" }): string {
  const errorType = classifyError(error);

  switch (errorType) {
    case "network":
      return TaskSyncErrorMessages.NETWORK_ERROR;
    case "server":
      return TaskSyncErrorMessages.SERVER_ERROR;
    case "conflict":
      return TaskSyncErrorMessages.CONFLICT_REFRESHED;
    case "auth":
      return "Authentication failed. Please sign in again.";
    case "validation":
      return "Invalid data. Please check your input and try again.";
    default: {
      const operation = context?.operation;
      if (operation === "load") {
        return TaskSyncErrorMessages.LOAD_FAILED;
      }
      return TaskSyncErrorMessages.GENERIC_ERROR;
    }
  }
}

/**
 * Sync status for task operations.
 */
type Status = "loading" | "ready" | "error";

/**
 * Task sync state returned by the hook.
 */
export interface TaskSyncState {
  /** Current markdown content */
  content: string;
  /** Lock IDs applied to content */
  lockIds: string[];
  /** Current task ID (null if not synced) */
  taskId: string | null;
  /** Optimistic lock version */
  version: number;
  /** Sync status */
  status: Status;
  /** Error message if status is 'error' */
  error: string | null;
  /** Whether save operation is in progress */
  isSaving: boolean;
  /** Callback for content changes (debounced auto-save) */
  onChange: (markdown: string, lockIds: string[]) => void;
}

/**
 * Options for useTaskSync hook.
 */
export interface UseTaskSyncOptions {
  /** External task ID to load. When changed, the hook will load the new task. */
  externalTaskId?: string | null;
}

/**
 * React hook for syncing editor content with task API.
 *
 * Provides automatic debounced saving, optimistic locking,
 * conflict resolution, and local caching fallback.
 *
 * @param defaultContent - Default content for new tasks
 * @param options - Optional configuration
 * @returns Task sync state and onChange handler
 *
 * @example
 * ```tsx
 * function Editor() {
 *   const { content, isSaving, onChange, status } = useTaskSync('# Default content');
 *
 *   return (
 *     <textarea
 *       value={content}
 *       onChange={(e) => onChange(e.target.value, [])}
 *       disabled={status === 'loading'}
 *     />
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Load external task
 * function TaskEditor({ taskId }) {
 *   const { content, onChange } = useTaskSync('', { externalTaskId: taskId });
 *   // When taskId changes, hook loads new task content
 * }
 * ```
 */
export function useTaskSync(defaultContent: string, options?: UseTaskSyncOptions): TaskSyncState {
  const { externalTaskId } = options || {};
  const [content, setContent] = useState(defaultContent);
  const [lockIds, setLockIds] = useState<string[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [version, setVersion] = useState<number>(0);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const pending = useRef<{ content: string; lockIds: string[] } | null>(null);
  const saveTimer = useRef<number | null>(null);
  const isLoadingExternal = useRef(false);

  const cacheLocal = useCallback((nextContent: string) => {
    try {
      localStorage.setItem(LOCAL_CACHE_KEY, nextContent);
    } catch {
      // Ignore cache failures
    }
  }, []);

  const cacheMeta = useCallback((meta: { taskId: string; version: number }) => {
    try {
      localStorage.setItem(LOCAL_META_KEY, JSON.stringify(meta));
    } catch {
      // Ignore cache failures
    }
  }, []);

  const loadFromCache = useCallback(() => {
    try {
      const cachedContent = localStorage.getItem(LOCAL_CACHE_KEY);
      if (cachedContent) {
        setContent(cachedContent);
      }
    } catch {
      // Ignore cache failures
    }
  }, []);

  const loadTask = useCallback(
    async (id: string) => {
      if (isLoadingExternal.current) return;
      isLoadingExternal.current = true;
      setStatus("loading");
      try {
        const existing = await fetchTask(id);
        setTaskId(existing.id);
        setContent(existing.content);
        setLockIds(existing.lock_ids || []);
        setVersion(existing.version);
        cacheMeta({ taskId: existing.id, version: existing.version });
        setError(null);
        setStatus("ready");
      } catch (err) {
        const message = getErrorMessage(err, { operation: "load" });
        setError(message);
        setStatus("error");
      } finally {
        isLoadingExternal.current = false;
      }
    },
    [cacheMeta]
  );

  const bootstrap = useCallback(async () => {
    setStatus("loading");
    try {
      const cachedMetaRaw = localStorage.getItem(LOCAL_META_KEY);
      const cachedMeta = cachedMetaRaw ? (JSON.parse(cachedMetaRaw) as { taskId?: string }) : null;

      if (cachedMeta?.taskId) {
        const existing = await fetchTask(cachedMeta.taskId);
        setTaskId(existing.id);
        setContent(existing.content);
        setLockIds(existing.lock_ids || []);
        setVersion(existing.version);
        setStatus("ready");
        return;
      }

      const created = await createTask(defaultContent, []);
      setTaskId(created.id);
      setContent(created.content);
      setLockIds(created.lock_ids || []);
      setVersion(created.version);
      cacheMeta({ taskId: created.id, version: created.version });
      setStatus("ready");
    } catch {
      loadFromCache();
      setError(TaskSyncErrorMessages.API_UNAVAILABLE);
      setStatus("error");
    }
  }, [cacheMeta, defaultContent, loadFromCache]);

  // Handle external task ID changes (when user selects a task from the list)
  useEffect(() => {
    if (externalTaskId && externalTaskId !== taskId) {
      void loadTask(externalTaskId);
    }
  }, [externalTaskId, taskId, loadTask]);

  // Initial bootstrap (only if no external task ID is provided)
  useEffect(() => {
    if (!externalTaskId) {
      void bootstrap();
    }
    return () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
    };
  }, [externalTaskId, bootstrap]);

  const persist = useCallback(
    async (payload: { content: string; lockIds: string[] }) => {
      setIsSaving(true);
      try {
        let record: TaskRecord;
        if (!taskId) {
          record = await createTask(payload.content, payload.lockIds);
          setTaskId(record.id);
        } else {
          record = await updateTask(taskId, payload.content, payload.lockIds, version);
        }

        setVersion(record.version);
        setLockIds(record.lock_ids || []);
        cacheMeta({ taskId: record.id, version: record.version });
        setError(null);
      } catch (err) {
        const errorType = classifyError(err);

        if (errorType === "conflict" && taskId) {
          try {
            const latest = await fetchTask(taskId);
            setContent(latest.content);
            setLockIds(latest.lock_ids || []);
            setVersion(latest.version);
            setError(TaskSyncErrorMessages.CONFLICT_REFRESHED);
          } catch {
            setError(TaskSyncErrorMessages.CONFLICT_REFRESH_FAILED);
          }
        } else {
          const message = getErrorMessage(err, { operation: "save" });
          setError(message);
        }
      } finally {
        setIsSaving(false);
      }
    },
    [cacheMeta, taskId, version]
  );

  const onChange = useCallback(
    (markdown: string, locks: string[]) => {
      setContent(markdown);
      setLockIds(locks);
      cacheLocal(markdown);
      pending.current = { content: markdown, lockIds: locks };
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
      saveTimer.current = window.setTimeout(() => {
        if (pending.current) {
          void persist(pending.current);
          pending.current = null;
        }
      }, 800);
    },
    [cacheLocal, persist]
  );

  return {
    content,
    lockIds,
    taskId,
    version,
    status,
    error,
    isSaving,
    onChange,
  };
}
