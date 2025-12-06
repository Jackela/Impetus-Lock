import type { components } from "../../types/api.generated";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface TaskRecord {
  id: string;
  content: string;
  lock_ids: string[];
  created_at: string;
  updated_at: string;
  version: number;
}

type ApiTaskResponse = components["schemas"]["TaskResponse"];

export class TaskAPIError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "TaskAPIError";
  }
}

function mapTask(task: ApiTaskResponse): TaskRecord {
  return {
    id: task.id,
    content: task.content,
    lock_ids: task.lock_ids,
    created_at: task.created_at,
    updated_at: task.updated_at,
    version: task.version,
  };
}

export async function fetchTask(taskId: string): Promise<TaskRecord> {
  const res = await fetch(`${API_BASE_URL}/tasks/${taskId}`);
  if (!res.ok) {
    throw new TaskAPIError(res.status, "Failed to fetch task");
  }
  const data = (await res.json()) as ApiTaskResponse;
  return mapTask(data);
}

export async function createTask(content: string, lockIds: string[]): Promise<TaskRecord> {
  const res = await fetch(`${API_BASE_URL}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, lock_ids: lockIds }),
  });
  if (!res.ok) {
    throw new TaskAPIError(res.status, "Failed to create task");
  }
  const data = (await res.json()) as ApiTaskResponse;
  return mapTask(data);
}

export async function updateTask(
  taskId: string,
  content: string,
  lockIds: string[],
  version: number
): Promise<TaskRecord> {
  const res = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, lock_ids: lockIds, version }),
  });

  if (res.status === 409) {
    throw new TaskAPIError(res.status, "Version conflict", "version_conflict");
  }

  if (!res.ok) {
    throw new TaskAPIError(res.status, "Failed to update task");
  }

  const data = (await res.json()) as ApiTaskResponse;
  return mapTask(data);
}
