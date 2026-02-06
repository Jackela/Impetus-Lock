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
        setError(err instanceof Error ? err.message : "Failed to load task");
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
      setError("Task API unavailable. Using local draft.");
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
        if (err instanceof TaskAPIError && err.status === 409 && taskId) {
          try {
            const latest = await fetchTask(taskId);
            setContent(latest.content);
            setLockIds(latest.lock_ids || []);
            setVersion(latest.version);
            setError("Content refreshed due to newer version on server.");
          } catch {
            setError("Version conflict; could not refresh latest content.");
          }
        } else {
          setError("Save failed. Changes kept locally.");
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
