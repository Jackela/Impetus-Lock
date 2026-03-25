/**
 * Database Helper Functions for E2E Tests
 *
 * Provides utilities for:
 * - Resetting database state between tests
 * - Seeding test data
 * - Verifying database state
 * - Managing test isolation
 *
 * Constitutional Compliance:
 * - Article I (Simplicity): Simple, focused functions
 * - Article V (Documentation): Clear JSDoc for all functions
 */

import type { Page, APIRequestContext } from "@playwright/test";

// Backend API configuration
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const API_PREFIX = "/api";

/**
 * Database reset options
 */
export interface ResetOptions {
  /** Keep user accounts */
  keepUsers?: boolean;
  /** Keep system settings */
  keepSettings?: boolean;
  /** Specific tables to reset (if empty, resets all) */
  tables?: string[];
}

/**
 * Test data for seeding
 */
export interface TestTask {
  id?: string;
  content: string;
  status?: "pending" | "in_progress" | "completed" | "locked";
  lockId?: string;
  tags?: string[];
}

export interface TestStyle {
  id?: string;
  name: string;
  content: string;
  isDefault?: boolean;
}

export interface TestSeedData {
  tasks?: TestTask[];
  styles?: TestStyle[];
}

/**
 * Database verification check
 */
export interface DatabaseCheck {
  /** Entity type to check */
  entity: "task" | "style" | "setting";
  /** Filter conditions */
  filter?: Record<string, unknown>;
  /** Expected count (undefined = any count) */
  expectedCount?: number;
  /** Expected to exist */
  shouldExist?: boolean;
}

/**
 * Database state snapshot
 */
export interface DatabaseSnapshot {
  tasks: number;
  styles: number;
  timestamp: string;
}

/**
 * Reset database to clean state
 *
 * @param request - Playwright API request context
 * @param options - Reset options
 * @returns Promise resolving when reset is complete
 *
 * @example
 * ```typescript
 * test.beforeEach(async ({ request }) => {
 *   await resetDatabase(request, { keepUsers: true });
 * });
 * ```
 */
export async function resetDatabase(
  request: APIRequestContext,
  options: ResetOptions = {}
): Promise<void> {
  const { keepUsers = false, keepSettings = false, tables } = options;

  try {
    const response = await request.post(`${BACKEND_URL}/test/reset-db`, {
      data: { keepUsers, keepSettings, tables },
      headers: { "Content-Type": "application/json" },
    });

    if (response.status() === 404) {
      // Reset endpoint not available, try manual cleanup
      console.warn("Database reset endpoint not available, attempting manual cleanup");
      await manualReset(request);
      return;
    }

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(`Database reset failed: ${response.status()} - ${error}`);
    }

    console.log("✅ Database reset successfully");
  } catch (error) {
    console.warn("⚠️  Database reset failed (may be using in-memory mode):", error);
  }
}

/**
 * Manual database reset when endpoint is not available
 */
async function manualReset(request: APIRequestContext): Promise<void> {
  try {
    // Try to delete all tasks
    const tasksResponse = await request.get(`${BACKEND_URL}${API_PREFIX}/tasks`);
    if (tasksResponse.ok()) {
      const tasks = await tasksResponse.json();
      if (Array.isArray(tasks)) {
        for (const task of tasks) {
          if (task.id) {
            await request.delete(`${BACKEND_URL}${API_PREFIX}/tasks/${task.id}`);
          }
        }
      }
    }

    // Try to delete all styles (except defaults)
    const stylesResponse = await request.get(`${BACKEND_URL}${API_PREFIX}/styles`);
    if (stylesResponse.ok()) {
      const styles = await stylesResponse.json();
      if (Array.isArray(styles)) {
        for (const style of styles) {
          if (style.id && !style.isDefault) {
            await request.delete(`${BACKEND_URL}${API_PREFIX}/styles/${style.id}`);
          }
        }
      }
    }
  } catch (error) {
    console.warn("Manual reset failed:", error);
  }
}

/**
 * Seed test data into database
 *
 * @param request - Playwright API request context
 * @param data - Test data to seed
 * @returns Promise resolving when seeding is complete
 *
 * @example
 * ```typescript
 * await seedTestData(request, {
 *   tasks: [{ content: "Test task", status: "pending" }],
 *   styles: [{ name: "Test Style", content: "Style content" }],
 * });
 * ```
 */
