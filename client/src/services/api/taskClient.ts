/**
 * Task API Client
 *
 * Client for task CRUD operations with optimistic locking support.
 * Handles fetch, create, update, and list operations for tasks.
 *
 * @module services/api/taskClient
 */

import type { components } from "../../types/api.generated";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/**
 * Task record from the API.
 */
export interface TaskRecord {
  /** Unique task identifier */
  id: string;
  /** Markdown content of the task */
  content: string;
  /** Lock IDs applied to task content */
  lock_ids: string[];
  /** ISO timestamp of task creation */
  created_at: string;
  /** ISO timestamp of last update */
  updated_at: string;
  /** Optimistic lock version */
  version: number;
}

type ApiTaskResponse = components["schemas"]["TaskResponse"];

/**
 * Error class for Task API operations.
 *
 * Includes HTTP status code and optional error code.
 */
export class TaskAPIError extends Error {
  /**
   * Creates a new TaskAPIError.
   *
   * @param status - HTTP status code
   * @param message - Error message
   * @param code - Optional error code (e.g., "version_conflict")
   */
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "TaskAPIError";
  }
}

/**
 * Map API response to TaskRecord.
 *
 * @param task - API task response
 * @returns Mapped task record
 */
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

/**
 * Fetch a single task by ID.
 *
 * @param taskId - Task identifier
 * @returns Task record
 * @throws {TaskAPIError} If task not found (404) or fetch fails
 *
 * @example
 * ```ts
 * const task = await fetchTask('task_123');
 * console.log(task.content);
 * ```
 */
export async function fetchTask(taskId: string): Promise<TaskRecord> {
  const res = await fetch(`${API_BASE_URL}/tasks/${taskId}`);
  if (!res.ok) {
    throw new TaskAPIError(res.status, "Failed to fetch task");
  }
  const data = (await res.json()) as ApiTaskResponse;
  return mapTask(data);
}

/**
 * Response from task list endpoint with pagination metadata.
 */
export interface TaskListResponse {
  /** Total number of tasks */
  total: number;
  /** Max tasks per page */
  limit: number;
  /** Number of tasks skipped */
  offset: number;
  /** Array of tasks */
  tasks: TaskRecord[];
}

/**
 * Fetch a paginated list of tasks.
 *
 * @param limit - Maximum tasks to return (default: 100)
 * @param offset - Number of tasks to skip (default: 0)
 * @returns Paginated task list
 * @throws {TaskAPIError} If fetch fails
 *
 * @example
 * ```ts
 * const page1 = await fetchTasks(10, 0); // First 10 tasks
 * const page2 = await fetchTasks(10, 10); // Next 10 tasks
 * ```
 */
export async function fetchTasks(
  limit: number = 100,
  offset: number = 0
): Promise<TaskListResponse> {
  const url = new URL(`${API_BASE_URL}/tasks/`);
  if (limit > 0) url.searchParams.set("limit", limit.toString());
  if (offset > 0) url.searchParams.set("offset", offset.toString());

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new TaskAPIError(res.status, "Failed to fetch tasks");
  }

  const data = (await res.json()) as {
    total: number;
    limit: number;
    offset: number;
    tasks: ApiTaskResponse[];
  };

  return {
    total: data.total,
    limit: data.limit,
    offset: data.offset,
    tasks: data.tasks.map(mapTask),
  };
}

/**
 * Create a new task.
 *
 * @param content - Markdown content for the task
 * @param lockIds - Lock IDs to apply to the task
 * @returns Created task record
 * @throws {TaskAPIError} If creation fails
 *
 * @example
 * ```ts
 * const task = await createTask('# New Task', []);
 * console.log('Created:', task.id);
 * ```
 */
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

/**
 * Update an existing task with optimistic locking.
 *
 * @param taskId - Task identifier
 * @param content - New markdown content
 * @param lockIds - Lock IDs for the task
 * @param version - Current version for optimistic locking
 * @returns Updated task record
 * @throws {TaskAPIError} If version conflict (409) or update fails
 *
 * @example
 * ```ts
 * try {
 *   const updated = await updateTask('task_123', '# Updated', [], 1);
 *   console.log('Updated to version:', updated.version);
 * } catch (err) {
 *   if (err instanceof TaskAPIError && err.code === 'version_conflict') {
 *     console.error('Task was modified by another client');
 *   }
 * }
 * ```
 */
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
