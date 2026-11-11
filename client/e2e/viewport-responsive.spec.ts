import { test, expect, type Page } from "@playwright/test";
import { dismissWelcomeModal, openHeaderMenu } from "./helpers/waitHelpers";

/**
 * Multi-Viewport Responsive Tests
 *
 * Tests UI responsiveness across 3 key viewports:
 * - 375px (Mobile)
 * - 1024px (Tablet)
 * - 1920px (Desktop)
 *
 * Header commands (Tasks / Style / …) live in the `⋯` overflow menu, so every
 * interaction opens the menu first. Below 768px the task sidebar is a modal
 * sheet that marks the header `inert`; the header cannot be clicked until the
 * sheet is dismissed, so those tests close it through the sheet's own control.
 *
 * Pattern 17: Multi-Viewport开发习惯
 */

const viewports = [
  { name: "Mobile", width: 375, height: 667 },
  { name: "Tablet", width: 1024, height: 768 },
  { name: "Desktop", width: 1920, height: 1080 },
];

/**
 * Dismiss the mobile task sidebar sheet so the (otherwise inert) header can be
 * used. No-op at tablet/desktop widths and when the sheet is already closed.
 *
 * @param page - Playwright page instance
 * @param width - Current viewport width
 */
async function closeMobileTaskSheet(page: Page, width: number) {
  if (width >= 768) return;
  const sidebar = page.getByTestId("task-sidebar");
  if (!(await sidebar.isVisible().catch(() => false))) return;
  const closeButton = page.getByRole("button", { name: "Close task list" });
  if (await closeButton.isVisible().catch(() => false)) await closeButton.click();
  else await page.getByTestId("task-sidebar-backdrop").click();
  await expect(sidebar).toHaveCount(0);
}

for (const viewport of viewports) {
  test.describe(`${viewport.name} (${viewport.width}x${viewport.height})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("header layout is responsive", async ({ page }) => {
      await page.goto("/");

      // Wait for app to load
      await page.waitForSelector(".app-header");

      // Check header is visible
      const header = page.locator(".app-header");
      await expect(header).toBeVisible();

      // The single overflow-menu trigger replaces the old inline control row.
      await expect(page.getByTestId("header-menu-button")).toBeVisible();

      // Check no horizontal scroll
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(viewport.width + 10);
    });

    test("editor is visible and usable", async ({ page }) => {
      await page.goto("/");

      // Dismiss the welcome modal; its overlay intercepts every header click.
      await dismissWelcomeModal(page);

      // Mobile: close task sidebar if open (the sheet overlays the editor and
      // makes the header inert, so use the sheet's own close control).
      await closeMobileTaskSheet(page, viewport.width);

      // Wait for editor
      await page.waitForSelector(".milkdown");

      const editor = page.locator(".milkdown .ProseMirror");
      await expect(editor).toBeVisible();

      // Check editor is clickable (usable)
      await editor.click();
      await expect(editor).toBeFocused();
    });

    test("task list toggle is responsive", async ({ page }) => {
      await page.goto("/");

      // Dismiss the welcome modal; its overlay intercepts every header click.
      await dismissWelcomeModal(page);

      // Mobile: start from a closed sheet so the header menu is reachable.
      await closeMobileTaskSheet(page, viewport.width);

      const taskSidebar = page.getByTestId("task-sidebar");
      const visibleBefore = await taskSidebar.isVisible();

      // The Tasks command lives in the header overflow menu.
      await openHeaderMenu(page);
      const taskToggle = page.getByTestId("task-list-toggle");
      await expect(taskToggle).toBeVisible();
      await taskToggle.click();
      await page.waitForTimeout(500);

      // Toggling flips the sidebar: desktop/tablet hide it, mobile re-opens the sheet.
      const visibleAfter = await taskSidebar.isVisible();
      expect(visibleAfter).toBe(!visibleBefore);
    });

    test("style learning panel is responsive", async ({ page }) => {
      await page.goto("/");

      // Dismiss the welcome modal; its overlay intercepts every header click.
      await dismissWelcomeModal(page);

      // Mobile: dismiss the sidebar sheet so the header menu can be opened.
      await closeMobileTaskSheet(page, viewport.width);

      // Find style learning toggle in the header menu
      await openHeaderMenu(page);
      const styleToggle = page.getByTestId("style-learning-toggle");
      await expect(styleToggle).toBeVisible();

      // Open style learning panel
      await styleToggle.click();
      await page.waitForTimeout(500);

      // Check panel is visible
      const panel = page.getByTestId("style-learning-overlay");
      await expect(panel).toBeVisible();

      // Check no horizontal overflow when panel is open
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(viewport.width + 10);

      // Close panel
      const closeButton = panel.locator('button[aria-label="Close Style Learning"]');
      await closeButton.click();
      await expect(panel).not.toBeVisible();
    });

    test("mode selector is accessible", async ({ page }) => {
      await page.goto("/");

      // Dismiss the welcome modal; its overlay intercepts every header click.
      await dismissWelcomeModal(page);

      // Mobile: the sidebar sheet marks the header inert until dismissed.
      await closeMobileTaskSheet(page, viewport.width);

      // Find mode selector
      const modeSelector = page.locator("#mode-selector");
      await expect(modeSelector).toBeVisible();

      // Test mode selection
      await modeSelector.selectOption("muse");
      await expect(modeSelector).toHaveValue("muse");

      await modeSelector.selectOption("loki");
      await expect(modeSelector).toHaveValue("loki");
    });
  });
}

test.describe("Breakpoint Transitions", () => {
  test("tablet to desktop transition (768px → 1024px)", async ({ page }) => {
    // Start at tablet size
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");

    // Dismiss the welcome modal; its overlay intercepts every header click.
    await dismissWelcomeModal(page);

    // Check initial layout
    const header = page.locator(".app-header");
    await expect(header).toBeVisible();

    // Resize to desktop
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(500);

    // Verify no horizontal overflow after resize
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(1024 + 10);
  });

  test("mobile to tablet transition (375px → 768px)", async ({ page }) => {
    // Start at mobile size
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    // Dismiss the welcome modal; its overlay intercepts every header click.
    await dismissWelcomeModal(page);

    // Check initial layout
    const header = page.locator(".app-header");
    await expect(header).toBeVisible();

    // Resize to tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);

    // Verify no horizontal overflow after resize
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(768 + 10);
  });

  test("rapid resize stress test", async ({ page }) => {
    await page.goto("/");

    // Dismiss the welcome modal; its overlay intercepts every header click.
    await dismissWelcomeModal(page);

    // Rapidly resize between viewports
    const sizes = [
      { width: 375, height: 667 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 1920, height: 1080 },
      { width: 375, height: 667 },
    ];

    for (const size of sizes) {
      await page.setViewportSize(size);
      await page.waitForTimeout(200);

      // Check no horizontal overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(size.width + 10);
    }
  });
});
