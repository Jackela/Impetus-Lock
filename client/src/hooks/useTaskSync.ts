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
import type { TaskRecord } from "../services/api/taskClient";
import type { RemoteSession } from "../services/api/remoteSession";
import {
  newDraftId,
  readOwnedDraft,
  writeOwnedDraft,
  type DraftSnapshot,
} from "../services/draftStore";

const LOCAL_CACHE_KEY = "impetus.task.cache";
const LOCAL_META_KEY = "impetus.task.meta";

type Draft = { content: string; lockIds: string[] };
type TaskDraft = Draft & {
  draftId: string;
  updatedAt: number;
  ownerId?: string | null;
  session?: RemoteSession | null;
  stopped?: boolean;
  conflict: DraftConflict | null;
  storageError: boolean;
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
  STORAGE_FAILED:
    "Local draft could not be saved on this device. Keep this page open and retry or export your draft.",
  CONFLICT_REQUIRED:
    "The server has a different version. Your local draft and locks are kept. Choose the server version or save as a new draft.",
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
  if (error instanceof TaskAPIError && error.status === 403) {
    return "Permission or CSRF verification failed. Your local draft is kept.";
  }
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

/** Both versions remain available until the user makes an explicit choice. */
export interface DraftConflict {
  local: DraftSnapshot;
  server: TaskRecord | null;
}

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
  /** Local changes still awaiting a successful server acknowledgement. */
  hasUnsavedChanges: boolean;
  /** Callback for content changes (debounced auto-save) */
  onChange: (markdown: string, lockIds: string[]) => void;
  /** Stable local identity for editor and asynchronous change callbacks. */
  draftIdentity: string;
  conflict: DraftConflict | null;
  retry: () => void | Promise<void>;
  flushLocal: () => void;
  resolveConflict: (choice: "server" | "new") => void | Promise<void>;
  createLocalDraft: (content: string, lockIds: string[]) => void;
}

/**
 * Options for useTaskSync hook.
 */
