import { useCallback, useEffect, useRef, useState } from "react";
import { createTask, fetchTask, updateTask, TaskAPIError, type TaskRecord } from "../services/api/taskClient";

const LOCAL_CACHE_KEY = "impetus.task.cache";
const LOCAL_META_KEY = "impetus.task.meta";

type Status = "loading" | "ready" | "error";

export interface TaskSyncState {
  content: string;
  lockIds: string[];
  taskId: string | null;
  version: number;
  status: Status;
  error: string | null;
  isSaving: boolean;
  onChange: (markdown: string, lockIds: string[]) => void;
}

export function useTaskSync(defaultContent: string): TaskSyncState {
  const [content, setContent] = useState(defaultContent);
  const [lockIds, setLockIds] = useState<string[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [version, setVersion] = useState<number>(0);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const pending = useRef<{ content: string; lockIds: string[] } | null>(null);
  const saveTimer = useRef<number | null>(null);

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
    } catch (err) {
      loadFromCache();
      setError("Task API unavailable. Using local draft.");
      setStatus("error");
    }
  }, [cacheMeta, defaultContent, loadFromCache]);

  useEffect(() => {
    void bootstrap();
    return () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
    };
  }, [bootstrap]);

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
