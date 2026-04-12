/**
 * Task API Client
 *
 * Client for task CRUD operations with Sprint 2 enhancements.
 * Handles filtering, sorting, and metadata updates.
 *
 * @module services/api/taskClient
 */

import type { TaskCategory, TaskFilter, TaskPriority, TaskSort } from "../../types/task";
import type { components } from "../../types/api.generated";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/**
 * Task record from the API (Sprint 2 enhanced).
 */
export interface TaskRecord {
  /** Unique task identifier */
  id: string;
  /** Task title */
  title: string;
  /** Markdown content of the task */
  content: string;
  /** Lock IDs applied to task content */
  lock_ids: string[];
  /** Task category */
  category: TaskCategory;
  /** Task priority */
  priority: TaskPriority;
  /** Due date (ISO string, null if none) */
  due_date: string | null;
  /** Word count */
  word_count: number;
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
    title: task.title,
    content: task.content,
    lock_ids: task.lock_ids,
    category: task.category as TaskCategory,
    priority: task.priority as TaskPriority,
    due_date: task.due_date || null,
    word_count: task.word_count,
    created_at: task.created_at,
    updated_at: task.updated_at,
    version: task.version,
  };
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
 * Fetch a paginated list of tasks with optional filtering and sorting.
 *
 * @param options - Query options (pagination, filters, sort)
 * @returns Paginated task list
 * @throws {TaskAPIError} If fetch fails
 *
 * @example
 * ```ts
 * // Fetch all tasks
 * const page1 = await fetchTasks({ limit: 10, offset: 0 });
 *
 * // Fetch with filters
 * const filtered = await fetchTasks({
 *   filter: { categories: [TaskCategory.WRITING], overdueOnly: true },
 *   sort: { field: "due_date", order: "asc" }
 * });
 * ```
 */
export interface FetchTasksOptions {
  limit?: number;
  offset?: number;
  filter?: TaskFilter;
  sort?: TaskSort;
}

export async function fetchTasks(options: FetchTasksOptions = {}): Promise<TaskListResponse> {
  const { limit = 100, offset = 0, filter, sort } = options;
  const url = new URL(`${API_BASE_URL}/tasks/`);

  url.searchParams.set("limit", limit.toString());
  url.searchParams.set("offset", offset.toString());

  // Add filters
  if (filter?.categories?.length) {
    filter.categories.forEach((cat) => url.searchParams.append("category", cat));
  }
  if (filter?.priorities?.length) {
    filter.priorities.forEach((pri) => url.searchParams.append("priority", pri));
  }
  if (filter?.dueBefore) {
    url.searchParams.set("due_before", filter.dueBefore);
  }
  if (filter?.dueAfter) {
    url.searchParams.set("due_after", filter.dueAfter);
  }
  if (filter?.overdueOnly) {
    url.searchParams.set("overdue", "true");
  }
  if (filter?.searchQuery) {
    url.searchParams.set("search", filter.searchQuery);
  }

  // Add sort
  if (sort) {
    url.searchParams.set("sort_by", sort.field);
    url.searchParams.set("sort_order", sort.order);
  }

  const res = await fetch(url.toString(), {
    credentials: "include",
  });

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
  const res = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new TaskAPIError(res.status, "Failed to fetch task");
  }
  const data = (await res.json()) as ApiTaskResponse;
  return mapTask(data);
}

/**
 * Create a new task (Sprint 2 enhanced).
 *
 * @param params - Task creation parameters
 * @returns Created task record
 * @throws {TaskAPIError} If creation fails
 *
 * @example
 * ```ts
 * const task = await createTask({
 *   content: '# My Story',
 *   category: TaskCategory.WRITING,
 *   priority: TaskPriority.HIGH,
 *   dueDate: '2025-12-31T23:59:59Z'
 * });
 * ```
 */
export interface CreateTaskParams {
  content: string;
  lockIds?: string[];
  category?: TaskCategory;
  priority?: TaskPriority;
  dueDate?: string | null;
}

export async function createTask(params: CreateTaskParams): Promise<TaskRecord> {
  const { content, lockIds = [], category, priority, dueDate } = params;

  const res = await fetch(`${API_BASE_URL}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      content,
      lock_ids: lockIds,
      category,
      priority,
      due_date: dueDate,
    }),
  });

  if (!res.ok) {
    throw new TaskAPIError(res.status, "Failed to create task");
  }
  const data = (await res.json()) as ApiTaskResponse;
  return mapTask(data);
}

/**
 * Update an existing task with optimistic locking (Sprint 2 enhanced).
 *
 * @param taskId - Task identifier
 * @param params - Update parameters
 * @returns Updated task record
 * @throws {TaskAPIError} If version conflict (409) or update fails
 */
export interface UpdateTaskParams {
  content: string;
  lockIds: string[];
  version: number;
  category?: TaskCategory;
  priority?: TaskPriority;
  dueDate?: string | null;
}

export async function updateTask(
  taskId: string,
  params: UpdateTaskParams
): Promise<TaskRecord> {
  const { content, lockIds, version, category, priority, dueDate } = params;

  const res = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      content,
      lock_ids: lockIds,
      version,
      category,
      priority,
      due_date: dueDate,
    }),
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

/**
 * Update only task metadata (category, priority, due_date) without version check.
 *
 * @param taskId - Task identifier
 * @param params - Metadata update parameters
 * @returns Updated task record
 * @throws {TaskAPIError} If task not found
 */
export interface UpdateTaskMetadataParams {
  category?: TaskCategory;
  priority?: TaskPriority;
  dueDate?: string | null;
}

export async function updateTaskMetadata(
  taskId: string,
  params: UpdateTaskMetadataParams
): Promise<TaskRecord> {
  const res = await fetch(`${API_BASE_URL}/tasks/${taskId}/metadata`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    throw new TaskAPIError(res.status, "Failed to update task metadata");
  }

  const data = (await res.json()) as ApiTaskResponse;
  return mapTask(data);
}

/**
 * Delete a task.
 *
 * @param taskId - Task identifier
 * @throws {TaskAPIError} If task not found
 */
export async function deleteTask(taskId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!res.ok) {
    throw new TaskAPIError(res.status, "Failed to delete task");
  }
}