export interface UseTaskSyncOptions {
  /** External task ID to load. When changed, the hook will load the new task. */
  externalTaskId?: string | null;
  userId?: string | null;
  /** Undefined retains the legacy test contract; null explicitly pauses remote work. */
  session?: RemoteSession | null;
  registerSnapshot?: (callback: () => void) => () => void;
  /** Actual editor validation must permit each candidate before a remote write. */
  canSave?: (draftIdentity: string, content: string, lockIds: string[]) => boolean;
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
  const { externalTaskId, userId, session, registerSnapshot, canSave } = options || {};
  const context = useRef({ userId, session, canSave });
  context.current = { userId, session, canSave };
  const [content, setContent] = useState(defaultContent);
  const [lockIds, setLockIds] = useState<string[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [conflict, setConflict] = useState<DraftConflict | null>(null);
  const makeDraft = useCallback(
    (id: string | null = null, snapshot?: DraftSnapshot): TaskDraft => ({
      draftId: snapshot?.draftId ?? newDraftId(),
      updatedAt: snapshot?.updatedAt ?? Date.now(),
      ownerId: context.current.userId,
      session: context.current.session,
      taskId: id ?? snapshot?.taskId ?? null,
      version: snapshot?.version ?? 0,
      versionKnown: snapshot?.versionKnown ?? false,
      content: snapshot?.content ?? defaultContent,
      lockIds: snapshot?.lockIds ?? [],
      pending: snapshot?.dirty ? { content: snapshot.content, lockIds: snapshot.lockIds } : null,
      timer: null,
      saving: false,
      dirty: snapshot?.dirty ?? false,
      status: context.current.session === null ? "ready" : "loading",
      error: null,
      conflict: null,
      storageError: false,
    }),
    [defaultContent]
  );
  const active = useRef<TaskDraft | null>(null);
  if (!active.current) active.current = makeDraft();
  const [draftIdentity, setDraftIdentity] = useState(active.current.draftId);
  const mounted = useRef(true);
  const bootstrapStarted = useRef(false);
  const drafts = useRef(new Map<string, TaskDraft>());
  const binding = useRef({ userId, session });
  const snapshotOf = useCallback(
    (draft: TaskDraft): DraftSnapshot => ({
      draftId: draft.draftId,
      content: draft.content,
      lockIds: [...draft.lockIds],
      taskId: draft.taskId,
      version: draft.version,
      versionKnown: draft.versionKnown,
      dirty: draft.dirty,
      updatedAt: draft.updatedAt,
    }),
    []
  );
  const sameOwner = useCallback((draft: TaskDraft) => draft.ownerId === context.current.userId, []);
  const remoteAllowed = useCallback(
    (draft: TaskDraft) => {
      if (!sameOwner(draft) || draft.stopped) return false;
      if (draft.ownerId === undefined && context.current.session === undefined) return true;
      const scope = draft.session;
      return (
        mounted.current &&
        Boolean(
          scope &&
          scope === context.current.session &&
          scope.userId === draft.ownerId &&
          scope.isCurrent() &&
          !scope.signal.aborted
        )
      );
    },
    [sameOwner]
  );
  const visible = useCallback(
    (draft: TaskDraft) => mounted.current && active.current === draft && sameOwner(draft),
    [sameOwner]
  );
  const requestOptions = useCallback(
    (draft: TaskDraft) =>
      draft.session ? { signal: draft.session.signal, session: draft.session } : undefined,
    []
  );
  const writeLocal = useCallback(
    (draft: TaskDraft) => {
      if (!sameOwner(draft)) return;
      if (typeof draft.ownerId === "string") writeOwnedDraft(draft.ownerId, snapshotOf(draft));
      else if (draft.ownerId === undefined) {
        localStorage.removeItem(LOCAL_META_KEY);
        localStorage.setItem(LOCAL_CACHE_KEY, draft.content);
        if (draft.taskId)
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
      draft.storageError = false;
    },
    [sameOwner, snapshotOf]
  );
  const cacheDraft = useCallback(
    (draft: TaskDraft) => {
      if (!sameOwner(draft) || (draft.ownerId === undefined && !visible(draft))) return;
      try {
        writeLocal(draft);
      } catch {
        draft.storageError = true;
        draft.error = TaskSyncErrorMessages.STORAGE_FAILED;
        if (visible(draft)) setError(draft.error);
      }
    },
    [sameOwner, visible, writeLocal]
  );
  const showDraft = useCallback(
    (draft: TaskDraft) => {
      if (!visible(draft)) return;
      setDraftIdentity(draft.draftId);
      setTaskId(draft.taskId);
      setContent(draft.content);
      setLockIds(draft.lockIds);
      setVersion(draft.version);
      setError(draft.error);
      setStatus(draft.status);
      setIsSaving(draft.saving && remoteAllowed(draft));
      setConflict(draft.conflict);
      if (draft.status !== "loading") cacheDraft(draft);
    },
    [cacheDraft, remoteAllowed, visible]
  );
  const mayWrite = useCallback(
    (draft: TaskDraft, candidate: Draft) => {
      try {
        return (
          context.current.canSave?.(draft.draftId, candidate.content, [...candidate.lockIds]) ??
          true
        );
      } catch (validationError) {
        draft.error =
          validationError instanceof Error ? validationError.message : String(validationError);
        cacheDraft(draft);
        if (visible(draft)) setError(draft.error);
        return false;
      }
    },
    [cacheDraft, visible]
  );
  const persist = useCallback(
    async (draft: TaskDraft) => {
      if (
        !remoteAllowed(draft) ||
        draft.status === "loading" ||
        (draft.taskId && !draft.versionKnown) ||
        draft.saving ||
        !draft.pending ||
        draft.conflict
      )
        return;
      const requestSession = draft.session;
      const allowed = () => remoteAllowed(draft) && draft.session === requestSession;
      draft.saving = true;
      if (visible(draft)) setIsSaving(true);
      try {
        while (draft.pending && allowed() && !draft.conflict) {
          const payload = draft.pending;
          if (!mayWrite(draft, payload)) return;
          // Validation may itself invalidate a session or synchronously update
          // the editor, so retain a newer queue instead of sending this candidate.
          if (!allowed() || draft.pending !== payload) return;
          draft.pending = null;
          try {
            if (!allowed()) return;
            const record = draft.taskId
              ? await updateTask(
                  draft.taskId,
                  { ...payload, version: draft.version },
                  requestOptions(draft)
                )
              : await createTask(payload, requestOptions(draft));
            if (!allowed()) return;
            draft.taskId = record.id;
            draft.version = record.version;
            draft.versionKnown = true;
            draft.dirty = draft.pending !== null;
            draft.status = "ready";
            draft.updatedAt = Date.now();
            draft.error = draft.storageError ? TaskSyncErrorMessages.STORAGE_FAILED : null;
            drafts.current.set(record.id, draft);
            cacheDraft(draft);
            showDraft(draft);
          } catch (err) {
            if (!allowed()) return;
            if (classifyError(err) === "conflict" && draft.taskId) {
              draft.pending = null;
              if (draft.timer) window.clearTimeout(draft.timer);
              draft.timer = null;
              let latest: TaskRecord | null = null;
              try {
                if (!allowed()) return;
                latest = await fetchTask(draft.taskId, requestOptions(draft));
                if (!allowed()) return;
              } catch {
                if (!allowed()) return;
              }
              draft.pending = null;
              if (draft.timer) window.clearTimeout(draft.timer);
              draft.timer = null;
              if (draft.ownerId !== undefined) {
                draft.conflict = { local: snapshotOf(draft), server: latest };
                draft.error = TaskSyncErrorMessages.CONFLICT_REQUIRED;
              } else {
                if (latest) draft.version = latest.version;
                draft.error = latest
                  ? TaskSyncErrorMessages.CONFLICT_REFRESHED
                  : TaskSyncErrorMessages.CONFLICT_REFRESH_FAILED;
              }
              cacheDraft(draft);
              showDraft(draft);
              break;
            }
            draft.error = getErrorMessage(err, { operation: "save" });
            cacheDraft(draft);
            showDraft(draft);
          }
        }
      } finally {
        if (draft.session === requestSession) {
          draft.saving = false;
          if (visible(draft)) setIsSaving(false);
        }
      }
    },
    [cacheDraft, mayWrite, remoteAllowed, requestOptions, showDraft, snapshotOf, visible]
  );
  const adoptTask = useCallback(
    (record: TaskRecord, draft: TaskDraft) => {
      if (!remoteAllowed(draft)) return;
      if (
        draft.ownerId !== undefined &&
        draft.dirty &&
        draft.versionKnown &&
        draft.version !== record.version
      ) {
        draft.conflict = { local: snapshotOf(draft), server: record };
        draft.pending = null;
        draft.status = "ready";
        draft.error = TaskSyncErrorMessages.CONFLICT_REQUIRED;
        showDraft(draft);
        return;
      }
      Object.assign(draft, {
        taskId: record.id,
        version: record.version,
        versionKnown: true,
        content: draft.dirty ? draft.content : record.content,
        lockIds: draft.dirty ? draft.lockIds : record.lock_ids || [],
        status: "ready",
        error: draft.storageError ? TaskSyncErrorMessages.STORAGE_FAILED : null,
      });
      drafts.current.set(record.id, draft);
      showDraft(draft);
      if (draft.timer === null) void persist(draft);
    },
    [persist, remoteAllowed, showDraft, snapshotOf]
  );
  const readOwned = useCallback((id?: string | null) => {
    if (typeof context.current.userId !== "string") return null;
    try {
      return readOwnedDraft(context.current.userId, id);
    } catch {
      return null;
    }
  }, []);
  const loadTask = useCallback(
    async (id: string, force = false) => {
      if (active.current!.taskId === id && !force) return;
      const previous = active.current!;
      if (previous.timer) window.clearTimeout(previous.timer);
      previous.timer = null;
      if (remoteAllowed(previous)) void persist(previous);
      cacheDraft(previous);
      const cached = drafts.current.get(id);
      const retained =
        cached && !cached.stopped && (cached.saving || cached.dirty || cached.status === "loading")
          ? cached
          : null;
      const draft = retained ?? makeDraft(id, readOwned(id) ?? undefined);
      active.current = draft;
      drafts.current.set(id, draft);
      const needsLoad = force || !retained || (!draft.versionKnown && draft.status !== "loading");
      if (needsLoad) draft.status = remoteAllowed(draft) ? "loading" : "ready";
      showDraft(draft);
      if (!needsLoad || !remoteAllowed(draft)) return;
      const requestSession = draft.session;
      const allowed = () => remoteAllowed(draft) && draft.session === requestSession;
      try {
        const record = await fetchTask(id, requestOptions(draft));
        if (!allowed()) return;
        adoptTask(record, draft);
      } catch (err) {
        if (!allowed()) return;
        draft.error = getErrorMessage(err, { operation: "load" });
        draft.status = "error";
        showDraft(draft);
      }
    },
    [adoptTask, cacheDraft, makeDraft, persist, readOwned, remoteAllowed, requestOptions, showDraft]
  );
  const bootstrap = useCallback(async () => {
    if (bootstrapStarted.current || !remoteAllowed(active.current!)) return;
    bootstrapStarted.current = true;
    let draft = active.current!;
    let cachedContent: string | null = null;
    const requestSession = draft.session;
    const allowed = () => remoteAllowed(draft) && draft.session === requestSession;
    try {
      if (draft.ownerId !== undefined) {
        if (!draft.dirty) {
          const owned = readOwned();
          if (owned) {
            draft = makeDraft(null, owned);
            active.current = draft;
          }
        }
        if (draft.dirty) draft.pending = { content: draft.content, lockIds: draft.lockIds };
        draft.status = "loading";
        showDraft(draft);
      } else {
        cachedContent = localStorage.getItem(LOCAL_CACHE_KEY);
        const raw = localStorage.getItem(LOCAL_META_KEY);
        const meta = raw
          ? (JSON.parse(raw) as {
              taskId?: string;
              version?: number | null;
              pendingLockIds?: string[];
            })
          : null;
        if (meta?.taskId) {
          draft.taskId = meta.taskId;
          draft.version = meta.version ?? 0;
          draft.versionKnown =
            typeof meta.version === "number" && Number.isInteger(meta.version) && meta.version >= 0;
          if (
            !draft.versionKnown &&
            cachedContent !== null &&
            Array.isArray(meta.pendingLockIds) &&
            meta.pendingLockIds.every((id) => typeof id === "string")
          ) {
            draft.content = cachedContent;
            draft.lockIds = meta.pendingLockIds;
            draft.dirty = true;
            draft.pending = { content: cachedContent, lockIds: draft.lockIds };
            showDraft(draft);
          }
        }
      }
      if (draft.taskId) drafts.current.set(draft.taskId, draft);
      if (!allowed()) return;
      const creating = !draft.taskId;
      const initial = { content: draft.content, lockIds: [...draft.lockIds] };
      if (creating && !mayWrite(draft, initial)) {
        draft.pending = { content: draft.content, lockIds: [...draft.lockIds] };
        draft.dirty = true;
        draft.status = "ready";
        showDraft(draft);
        return;
      }
      if (!allowed()) return;
      if (creating && draft.ownerId !== undefined) draft.pending = null;
      const record = draft.taskId
        ? await fetchTask(draft.taskId, requestOptions(draft))
        : await createTask(initial, requestOptions(draft));
      if (!allowed()) return;
      if (
        creating &&
        draft.ownerId !== undefined &&
        draft.content === initial.content &&
        JSON.stringify(draft.lockIds) === JSON.stringify(initial.lockIds)
      )
        draft.dirty = false;
      adoptTask(record, draft);
    } catch (err) {
      if (!allowed()) return;
      draft.error = TaskSyncErrorMessages.API_UNAVAILABLE;
      draft.status = "error";
      if (draft.ownerId === undefined && !draft.dirty && cachedContent !== null) {
        draft.content = cachedContent;
        draft.dirty = true;
      }
      if (draft.ownerId !== undefined && draft.dirty)
        draft.pending = { content: draft.content, lockIds: draft.lockIds };
      if (draft.ownerId !== undefined && err instanceof TaskAPIError && err.status === 403)
        draft.error = "Permission or CSRF verification failed. Your local draft is kept.";
      showDraft(draft);
    }
  }, [adoptTask, makeDraft, mayWrite, readOwned, remoteAllowed, requestOptions, showDraft]);
  useEffect(() => {
    mounted.current = true;
    const allDrafts = drafts.current;
    return () => {
      mounted.current = false;
      for (const draft of new Set([active.current!, ...allDrafts.values()])) {
        if (draft.timer) window.clearTimeout(draft.timer);
        draft.timer = null;
      }
      if (active.current!.ownerId === undefined) void persist(active.current!);
    };
  }, [persist]);
  useEffect(() => {
    const changed = binding.current.userId !== userId || binding.current.session !== session;
    if (changed) {
      const previousOwner = binding.current.userId;
      for (const draft of new Set([active.current!, ...drafts.current.values()])) {
        if (draft.timer) window.clearTimeout(draft.timer);
        draft.timer = null;
        draft.stopped = true;
      }
      if (previousOwner !== userId) {
        drafts.current.clear();
        active.current = makeDraft();
      } else {
        const draft = active.current!;
        draft.session = session;
        draft.stopped = false;
        draft.saving = false;
        draft.pending = draft.dirty ? { content: draft.content, lockIds: draft.lockIds } : null;
        draft.status = session === null ? "ready" : "loading";
      }
      bootstrapStarted.current = false;
      binding.current = { userId, session };
      showDraft(active.current!);
    }
    if (session === null || (userId !== undefined && !session)) {
      active.current!.status = "ready";
      showDraft(active.current!);
      return;
    }
    if (externalTaskId) void loadTask(externalTaskId, changed);
    else void bootstrap();
  }, [bootstrap, externalTaskId, loadTask, makeDraft, session, showDraft, userId]);
  const flushLocal = useCallback(() => {
    const draft = active.current!;
    try {
      // Retry all owned in-memory snapshots, including an earlier task whose
      // quota failure could otherwise be hidden after the user selected another.
      const retained = draft.ownerId === undefined ? [] : [...new Set(drafts.current.values())];
      for (const previous of retained) {
        if (previous !== draft && sameOwner(previous)) writeLocal(previous);
      }
      writeLocal(draft);
      if (draft.error === TaskSyncErrorMessages.STORAGE_FAILED) draft.error = null;
      showDraft(draft);
    } catch (err) {
      draft.storageError = true;
      draft.error = TaskSyncErrorMessages.STORAGE_FAILED;
      if (visible(draft)) setError(draft.error);
      throw err;
    }
  }, [sameOwner, showDraft, visible, writeLocal]);
  useEffect(() => registerSnapshot?.(flushLocal), [flushLocal, registerSnapshot]);
  const onChange = useCallback(
    (markdown: string, locks: string[]) => {
      const draft = active.current!;
      if (draft.draftId !== draftIdentity || !sameOwner(draft)) return;
      draft.content = markdown;
      draft.lockIds = [...locks];
      draft.dirty = true;
      draft.updatedAt = Date.now();
      setContent(markdown);
      setLockIds(draft.lockIds);
      draft.pending = { content: markdown, lockIds: draft.lockIds };
      if (draft.conflict) {
        draft.conflict = { ...draft.conflict, local: snapshotOf(draft) };
        setConflict(draft.conflict);
      }
      cacheDraft(draft);
      if (draft.timer) window.clearTimeout(draft.timer);
      draft.timer = null;
      if (remoteAllowed(draft) && !draft.conflict)
        draft.timer = window.setTimeout(() => {
          draft.timer = null;
          if (remoteAllowed(draft)) void persist(draft);
        }, 800);
    },
    [cacheDraft, draftIdentity, persist, remoteAllowed, sameOwner, snapshotOf]
  );
  const createLocalDraft = useCallback(
    (markdown: string, locks: string[]) => {
      const previous = active.current!;
      cacheDraft(previous);
      drafts.current.set(previous.taskId ?? `local:${previous.draftId}`, previous);
      if (previous.timer) window.clearTimeout(previous.timer);
      previous.timer = null;
      const draft = makeDraft();
      draft.content = markdown;
      draft.lockIds = [...locks];
      draft.dirty = true;
      draft.pending = { content: markdown, lockIds: draft.lockIds };
      draft.status = "ready";
      active.current = draft;
      bootstrapStarted.current = true;
      showDraft(draft);
      if (remoteAllowed(draft)) void persist(draft);
    },
    [cacheDraft, makeDraft, persist, remoteAllowed, showDraft]
  );
  const resolveConflict = useCallback(
    (choice: "server" | "new") => {
      const draft = active.current!;
      if (!draft.conflict || !sameOwner(draft) || (choice === "server" && !draft.conflict.server))
        return;
      if (typeof draft.ownerId === "string") {
        try {
          writeOwnedDraft(draft.ownerId, {
            ...snapshotOf(draft),
            draftId: newDraftId(),
            recoveryOf: draft.draftId,
          });
        } catch (err) {
          draft.storageError = true;
          draft.error = TaskSyncErrorMessages.STORAGE_FAILED;
          showDraft(draft);
          throw err;
        }
      }
      if (choice === "new") {
        createLocalDraft(draft.content, draft.lockIds);
        return;
      }
      const server = draft.conflict.server!;
      draft.content = server.content;
      draft.lockIds = [...server.lock_ids];
      draft.version = server.version;
      draft.versionKnown = true;
      draft.taskId = server.id;
      draft.dirty = false;
      draft.pending = null;
      draft.conflict = null;
      draft.error = null;
      draft.status = "ready";
      draft.updatedAt = Date.now();
      showDraft(draft);
    },
    [createLocalDraft, sameOwner, showDraft, snapshotOf]
  );
  const retry = useCallback(async () => {
    const draft = active.current!;
    flushLocal();
    const requestSession = draft.session;
    const allowed = () => remoteAllowed(draft) && draft.session === requestSession;
    if (!allowed()) return;
    // Editor readiness cannot substitute for the still-pending server version
    // check or start another create while bootstrap is in flight.
    if (draft.status === "loading") return;
    if (draft.conflict) {
      if (!draft.conflict.server && draft.taskId) {
        try {
          const server = await fetchTask(draft.taskId, requestOptions(draft));
          if (!allowed()) return;
          draft.conflict = { local: snapshotOf(draft), server };
          showDraft(draft);
        } catch {
          if (allowed()) showDraft(draft);
        }
      }
      return;
    }
    if (draft.taskId && (!draft.versionKnown || draft.status === "error")) {
      await loadTask(draft.taskId, true);
      return;
    }
    draft.pending = draft.dirty ? { content: draft.content, lockIds: draft.lockIds } : null;
    draft.status = "ready";
    await persist(draft);
  }, [flushLocal, loadTask, persist, remoteAllowed, requestOptions, showDraft, snapshotOf]);
  const owned = active.current!.ownerId === userId;
  return {
    content: owned ? content : defaultContent,
    lockIds: owned ? lockIds : [],
    taskId: owned ? taskId : null,
    version: owned ? version : 0,
    status: owned ? status : "loading",
    error: owned ? error : null,
    isSaving: owned && isSaving && session !== null,
    hasUnsavedChanges: owned && (active.current!.dirty || active.current!.pending !== null),
    onChange,
    draftIdentity: owned ? draftIdentity : "",
    conflict: owned ? conflict : null,
    retry,
    flushLocal,
    resolveConflict,
    createLocalDraft,
  };
}
