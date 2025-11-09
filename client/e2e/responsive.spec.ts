import { test, expect } from "@playwright/test";

/**
 * Responsive Design E2E Tests
 *
 * Tests the responsive behavior of Impetus Lock across different viewport sizes:
 * - Mobile: 375px (iPhone SE), 320px (minimum)
 * - Tablet: 768px (iPad portrait)
 * - Desktop: 1024px, 1440px
 */

test.describe("Responsive Design - User Story 1: Adaptive Layout", () => {
  test("should have no horizontal scrolling at 375px mobile viewport", async ({ page }) => {
    // Set mobile viewport (iPhone SE)
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/");

    // Wait for app to load
    await page.waitForSelector("#root");

    // Check document width equals viewport width (no horizontal overflow)
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);

    expect(documentWidth).toBe(viewportWidth);
    expect(documentWidth).toBe(375);
  });

  test("should have no horizontal scrolling at 768px tablet viewport", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto("/");
    await page.waitForSelector("#root");

    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);

    expect(documentWidth).toBe(viewportWidth);
    expect(documentWidth).toBe(768);
  });

  test("should have no horizontal scrolling at 1024px desktop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });

    await page.goto("/");
    await page.waitForSelector("#root");

    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);

    expect(documentWidth).toBe(viewportWidth);
  });

  test("should wrap long unbreakable content (URLs) without horizontal overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    // Wait for editor to be ready
    await page.waitForSelector('[contenteditable="true"]', { timeout: 10000 });

    // Type a very long URL
    const longUrl =
      "https://example.com/this-is-a-very-long-url-path-that-should-break-properly-without-causing-horizontal-scroll-on-mobile-devices";

    const editor = page.locator('[contenteditable="true"]').first();
    await editor.click();
    await editor.fill(longUrl);

    // Wait for content to render
    await page.waitForTimeout(500);

    // Check no horizontal overflow
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);

    expect(documentWidth).toBeLessThanOrEqual(viewportWidth + 1); // Allow 1px tolerance for rounding
  });

  test("should work at minimum viewport width 320px (iPhone SE portrait)", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });

    await page.goto("/");
    await page.waitForSelector("#root");

    // Verify no horizontal scroll
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);

    expect(documentWidth).toBeLessThanOrEqual(viewportWidth + 1);
    expect(documentWidth).toBe(320);

    // Verify font size is at least 16px (prevents iOS zoom-lock)
    const fontSize = await page.evaluate(() => {
      const editorElement = document.querySelector('[contenteditable="true"]');
      if (!editorElement) return null;
      return window.getComputedStyle(editorElement).fontSize;
    });

    if (fontSize) {
      const fontSizeValue = parseInt(fontSize, 10);
      expect(fontSizeValue).toBeGreaterThanOrEqual(16);
    }
  });

  test("should have all interactive elements visible at 375px width", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    // Wait for app to load
    await page.waitForSelector("#root");

    // Check that editor is visible
    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible();

    // Check that all buttons are within viewport
    const buttons = page.locator("button");
    const buttonCount = await buttons.count();

    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const isVisible = await button.isVisible();

      if (isVisible) {
        const box = await button.boundingBox();
        if (box) {
          // Button should be within viewport width
          expect(box.x + box.width).toBeLessThanOrEqual(375);
        }
      }
    }
  });
});

test.describe("Responsive Design - Device Orientation", () => {
  test("should handle portrait to landscape rotation smoothly", async ({ page }) => {
    // Start in portrait (iPhone SE)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await page.waitForSelector("#root");

    // Type some content
    const editor = page.locator('[contenteditable="true"]').first();
    await editor.click();
    await editor.fill("Test content for rotation");

    // Rotate to landscape
    await page.setViewportSize({ width: 667, height: 375 });
    await page.waitForTimeout(300); // Allow layout to settle

    // Verify content is still there
    const content = await editor.textContent();
    expect(content).toContain("Test content for rotation");

    // Verify no horizontal scroll
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(documentWidth).toBeLessThanOrEqual(viewportWidth + 1);
  });
});

test.describe("Responsive Design - Breakpoint Transitions", () => {
  test("should transition smoothly from mobile (767px) to tablet (768px)", async ({ page }) => {
    // Start at mobile breakpoint
    await page.setViewportSize({ width: 767, height: 1024 });
    await page.goto("/");
    await page.waitForSelector("#root");

    // Resize to tablet breakpoint
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(300);

    // Verify layout is stable
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBe(768);
  });

  test("should transition smoothly from tablet (1023px) to desktop (1024px)", async ({ page }) => {
    // Start at tablet breakpoint
    await page.setViewportSize({ width: 1023, height: 768 });
    await page.goto("/");
    await page.waitForSelector("#root");

    // Resize to desktop breakpoint
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(300);

    // Verify layout is stable
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBe(1024);
  });
});
