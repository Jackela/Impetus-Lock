/**
 * E2E Test: Create Task and Write Flow
 *
 * Tests the core user journey of creating a new task and writing content in the editor.
 * This is a critical user flow that validates:
 * - Task creation modal functionality
 * - Editor initialization
 * - Content typing and persistence
 *
 * Constitutional Compliance:
 * - Article III (TDD): Tests validate core user workflows
 * - Article V (Documentation): Comprehensive test documentation
 */

import { test, expect } from "@playwright/test";
import { waitForAppReady } from "./helpers/waitHelpers";

test.describe("Create Task and Write Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app and wait for it to be ready
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("should create a new task and open editor", async ({ page }) => {
    // Step 1: Click the new task button to open the creation modal
    const newTaskButton = page.getByTestId("new-task-button");
    await expect(newTaskButton).toBeVisible();
    await newTaskButton.click();

    // Step 2: Verify the create task modal appears
    const createTaskModal = page.getByTestId("create-task-modal");
    await expect(createTaskModal).toBeVisible({ timeout: 5000 });

    // Step 3: Enter task title in the input field
    const taskInput = page.getByTestId("create-task-input");
    await expect(taskInput).toBeVisible();
    const taskTitle = "Test Task for Writing";
    await taskInput.fill(taskTitle);

    // Step 4: Click the confirm button to create the task
    const confirmButton = page.getByTestId("create-task-confirm");
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    // Step 5: Verify the modal closes
    await expect(createTaskModal).not.toBeVisible({ timeout: 5000 });

    // Step 6: Verify the editor is ready for writing
    const editorReady = page.getByTestId("editor-ready");
    await expect(editorReady).toBeVisible();
  });

  test("should type text in editor and verify content saves", async ({ page }) => {
    // Step 1: Create a task first
    const newTaskButton = page.getByTestId("new-task-button");
    await newTaskButton.click();

    const taskInput = page.getByTestId("create-task-input");
    await taskInput.fill("Writing Test Task");
    await page.getByTestId("create-task-confirm").click();

    // Wait for modal to close and editor to be ready
    await expect(page.getByTestId("create-task-modal")).not.toBeVisible();
    await expect(page.getByTestId("editor-ready")).toBeVisible();

    // Step 2: Focus the editor and type content
    // The editor uses Milkdown/ProseMirror which requires special interaction
    const prosemirrorEditor = page.locator('.milkdown .ProseMirror[contenteditable="true"]');
    await expect(prosemirrorEditor).toBeVisible({ timeout: 10000 });

    // Click to focus the editor
    await prosemirrorEditor.click();

    // Step 3: Type test content
    const testContent =
      "This is a test sentence for our writing task. We are testing the editor functionality.";
    await page.keyboard.type(testContent);

    // Step 4: Verify the content appears in the editor
    const editorContent = await prosemirrorEditor.textContent();
    expect(editorContent).toContain("This is a test sentence");
    expect(editorContent).toContain("testing the editor functionality");

    // Step 5: Verify the save indicator appears (sync status)
    // Wait a moment for auto-save to trigger
    await page.waitForTimeout(1000);

    const syncStatus = page.locator(".task-status");
    const statusText = await syncStatus.textContent();
    // The status should indicate content is being saved or has been saved
    expect(statusText).toMatch(/(Saving|Synced|Loading)/i);
  });

  test("should handle validation error for empty task title", async ({ page }) => {
    // Step 1: Open the create task modal
    await page.getByTestId("new-task-button").click();

    const createTaskModal = page.getByTestId("create-task-modal");
    await expect(createTaskModal).toBeVisible();

    // Step 2: Try to submit without entering a title
    const confirmButton = page.getByTestId("create-task-confirm");

    // The button should be disabled when input is empty
    const isDisabled = await confirmButton.isDisabled();

    if (!isDisabled) {
      // If button is not disabled, clicking it should show validation error
      await confirmButton.click();

      // Step 3: Verify validation error appears
      const errorMessage = page.getByTestId("create-task-error");
      await expect(errorMessage).toBeVisible({ timeout: 3000 });
      const errorText = await errorMessage.textContent();
      expect(errorText).toMatch(/(enter|title|empty|required)/i);
    }
  });

  test("should cancel task creation and return to editor", async ({ page }) => {
    // Step 1: Open the create task modal
    await page.getByTestId("new-task-button").click();

    const createTaskModal = page.getByTestId("create-task-modal");
    await expect(createTaskModal).toBeVisible();

    // Step 2: Type something in the input
    const taskInput = page.getByTestId("create-task-input");
    await taskInput.fill("Draft Task Title");

    // Step 3: Click cancel button
    const cancelButton = page.getByTestId("create-task-cancel");
    await cancelButton.click();

    // Step 4: Verify modal closes and we're back to the editor
    await expect(createTaskModal).not.toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId("editor-ready")).toBeVisible();

    // Step 5: Verify no new task was created (task list should be unchanged)
    // If task list is visible, it shouldn't contain our draft title
    const taskList = page.getByTestId("task-list");
    if (await taskList.isVisible().catch(() => false)) {
      const listContent = await taskList.textContent();
      expect(listContent).not.toContain("Draft Task Title");
    }
  });

  test("should support keyboard shortcuts for task creation", async ({ page }) => {
    // Step 1: Open the create task modal
    await page.getByTestId("new-task-button").click();

    const createTaskModal = page.getByTestId("create-task-modal");
    await expect(createTaskModal).toBeVisible();

    // Step 2: Enter task title
    const taskInput = page.getByTestId("create-task-input");
    await taskInput.fill("Keyboard Shortcut Task");

    // Step 3: Press Enter to submit (simulating keyboard shortcut)
    await taskInput.press("Enter");

    // Step 4: Verify task is created (modal closes)
    await expect(createTaskModal).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("editor-ready")).toBeVisible();
  });

  test("should save content persistently across sessions", async ({ page }) => {
    // Step 1: Create a task and add content
    await page.getByTestId("new-task-button").click();
    await page.getByTestId("create-task-input").fill("Persistence Test Task");
    await page.getByTestId("create-task-confirm").click();

    await expect(page.getByTestId("create-task-modal")).not.toBeVisible();

    // Step 2: Type content in the editor
    const prosemirrorEditor = page.locator('.milkdown .ProseMirror[contenteditable="true"]');
    await prosemirrorEditor.click();

    const persistentContent = "This content should persist across reloads.";
    await page.keyboard.type(persistentContent);

    // Step 3: Wait for auto-save
    await page.waitForTimeout(1500);

    // Step 4: Reload the page
    await page.reload();
    await waitForAppReady(page);

    // Step 5: Verify the content is still there
    // The task should be automatically reloaded
    const restoredEditor = page.locator('.milkdown .ProseMirror[contenteditable="true"]');
    await expect(restoredEditor).toBeVisible({ timeout: 10000 });

    const restoredContent = await restoredEditor.textContent();
    expect(restoredContent).toContain("This content should persist");
  });
});

test.describe("Create Task - Error Handling", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("should handle network error during task creation gracefully", async ({ page }) => {
    // Step 1: Mock a network error for the task creation API
    await page.route("**/api/tasks", async (route) => {
      await route.abort("failed");
    });

    // Step 2: Attempt to create a task
    await page.getByTestId("new-task-button").click();
    await page.getByTestId("create-task-input").fill("Network Error Test Task");
    await page.getByTestId("create-task-confirm").click();

    // Step 3: Verify error is displayed to the user
    const errorMessage = page.getByTestId("create-task-error");
    await expect(errorMessage).toBeVisible({ timeout: 5000 });

    // Step 4: Verify user can retry (modal stays open, input preserved)
    const taskInput = page.getByTestId("create-task-input");
    const inputValue = await taskInput.inputValue();
    expect(inputValue).toBe("Network Error Test Task");
  });
});
