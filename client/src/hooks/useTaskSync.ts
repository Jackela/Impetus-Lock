/**
 * Task Sync Hook
 *
 * React hook for synchronizing editor content with task API.
 * Handles optimistic locking, conflict resolution, and local caching.
 *
 * @module hooks/useTaskSync
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createTask, fetchTask, updateTask, TaskAPIError } from "../services/api/taskClient";

const LOCAL_CACHE_KEY = "impetus.task.cache";
const LOCAL_META_KEY = "impetus.task.meta";

type Draft = { content: string; lockIds: string[] };
type TaskDraft = Draft & {
  taskId: string | null;
  version: number;
  versionKnown: boolean;
  pending: Draft | null;
  timer: number | null;
  saving: boolean;
  dirty: boolean;
  status: Status;
  error: string | null;
};

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
  CONFLICT_REFRESHED:
    "Version conflict. Local draft kept; edit again to retry with the latest version.",
  CONFLICT_REFRESH_FAILED:
    "Version conflict. Local draft kept; could not refresh the server version.",

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
  "network" | "server" | "conflict" | "auth" | "validation" | "unknown";

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
 * @param context.operation - Task operation the error occurred during
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

  const active = useRef<TaskDraft>({
    taskId: null,
    version: 0,
    versionKnown: false,
    content: defaultContent,
    lockIds: [],
    pending: null,
    timer: null,
    saving: false,
    dirty: false,
    status: "loading",
    error: null,
  });
  const mounted = useRef(true);
  const bootstrapStarted = useRef(false);
  const drafts = useRef(new Map<string, TaskDraft>());

  const cacheDraft = useCallback((draft: TaskDraft) => {
    if (!mounted.current || active.current !== draft) return;
    try {
      // Remove old metadata first so a storage failure cannot pair another
      // task's identity with this content.
      localStorage.removeItem(LOCAL_META_KEY);
      localStorage.setItem(LOCAL_CACHE_KEY, draft.content);
      if (draft.taskId) {
        localStorage.setItem(
          LOCAL_META_KEY,
          JSON.stringify({
            taskId: draft.taskId,
            version: draft.versionKnown ? draft.version : null,
            ...(!draft.versionKnown && draft.pending
              ? { pendingLockIds: draft.pending.lockIds }
              : {}),
          })
        );
      }
    } catch {
      // Ignore cache failures.
    }
  }, []);

  const persist = useCallback(
    async (draft: TaskDraft) => {
      // Failed loads also leave an existing task's version unknown; retain its queue.
      if (
        draft.status === "loading" ||
        (draft.taskId && !draft.versionKnown) ||
        draft.saving ||
        !draft.pending
      )
        return;
      draft.saving = true;
      const visible = () => mounted.current && active.current === draft;
      if (visible()) setIsSaving(true);
      try {
        while (draft.pending) {
          const payload = draft.pending;
          draft.pending = null;
          try {
            const record = draft.taskId
              ? await updateTask(draft.taskId, { ...payload, version: draft.version })
              : await createTask(payload);
            draft.taskId = record.id;
            draft.version = record.version;
            draft.versionKnown = true;
            draft.dirty = draft.pending !== null;
            draft.error = null;
            draft.status = "ready";
            drafts.current.set(record.id, draft);
            if (visible()) {
              setTaskId(record.id);
              setVersion(record.version);
              cacheDraft(draft);
              setError(null);
              setStatus("ready");
            }
          } catch (err) {
            if (classifyError(err) === "conflict" && draft.taskId) {
              draft.pending = null;
              if (draft.timer) window.clearTimeout(draft.timer);
              let message: string = TaskSyncErrorMessages.CONFLICT_REFRESHED;
              try {
                const latest = await fetchTask(draft.taskId);
                draft.version = latest.version;
              } catch {
                message = TaskSyncErrorMessages.CONFLICT_REFRESH_FAILED;
              }
              // Typing during the refresh remains local until a deliberate retry.
              draft.pending = null;
              if (draft.timer) window.clearTimeout(draft.timer);
              draft.error = message;
              if (visible()) {
                setVersion(draft.version);
                cacheDraft(draft);
                setError(message);
              }
              break;
            }
            draft.error = getErrorMessage(err, { operation: "save" });
            if (visible()) setError(draft.error);
            // A newer queued draft may still be drained after a failed older save.
          }
        }
      } finally {
        draft.saving = false;
        if (visible()) setIsSaving(false);
      }
    },
    [cacheDraft]
  );

  const showDraft = useCallback(
    (draft: TaskDraft) => {
      if (!mounted.current || active.current !== draft) return;
      setTaskId(draft.taskId);
      setContent(draft.content);
      setLockIds(draft.lockIds);
      setVersion(draft.version);
      setError(draft.error);
      setStatus(draft.status);
      setIsSaving(draft.saving);
      if (draft.status !== "loading") cacheDraft(draft);
    },
    [cacheDraft]
  );

  const adoptTask = useCallback(
    (record: Awaited<ReturnType<typeof fetchTask>>, draft: TaskDraft) => {
      Object.assign(draft, {
        taskId: record.id,
        version: record.version,
        versionKnown: true,
        content: draft.dirty ? draft.content : record.content,
        lockIds: draft.dirty ? draft.lockIds : record.lock_ids || [],
        status: "ready",
        error: null,
      });
      drafts.current.set(record.id, draft);
      showDraft(draft);
      // A due save (including switch/unmount cleanup) resumes after loading.
      // A still-running debounce must keep its original deadline.
      if (draft.timer === null) void persist(draft);
    },
    [persist, showDraft]
  );

  const loadFromCache = useCallback(
    (draft: TaskDraft, cachedContent: string | null) => {
      if (!draft.dirty && cachedContent !== null) {
        draft.content = cachedContent;
        // Retain recovered content across selection changes without queuing a write.
        draft.dirty = true;
      }
      showDraft(draft);
    },
    [showDraft]
  );

  const loadTask = useCallback(
    async (id: string) => {
      if (active.current.taskId === id) return;
      const previous = active.current;
      if (previous.timer) window.clearTimeout(previous.timer);
      previous.timer = null;
      void persist(previous);
      const cached = drafts.current.get(id);
      const retained =
        cached && (cached.saving || cached.dirty || cached.status === "loading") ? cached : null;
      const draft: TaskDraft = retained ?? {
        taskId: id,
        version: 0,
        versionKnown: false,
        content: defaultContent,
        lockIds: [],
        pending: null,
        timer: null,
        saving: false,
        dirty: false,
        status: "loading",
        error: null,
      };
      active.current = draft;
      drafts.current.set(id, draft);
      const needsLoad = !retained || (!draft.versionKnown && draft.status !== "loading");
      if (needsLoad) draft.status = "loading";
      showDraft(draft);
      if (!needsLoad) return;
      try {
        const record = await fetchTask(id);
        adoptTask(record, draft);
      } catch (err) {
        draft.error = getErrorMessage(err, { operation: "load" });
        draft.status = "error";
        showDraft(draft);
      }
    },
    [adoptTask, defaultContent, persist, showDraft]
  );

  const bootstrap = useCallback(async () => {
    if (bootstrapStarted.current) return;
    bootstrapStarted.current = true;
    const draft = active.current;
    setStatus("loading");
    let cachedContent: string | null = null;
    try {
      // Capture content with its metadata before another selection changes storage.
      cachedContent = localStorage.getItem(LOCAL_CACHE_KEY);
      const cachedMetaRaw = localStorage.getItem(LOCAL_META_KEY);
      const cachedMeta = cachedMetaRaw
        ? (JSON.parse(cachedMetaRaw) as {
            taskId?: string;
            version?: number | null;
            pendingLockIds?: string[];
          })
        : null;
      if (cachedMeta?.taskId) {
        draft.taskId = cachedMeta.taskId;
        draft.version = cachedMeta.version ?? 0;
        draft.versionKnown =
          typeof cachedMeta.version === "number" &&
          Number.isInteger(cachedMeta.version) &&
          cachedMeta.version >= 0;
        // Only a recorded edit authorizes restoring a queue; a failed load's
        // untouched placeholder must yield to the eventual server response.
        if (
          !draft.versionKnown &&
          cachedContent !== null &&
          Array.isArray(cachedMeta.pendingLockIds) &&
          cachedMeta.pendingLockIds.every((id) => typeof id === "string")
        ) {
          draft.content = cachedContent;
          draft.lockIds = cachedMeta.pendingLockIds;
          draft.dirty = true;
          draft.pending = { content: cachedContent, lockIds: draft.lockIds };
          showDraft(draft);
        }
        drafts.current.set(cachedMeta.taskId, draft);
      }
      const record = cachedMeta?.taskId
        ? await fetchTask(cachedMeta.taskId)
        : await createTask({ content: defaultContent, lockIds: [] });
      adoptTask(record, draft);
    } catch {
      draft.error = TaskSyncErrorMessages.API_UNAVAILABLE;
      draft.status = "error";
      loadFromCache(draft, cachedContent);
    }
  }, [adoptTask, defaultContent, loadFromCache, showDraft]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const draft = active.current;
      if (draft.timer) window.clearTimeout(draft.timer);
      draft.timer = null;
      void persist(draft);
    };
  }, [persist]);

  useEffect(() => {
    if (externalTaskId) void loadTask(externalTaskId);
    else void bootstrap();
  }, [externalTaskId, loadTask, bootstrap]);

  const onChange = useCallback(
    (markdown: string, locks: string[]) => {
      const draft = active.current;
      draft.content = markdown;
      draft.lockIds = [...locks];
      draft.dirty = true;
      setContent(markdown);
      setLockIds(draft.lockIds);
      draft.pending = { content: markdown, lockIds: draft.lockIds };
      cacheDraft(draft);
      if (draft.timer) window.clearTimeout(draft.timer);
      draft.timer = window.setTimeout(() => {
        draft.timer = null;
        void persist(draft);
      }, 800);
    },
    [cacheDraft, persist]
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
