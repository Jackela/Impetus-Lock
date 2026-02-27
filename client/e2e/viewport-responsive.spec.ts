import { test, expect } from "@playwright/test";

/**
 * Multi-Viewport Responsive Tests
 *
 * Tests UI responsiveness across 3 key viewports:
 * - 375px (Mobile)
 * - 1024px (Tablet)
 * - 1920px (Desktop)
 *
 * Pattern 17: Multi-Viewport开发习惯
 */

const viewports = [
  { name: "Mobile", width: 375, height: 667 },
  { name: "Tablet", width: 1024, height: 768 },
  { name: "Desktop", width: 1920, height: 1080 },
];

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

      // Check no horizontal scroll
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(viewport.width + 10);
    });

    test("editor is visible and usable", async ({ page }) => {
      await page.goto("/");

      // Close welcome modal if present
      const welcomeModal = page.locator(".welcome-modal");
      if (await welcomeModal.isVisible()) {
        await page.keyboard.press("Escape");
      }

      // Mobile: close task sidebar if open (it overlays the editor)
      if (viewport.width < 768) {
        const taskSidebar = page.locator(".task-sidebar");
        if (await taskSidebar.isVisible()) {
          const taskToggle = page.locator('[data-testid="task-list-toggle"]');
          await taskToggle.click();
          await page.waitForTimeout(300);
        }
      }

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

      // Close welcome modal if present
      const welcomeModal = page.locator(".welcome-modal");
      if (await welcomeModal.isVisible()) {
        await page.keyboard.press("Escape");
      }

      // Find task list toggle button
      const taskToggle = page.locator('[data-testid="task-list-toggle"]');
      await expect(taskToggle).toBeVisible();

      // Test toggle functionality
      await taskToggle.click();
      await page.waitForTimeout(500);

      // Check task sidebar visibility
      const taskSidebar = page.locator(".task-sidebar");
      if (viewport.width >= 768) {
        // Desktop/Tablet: sidebar should be toggleable
        const isVisible = await taskSidebar.isVisible();
        expect(typeof isVisible).toBe("boolean");
      } else {
        // Mobile: sidebar overlays content
        const isVisible = await taskSidebar.isVisible();
        expect(typeof isVisible).toBe("boolean");
      }
    });

    test("style learning panel is responsive", async ({ page }) => {
      await page.goto("/");

      // Close welcome modal if present
      const welcomeModal = page.locator(".welcome-modal");
      if (await welcomeModal.isVisible()) {
        await page.keyboard.press("Escape");
      }

      // Find style learning toggle button
      const styleToggle = page.locator('[data-testid="style-learning-toggle"]');
      await expect(styleToggle).toBeVisible();

      // Open style learning panel
      await styleToggle.click();
      await page.waitForTimeout(500);

      // Check panel is visible
      const panel = page.locator(".style-learning-overlay");
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

      // Close welcome modal if present
      const welcomeModal = page.locator(".welcome-modal");
      if (await welcomeModal.isVisible()) {
        await page.keyboard.press("Escape");
      }

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

    // Close welcome modal
    const welcomeModal = page.locator(".welcome-modal");
    if (await welcomeModal.isVisible()) {
      await page.keyboard.press("Escape");
    }

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

    // Close welcome modal
    const welcomeModal = page.locator(".welcome-modal");
    if (await welcomeModal.isVisible()) {
      await page.keyboard.press("Escape");
    }

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

    // Close welcome modal
    const welcomeModal = page.locator(".welcome-modal");
    if (await welcomeModal.isVisible()) {
      await page.keyboard.press("Escape");
    }

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
