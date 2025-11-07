/**
 * E2E Tests for Editor Initialization
 *
 * Tests actual Milkdown editor initialization in real browser environment.
 * Verifies that the editor renders correctly without mock dependencies.
 *
 * Constitutional Compliance:
 * - Article III (TDD): E2E tests for P1 editor feature
 * - Article III (Coverage): Real browser integration testing
 * - Article V (Documentation): Test descriptions for all scenarios
 */

import { test, expect } from "@playwright/test";
import {
  waitForReactHydration,
  waitForEditorReady,
  waitForEditorInteractive,
} from "./helpers/waitHelpers";

test.describe("Editor Initialization", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto("http://localhost:5173");

    // Wait for React to hydrate
    await waitForReactHydration(page);
  });

  /**
   * Test: Editor should render on page load.
   *
   * Critical path: Basic editor initialization
   * Coverage: Verifies Milkdown renders in real browser
   */
  test("should render editor on page load", async ({ page }) => {
    // Wait for editor to be ready
    await waitForEditorReady(page);

    // Verify editor is visible
    const editor = page.locator(".milkdown");
    await expect(editor).toBeVisible({ timeout: 5000 });
  });

  /**
   * Test: Editor should display initial content.
   *
   * Coverage: Content initialization
   */
  test("should display initial content", async ({ page }) => {
    // Wait for editor to be ready
    await waitForEditorReady(page);

    // Check that some content is visible
    const editorContent = await page.textContent(".milkdown");
    expect(editorContent).toBeTruthy();
    expect(editorContent?.length).toBeGreaterThan(0);
  });

  /**
   * Test: Editor should be editable after initialization.
   *
   * Critical path: User interaction
   * Coverage: Verifies editor accepts input
   */
  test("should be editable after initialization", async ({ page }) => {
    // Wait for editor to be interactive
    await waitForEditorInteractive(page);

    // Try to click and type in editor
    const editor = page.locator(".milkdown");
    await editor.click();

    // Type some text
    await page.keyboard.type("Test typing");

    // Verify text appears
    const content = await page.textContent(".milkdown");
    expect(content).toContain("Test typing");
  });

  /**
   * Test: Editor should not crash when typing rapidly.
   *
   * Coverage: Stress test for editor stability
   */
  test("should handle rapid typing without crashing", async ({ page }) => {
    // Wait for editor to be interactive
    await waitForEditorInteractive(page);

    const editor = page.locator(".milkdown");
    await editor.click();

    // Rapid typing
    for (let i = 0; i < 50; i++) {
      await page.keyboard.type("a");
    }

    // Editor should still be visible and functional
    await expect(editor).toBeVisible();
  });

  /**
   * Test: Editor should handle Markdown formatting.
   *
   * Coverage: Markdown rendering
   */
  test("should handle Markdown formatting", async ({ page }) => {
    // Wait for editor to be interactive
    await waitForEditorInteractive(page);

    const editor = page.locator(".milkdown");
    await editor.click();

    // Clear existing content
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");

    // Type Markdown
    await page.keyboard.type("# Heading 1");
    await page.keyboard.press("Enter");
    await page.keyboard.type("**Bold text**");

    // Check content exists (actual Markdown rendering tested in unit tests)
    const content = await page.textContent(".milkdown");
    expect(content).toBeTruthy();
  });

  /**
   * Test: No console errors during editor initialization.
   *
   * Critical path: Error-free initialization
   * Coverage: Ensures clean startup (catches the original bug)
   */
  test("should not have console errors during initialization", async ({ page }) => {
    const consoleErrors: string[] = [];

    // Capture console errors
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Wait for editor to be ready
    await waitForEditorReady(page);

    // Filter out known safe warnings (if any)
    const criticalErrors = consoleErrors.filter(
      (err) => !err.includes("Download the React DevTools")
    );

    // Should have no critical errors
    expect(criticalErrors).toHaveLength(0);
  });

  /**
   * Test: Editor should initialize within 3 seconds.
   *
   * Coverage: Performance requirement (SC-001: <2s for manual trigger, editor should be faster)
   */
  test("should initialize within 3 seconds", async ({ page }) => {
    const startTime = Date.now();

    // Wait for editor to be ready (max 3s)
    await waitForEditorReady(page, 3000);

    const endTime = Date.now();
    const initTime = endTime - startTime;

    expect(initTime).toBeLessThan(3000);
  });

  /**
   * Test: Mode selector should be functional.
   *
   * Coverage: UI controls integration
   */
  test("should have functional mode selector", async ({ page }) => {
    // Wait for app header to be ready
    await page.waitForSelector(".app-header", { timeout: 5000 });

    const modeSelector = page.locator("#mode-selector");
    await expect(modeSelector).toBeVisible({ timeout: 5000 });

    // Check default value
    const value = await modeSelector.inputValue();
    expect(value).toBe("off");

    // Change mode
    await modeSelector.selectOption("muse");
    const newValue = await modeSelector.inputValue();
    expect(newValue).toBe("muse");
  });

  /**
   * Test: Manual trigger button should be present.
   *
   * Coverage: P2 vibe feature integration
   */
  test("should have manual trigger button", async ({ page }) => {
    // Wait for app header to be ready
    await page.waitForSelector(".app-header", { timeout: 5000 });

    const button = page.locator('button:has-text("I\'m stuck!")');
    await expect(button).toBeVisible({ timeout: 5000 });
  });
});
