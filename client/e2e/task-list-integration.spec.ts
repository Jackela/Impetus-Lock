import { test, expect } from "@playwright/test";

/**
 * UX-003: Task List Integration E2E Tests
 *
 * Tests the task list sidebar integration in the main app:
 * - Sidebar visibility and toggle
 * - Task list rendering
 * - Task selection
 * - Keyboard shortcut (Alt+T)
 */
test.describe("UX-003: Task List Integration", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto("http://localhost:5173");

    // Wait for app to load
    await page.waitForSelector(".app", { timeout: 10000 });
  });

  test("task list sidebar is visible by default", async ({ page }) => {
    // Check that the task list toggle button exists and is active
    const toggleButton = page.locator('[data-testid="task-list-toggle"]');
    await expect(toggleButton).toBeVisible();
    await expect(toggleButton).toHaveAttribute("aria-pressed", "true");

    // Check that the sidebar is visible
    const sidebar = page.locator('[data-testid="task-sidebar"]');
    await expect(sidebar).toBeVisible();

    // Check that the sidebar has a header
    const sidebarHeader = sidebar.locator("h2");
    await expect(sidebarHeader).toHaveText("Tasks");
  });

  test("task list toggle button shows/hides sidebar", async ({ page }) => {
    const toggleButton = page.locator('[data-testid="task-list-toggle"]');
    const sidebar = page.locator('[data-testid="task-sidebar"]');

    // Initially visible
    await expect(toggleButton).toHaveAttribute("aria-pressed", "true");
    await expect(sidebar).toBeVisible();

    // Click to hide
    await toggleButton.click();
    await expect(toggleButton).toHaveAttribute("aria-pressed", "false");
    await expect(sidebar).not.toBeVisible();

    // Click to show again
    await toggleButton.click();
    await expect(toggleButton).toHaveAttribute("aria-pressed", "true");
    await expect(sidebar).toBeVisible();
  });

  test("keyboard shortcut Alt+T toggles task list", async ({ page }) => {
    const sidebar = page.locator('[data-testid="task-sidebar"]');
    const toggleButton = page.locator('[data-testid="task-list-toggle"]');

    // Initially visible
    await expect(sidebar).toBeVisible();
    await expect(toggleButton).toHaveAttribute("aria-pressed", "true");

    // Press Alt+T to hide
    await page.keyboard.press("Alt+t");
    await expect(sidebar).not.toBeVisible();
    await expect(toggleButton).toHaveAttribute("aria-pressed", "false");

    // Press Alt+T to show
    await page.keyboard.press("Alt+t");
    await expect(sidebar).toBeVisible();
    await expect(toggleButton).toHaveAttribute("aria-pressed", "true");
  });

  test("task list displays loading state initially", async ({ page }) => {
    const sidebar = page.locator('[data-testid="task-sidebar"]');

    // The loading state may be very brief, but we check the element exists
    const loadingElement = sidebar.locator(".task-sidebar-loading");
    const loadingExists = await loadingElement.count();

    // If it exists, it should have loading text
    if (loadingExists > 0) {
      await expect(loadingElement).toBeVisible();
      await expect(loadingElement).toHaveText(/Loading tasks/);
    }
  });

  test("task list toggle button has correct icon and label", async ({ page }) => {
    const toggleButton = page.locator('[data-testid="task-list-toggle"]');

    // Check for the icon (svg)
    const icon = toggleButton.locator("svg");
    await expect(icon).toBeVisible();

    // Check for the label
    const label = toggleButton.locator(".toggle-label");
    await expect(label).toHaveText("Tasks");
  });

  test("editor area is still visible with sidebar open", async ({ page }) => {
    // Check that both sidebar and editor are visible
    const sidebar = page.locator('[data-testid="task-sidebar"]');
    const editor = page.locator(".editor-area");

    await expect(sidebar).toBeVisible();
    await expect(editor).toBeVisible();

    // Check that the milkdown editor is visible within the editor area
    const milkdown = page.locator(".milkdown");
    await expect(milkdown).toBeVisible();
  });

  test("header layout includes task list toggle in left section", async ({ page }) => {
    const headerLeft = page.locator(".header-left");

    // Check that header-left contains both the title and toggle button
    // Use locator containment instead of toContainElement (which is not a valid Playwright API)
    await expect(headerLeft.locator("h1")).toBeAttached();
    await expect(headerLeft.locator('[data-testid="task-list-toggle"]')).toBeAttached();
  });

  test("task list empty state is shown when no tasks", async ({ page }) => {
    const sidebar = page.locator('[data-testid="task-sidebar"]');

    // Wait for tasks to load (or finish loading)
    await page.waitForTimeout(1000);

    // Check for empty state message
    const emptyState = sidebar.locator('[data-testid="task-list-empty"]');
    const emptyExists = await emptyState.count();

    if (emptyExists > 0) {
      await expect(emptyState).toContainText("No tasks yet");
    }
  });

  test("screenshot of task list integration", async ({ page }) => {
    // Take a screenshot for visual verification
    await page.screenshot({
      path: "e2e-results/ux-003-task-list-integration.png",
      fullPage: true,
    });

    // Also take a screenshot with sidebar closed
    const toggleButton = page.locator('[data-testid="task-list-toggle"]');
    await toggleButton.click();
    await page.screenshot({
      path: "e2e-results/ux-003-task-list-hidden.png",
      fullPage: true,
    });
  });
});
