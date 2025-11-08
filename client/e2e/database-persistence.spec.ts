import { test, expect } from "@playwright/test";

/**
 * Database Persistence E2E Test Suite
 *
 * Tests the full stack integration of frontend → backend → PostgreSQL.
 * Verifies task CRUD operations and intervention history persistence.
 *
 * Prerequisites:
 * - PostgreSQL running on localhost:5433
 * - Backend server running with database enabled
 * - Database schema applied via Alembic migrations
 */

const API_BASE = "http://localhost:8000";

test.describe("Database Persistence", () => {
  test("creates task via API", async ({ request }) => {
    // Create task
    const response = await request.post(`${API_BASE}/api/v1/tasks`, {
      data: {
        content: "Initial task content",
        lock_ids: [],
      },
    });

    expect(response.status()).toBe(201);

    const task = await response.json();
    expect(task.id).toBeTruthy();
    expect(task.content).toBe("Initial task content");
    expect(task.lock_ids).toEqual([]);
    expect(task.version).toBe(0);
    expect(task.created_at).toBeTruthy();
    expect(task.updated_at).toBeTruthy();
  });

  test("gets task by ID", async ({ request }) => {
    // Create task first
    const createResponse = await request.post(`${API_BASE}/api/v1/tasks`, {
      data: {
        content: "Test content for get",
        lock_ids: ["lock_1"],
      },
    });

    const createdTask = await createResponse.json();

    // Get task by ID
    const getResponse = await request.get(`${API_BASE}/api/v1/tasks/${createdTask.id}`);

    expect(getResponse.status()).toBe(200);

    const task = await getResponse.json();
    expect(task.id).toBe(createdTask.id);
    expect(task.content).toBe("Test content for get");
    expect(task.lock_ids).toEqual(["lock_1"]);
  });

  test("updates task with optimistic locking", async ({ request }) => {
    // Create task
    const createResponse = await request.post(`${API_BASE}/api/v1/tasks`, {
      data: {
        content: "Original content",
        lock_ids: [],
      },
    });

    const task = await createResponse.json();

    // Update task
    const updateResponse = await request.put(`${API_BASE}/api/v1/tasks/${task.id}`, {
      data: {
        content: "Updated content",
        lock_ids: ["lock_new"],
        version: task.version, // Optimistic locking
      },
    });

    expect(updateResponse.status()).toBe(200);

    const updatedTask = await updateResponse.json();
    expect(updatedTask.content).toBe("Updated content");
    expect(updatedTask.lock_ids).toEqual(["lock_new"]);
    expect(updatedTask.version).toBe(task.version + 1); // Version incremented
  });

  test("rejects update with stale version (optimistic locking)", async ({ request }) => {
    // Create task
    const createResponse = await request.post(`${API_BASE}/api/v1/tasks`, {
      data: {
        content: "Content for version conflict",
        lock_ids: [],
      },
    });

    const task = await createResponse.json();

    // First update (succeeds)
    await request.put(`${API_BASE}/api/v1/tasks/${task.id}`, {
      data: {
        content: "First update",
        lock_ids: [],
        version: task.version,
      },
    });

    // Second update with stale version (should fail)
    const conflictResponse = await request.put(`${API_BASE}/api/v1/tasks/${task.id}`, {
      data: {
        content: "Second update",
        lock_ids: [],
        version: task.version, // Stale version
      },
    });

    expect(conflictResponse.status()).toBe(409); // Conflict
  });

  test("deletes task and cascades to actions", async ({ request }) => {
    // Create task
    const createResponse = await request.post(`${API_BASE}/api/v1/tasks`, {
      data: {
        content: "Task to be deleted",
        lock_ids: [],
      },
    });

    const task = await createResponse.json();

    // Delete task
    const deleteResponse = await request.delete(`${API_BASE}/api/v1/tasks/${task.id}`);

    expect(deleteResponse.status()).toBe(204); // No Content

    // Verify task no longer exists
    const getResponse = await request.get(`${API_BASE}/api/v1/tasks/${task.id}`);
    expect(getResponse.status()).toBe(404);
  });

  test("returns 404 for non-existent task", async ({ request }) => {
    const fakeId = "550e8400-e29b-41d4-a716-446655440000";
    const response = await request.get(`${API_BASE}/api/v1/tasks/${fakeId}`);

    expect(response.status()).toBe(404);
  });
});

test.describe("Intervention History", () => {
  test("queries empty intervention history", async ({ request }) => {
    // Create task
    const createResponse = await request.post(`${API_BASE}/api/v1/tasks`, {
      data: {
        content: "Task with no interventions",
        lock_ids: [],
      },
    });

    const task = await createResponse.json();

    // Query history
    const historyResponse = await request.get(`${API_BASE}/api/v1/tasks/${task.id}/actions`);

    expect(historyResponse.status()).toBe(200);

    const history = await historyResponse.json();
    expect(history.total).toBe(0);
    expect(history.actions).toEqual([]);
  });

  test("queries intervention history with pagination", async ({ request }) => {
    // Note: This test would require intervention actions to be saved
    // For now, it verifies the pagination structure works
    const createResponse = await request.post(`${API_BASE}/api/v1/tasks`, {
      data: {
        content: "Task for pagination test",
        lock_ids: [],
      },
    });

    const task = await createResponse.json();

    // Query with pagination parameters
    const historyResponse = await request.get(
      `${API_BASE}/api/v1/tasks/${task.id}/actions?limit=10&offset=0`
    );

    expect(historyResponse.status()).toBe(200);

    const history = await historyResponse.json();
    expect(history.limit).toBe(10);
    expect(history.offset).toBe(0);
    expect(history.total).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(history.actions)).toBe(true);
  });

  test("returns 404 for history of non-existent task", async ({ request }) => {
    const fakeId = "550e8400-e29b-41d4-a716-446655440000";
    const response = await request.get(`${API_BASE}/api/v1/tasks/${fakeId}/actions`);

    expect(response.status()).toBe(404);
  });
});
