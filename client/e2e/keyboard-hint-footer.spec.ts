/**
 * E2E Tests for Keyboard Hint Footer (T015)
 *
 * Validates that the keyboard hint footer is visible and provides
 * helpful guidance about the "?" keyboard shortcut without interfering
 * with the user's interaction with the editor.
 *
 * The footer has pointer-events: none to prevent accidental clicks.
 *
 * @see openspec/changes/chrome-audit-polish/design.md#5-welcome-modal-hierarchy
 */

import { test, expect, type Page } from "@playwright/test";

async function ensureWelcomeModalVisible(page: Page) {
  const modal = page.locator(".welcome-modal");
  if (await modal.isVisible()) {
    return;
  }

  await page.keyboard.press("?");
  await expect(modal).toBeVisible({ timeout: 5000 });
}

test.describe("Keyboard Hint Footer", () => {
  test("Footer displays keyboard hint", async ({ page }) => {
    await page.goto("/");

    const footer = page.locator(".app-footer");
    await expect(footer).toBeVisible();
    await expect(footer).toContainText("Press ? for help");

    // Validate <kbd> element
    await expect(footer.locator("kbd")).toHaveText("?");
  });

  test("Footer visible in all modes", async ({ page }) => {
    await page.goto("/");

    const footer = page.locator(".app-footer");

    // Off mode
    await page.selectOption("#mode-selector", "off");
    await expect(footer).toBeVisible();

    // Muse mode
    await page.selectOption("#mode-selector", "muse");
    await expect(footer).toBeVisible();

    // Loki mode
    await page.selectOption("#mode-selector", "loki");
    await expect(footer).toBeVisible();
  });

  test("Clicking footer does not trigger modal", async ({ page }) => {
    await page.goto("/");

    await ensureWelcomeModalVisible(page);
    await page.locator(".welcome-button").click();

    // Wait for modal to disappear
    await expect(page.locator(".welcome-modal")).not.toBeVisible();

    // Try to click footer (should not work due to pointer-events: none)
    await page.locator(".app-footer").click({ force: true });

    // Modal should NOT reappear
    await expect(page.locator(".welcome-modal")).not.toBeVisible();
  });

  test("Keyboard shortcut still works independently", async ({ page }) => {
    await page.goto("/");

    await ensureWelcomeModalVisible(page);
    await page.locator(".welcome-button").click();

    // Wait for modal to disappear
    await expect(page.locator(".welcome-modal")).not.toBeVisible();

    // Press ? key
    await page.keyboard.press("?");

    // Modal should reappear
    await expect(page.locator(".welcome-modal")).toBeVisible();
  });

  test("Footer does not block interactions with editor", async ({ page }) => {
    await page.goto("/");

    // Dismiss welcome modal
    const welcomeButton = page.locator(".welcome-button");
    if (await welcomeButton.isVisible()) {
      await welcomeButton.click();
    }

    // Wait for editor to be ready
    await page.waitForSelector('[data-testid="editor-ready"]', { timeout: 10000 });

    // Click on the editor area (which is above the footer)
    const editor = page.locator('.milkdown [contenteditable="true"]');
    await editor.click();

    // Type some text
    await page.keyboard.type("Testing footer does not block editor");

    // Verify text was entered
    await expect(editor).toContainText("Testing footer does not block editor");
  });

  test("Footer has subtle styling (T016)", async ({ page }) => {
    await page.goto("/");

    const footer = page.locator(".app-footer");

    // Validate styling
    await expect(footer).toHaveCSS("opacity", "0.5");
    await expect(footer).toHaveCSS("font-size", "14px"); // 0.875rem
    await expect(footer).toHaveCSS("position", "fixed");
    await expect(footer).toHaveCSS("text-align", "center");
    await expect(footer).toHaveCSS("pointer-events", "none");

    // Validate kbd element styling
    const kbd = footer.locator("kbd");
    await expect(kbd).toHaveCSS("font-family", /monospace/);
    await expect(kbd).toHaveCSS("border-radius", "3px");

    // Screenshot for visual regression
    await page.screenshot({ path: "test-results/footer-styling.png", fullPage: true });
  });
});