export async function seedTestData(request: APIRequestContext, data: TestSeedData): Promise<void> {
  const errors: string[] = [];

  // Seed tasks
  if (data.tasks) {
    for (const task of data.tasks) {
      try {
        const response = await request.post(`${BACKEND_URL}${API_PREFIX}/tasks`, {
          data: {
            content: task.content,
            status: task.status || "pending",
            lock_id: task.lockId,
            tags: task.tags,
          },
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok()) {
          errors.push(`Failed to create task: ${await response.text()}`);
        }
      } catch (error) {
        errors.push(`Error creating task: ${error}`);
      }
    }
  }

  // Seed styles
  if (data.styles) {
    for (const style of data.styles) {
      try {
        const response = await request.post(`${BACKEND_URL}${API_PREFIX}/styles`, {
          data: {
            name: style.name,
            content: style.content,
            is_default: style.isDefault,
          },
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok()) {
          errors.push(`Failed to create style: ${await response.text()}`);
        }
      } catch (error) {
        errors.push(`Error creating style: ${error}`);
      }
    }
  }

  if (errors.length > 0) {
    console.warn("⚠️  Some test data could not be seeded:", errors);
  } else {
    console.log("✅ Test data seeded successfully");
  }
}

/**
 * Verify database state matches expectations
 *
 * @param request - Playwright API request context
 * @param check - Verification check to perform
 * @returns Promise resolving to true if check passes
 *
 * @example
 * ```typescript
 * const hasTasks = await verifyDatabaseState(request, {
 *   entity: "task",
 *   expectedCount: 2,
 * });
 * expect(hasTasks).toBe(true);
 * ```
 */
export async function verifyDatabaseState(
  request: APIRequestContext,
  check: DatabaseCheck
): Promise<boolean> {
  try {
    let endpoint: string;
    switch (check.entity) {
      case "task":
        endpoint = `${BACKEND_URL}${API_PREFIX}/tasks`;
        break;
      case "style":
        endpoint = `${BACKEND_URL}${API_PREFIX}/styles`;
        break;
      case "setting":
        endpoint = `${BACKEND_URL}${API_PREFIX}/settings`;
        break;
      default:
        throw new Error(`Unknown entity: ${check.entity}`);
    }

    const response = await request.get(endpoint);
    if (!response.ok()) {
      return false;
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return false;
    }

    // Apply filter if provided
    let filtered = data;
    if (check.filter) {
      filtered = data.filter((item) => {
        return Object.entries(check.filter!).every(([key, value]) => item[key] === value);
      });
    }

    // Check count
    if (check.expectedCount !== undefined) {
      return filtered.length === check.expectedCount;
    }

    // Check existence
    if (check.shouldExist !== undefined) {
      return check.shouldExist ? filtered.length > 0 : filtered.length === 0;
    }

    return true;
  } catch (error) {
    console.warn(`⚠️  Database verification failed: ${error}`);
    return false;
  }
}

/**
 * Get database snapshot for comparison
 *
 * @param request - Playwright API request context
 * @returns Promise resolving to database snapshot
 */
export async function getDatabaseSnapshot(request: APIRequestContext): Promise<DatabaseSnapshot> {
  let tasks = 0;
  let styles = 0;

  try {
    const tasksResponse = await request.get(`${BACKEND_URL}${API_PREFIX}/tasks`);
    if (tasksResponse.ok()) {
      const data = await tasksResponse.json();
      tasks = Array.isArray(data) ? data.length : 0;
    }
  } catch {
    // Ignore errors
  }

  try {
    const stylesResponse = await request.get(`${BACKEND_URL}${API_PREFIX}/styles`);
    if (stylesResponse.ok()) {
      const data = await stylesResponse.json();
      styles = Array.isArray(data) ? data.length : 0;
    }
  } catch {
    // Ignore errors
  }

  return {
    tasks,
    styles,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Clean up specific test data by IDs
 *
 * @param request - Playwright API request context
 * @param entity - Entity type
 * @param ids - IDs to delete
 *
 * @example
 * ```typescript
 * await cleanupTestData(request, "task", ["task-1", "task-2"]);
 * ```
 */
export async function cleanupTestData(
  request: APIRequestContext,
  entity: "task" | "style",
  ids: string[]
): Promise<void> {
  const endpoint = entity === "task" ? "tasks" : "styles";

  for (const id of ids) {
    try {
      await request.delete(`${BACKEND_URL}${API_PREFIX}/${endpoint}/${id}`);
    } catch (error) {
      console.warn(`Failed to delete ${entity} ${id}:`, error);
    }
  }
}

/**
 * Wait for database to be ready
 *
 * @param request - Playwright API request context
 * @param timeout - Maximum wait time in ms
 * @returns Promise resolving when database is ready
 */
export async function waitForDatabaseReady(
  request: APIRequestContext,
  timeout = 30000
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await request.get(`${BACKEND_URL}/health`);
      if (response.ok()) {
        console.log("✅ Database is ready");
        return;
      }
    } catch {
      // Keep trying
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Database not ready within ${timeout}ms`);
}

/**
 * Check if backend has database support
 *
 * @param request - Playwright API request context
 * @returns Promise resolving to true if database is available
 */
export async function hasDatabaseSupport(request: APIRequestContext): Promise<boolean> {
  try {
    const response = await request.get(`${BACKEND_URL}/health`);
    if (response.ok()) {
      const data = await response.json();
      // Check if database is mentioned in health response
      return data.database?.connected === true || data.status === "ok";
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Create a test isolation helper that automatically cleans up after tests
 *
 * @param request - Playwright API request context
 * @returns Object with setup and cleanup methods
 *
 * @example
 * ```typescript
 * test.describe("Feature Tests", () => {
 *   const isolation = createTestIsolation(request);
 *
 *   test.beforeEach(async () => {
 *     await isolation.setup();
 *   });
 *
 *   test.afterEach(async () => {
 *     await isolation.cleanup();
 *   });
 * });
 * ```
 */
export function createTestIsolation(request: APIRequestContext) {
  const createdIds: { tasks: string[]; styles: string[] } = {
    tasks: [],
    styles: [],
  };

  return {
    /**
     * Setup clean state before test
     */
    async setup(): Promise<void> {
      await resetDatabase(request);
      createdIds.tasks = [];
      createdIds.styles = [];
    },

    /**
     * Cleanup created test data
     */
    async cleanup(): Promise<void> {
      if (createdIds.tasks.length > 0) {
        await cleanupTestData(request, "task", createdIds.tasks);
        createdIds.tasks = [];
      }
      if (createdIds.styles.length > 0) {
        await cleanupTestData(request, "style", createdIds.styles);
        createdIds.styles = [];
      }
    },

    /**
     * Track created entity for cleanup
     */
    track(entity: "task" | "style", id: string): void {
      createdIds[entity === "task" ? "tasks" : "styles"].push(id);
    },
  };
}
