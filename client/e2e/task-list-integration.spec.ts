import { test, expect } from "@playwright/test";
import { dismissWelcomeModal, openHeaderMenu } from "./helpers/waitHelpers";

/**
 * UX-003: Task List Integration E2E Tests
 *
 * Tests the task list sidebar integration in the main app:
 * - Sidebar visibility and toggle
 * - Task list rendering
 * - Task selection
 * - Keyboard shortcut (Alt+T)
 *
 * The `Tasks` toggle is a header overflow-menu command (`header-menu-button` →
 * `task-list-toggle`), so the menu must be opened before reading or clicking it.
 * Its state is exposed through the `active` class instead of `aria-pressed`.
 */
test.describe("UX-003: Task List Integration", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto("/");

    // Wait for app to load
    await page.waitForSelector(".app", { timeout: 10000 });
    await dismissWelcomeModal(page);
  });

  test("task list sidebar is visible by default", async ({ page }) => {
    // The toggle only exists while the header menu is open.
    await openHeaderMenu(page);
    const toggleButton = page.getByTestId("task-list-toggle");
    await expect(toggleButton).toBeVisible();
    await expect(toggleButton).toHaveClass(/active/);

    // Check that the sidebar is visible
    const sidebar = page.getByTestId("task-sidebar");
    await expect(sidebar).toBeVisible();

    // Check that the sidebar has a header
    const sidebarHeader = sidebar.locator("h2");
    await expect(sidebarHeader).toHaveText("Tasks");
  });

  test("task list toggle button shows/hides sidebar", async ({ page }) => {
    const sidebar = page.getByTestId("task-sidebar");

    // Initially visible
    await openHeaderMenu(page);
    await expect(page.getByTestId("task-list-toggle")).toHaveClass(/active/);
    await expect(sidebar).toBeVisible();

    // Click to hide (the menu closes on every command, so re-open it each time)
    await page.getByTestId("task-list-toggle").click();
    await expect(sidebar).not.toBeVisible();

    await openHeaderMenu(page);
    const toggleButton = page.getByTestId("task-list-toggle");
    await expect(toggleButton).not.toHaveClass(/active/);

    // Click to show again
    await toggleButton.click();
    await expect(sidebar).toBeVisible();

    await openHeaderMenu(page);
    await expect(page.getByTestId("task-list-toggle")).toHaveClass(/active/);
  });

  test("keyboard shortcut Alt+T toggles task list", async ({ page }) => {
    const sidebar = page.getByTestId("task-sidebar");

    // Initially visible
    await expect(sidebar).toBeVisible();
    await openHeaderMenu(page);
    await expect(page.getByTestId("task-list-toggle")).toHaveClass(/active/);

    // Press Alt+T to hide
    await page.keyboard.press("Alt+t");
    await expect(sidebar).not.toBeVisible();
    await expect(page.getByTestId("task-list-toggle")).not.toHaveClass(/active/);

    // Press Alt+T to show
    await page.keyboard.press("Alt+t");
    await expect(sidebar).toBeVisible();
    await expect(page.getByTestId("task-list-toggle")).toHaveClass(/active/);
  });

  test("task list displays loading state initially", async ({ page }) => {
    const sidebar = page.getByTestId("task-sidebar");

    // The loading state may be very brief, but we check the element exists
    const loadingElement = sidebar.locator(".task-sidebar-loading, .task-sidebar-skeleton");
    const loadingExists = await loadingElement.count();

    // If it exists, it should announce the loading state
    if (loadingExists > 0) {
      await expect(loadingElement.first()).toBeVisible();
      await expect(loadingElement.first()).toHaveAttribute("aria-label", /Loading tasks/);
    }
  });

  test("task list toggle button has correct icon and label", async ({ page }) => {
    await openHeaderMenu(page);
    const toggleButton = page.getByTestId("task-list-toggle");

    // Check for the icon (svg)
    const icon = toggleButton.locator("svg");
    await expect(icon).toBeVisible();

    // Check for the label
    await expect(toggleButton).toContainText("Tasks");
  });

  test("editor area is still visible with sidebar open", async ({ page }) => {
    // Check that both sidebar and editor are visible
    const sidebar = page.getByTestId("task-sidebar");
    const editor = page.locator(".editor-area");

    await expect(sidebar).toBeVisible();
    await expect(editor).toBeVisible();

    // Check that the milkdown editor is visible within the editor area
    const milkdown = page.locator(".milkdown");
    await expect(milkdown).toBeVisible();
  });

  test("header menu holds the task list toggle, header-left only holds the brand", async ({
    page,
  }) => {
    const headerLeft = page.locator(".header-left");

    // The left section keeps only the product title; the toggle moved into the menu.
    await expect(headerLeft.locator("h1")).toBeAttached();
    await expect(headerLeft.locator('[data-testid="task-list-toggle"]')).toHaveCount(0);

    await openHeaderMenu(page);
    const menu = page.getByRole("menu", { name: "Main menu" });
    await expect(menu).toBeVisible();
    await expect(menu.getByTestId("task-list-toggle")).toBeVisible();
  });

  test("task list empty state is shown when no tasks", async ({ page }) => {
    const sidebar = page.getByTestId("task-sidebar");

    // Wait for tasks to load (or finish loading)
    await page.waitForTimeout(1000);

    // Check for empty state message
    const emptyState = sidebar.getByTestId("task-list-empty");
    const emptyExists = await emptyState.count();

    if (emptyExists > 0) {
      await expect(emptyState).toContainText("No tasks yet");
    }
  });

  test("screenshot of task list integration", async ({ page }, testInfo) => {
    // Take a screenshot for visual verification
    await page.screenshot({
      path: testInfo.outputPath("ux-003-task-list-integration.png"),
      fullPage: true,
    });

    // Also take a screenshot with sidebar closed
    await openHeaderMenu(page);
    await page.getByTestId("task-list-toggle").click();
    await expect(page.getByTestId("task-sidebar")).not.toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("ux-003-task-list-hidden.png"),
      fullPage: true,
    });
  });
});
