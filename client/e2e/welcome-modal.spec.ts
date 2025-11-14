import { test, expect } from "@playwright/test";

test.use({
  storageState: {
    origins: [
      {
        origin: "http://localhost:5173",
        localStorage: [],
      },
    ],
  },
});

/**
 * E2E Tests: Welcome Modal - New User Onboarding
 *
 * Tests the Phase 5 implementation of the welcome modal that explains
 * Muse mode, Loki mode, and the Lock concept to new users.
 */

test.describe("Welcome Modal - New User Experience", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.evaluate(() => {
      localStorage.removeItem("impetus-lock-welcome-dismissed");
    });
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
  });

  test("should show welcome modal on first visit", async ({ page }) => {
    // Wait for modal to appear
    const modal = page.locator(".welcome-modal");
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Verify modal header
    await expect(page.locator("#welcome-title")).toHaveText("Welcome to Impetus Lock");

    // Verify intro text
    await expect(page.locator(".welcome-intro")).toContainText("un-deletable task pressure system");
  });

  test("should display all three mode explanations", async ({ page }) => {
    await expect(page.locator(".welcome-modal")).toBeVisible();

    // Muse Mode section
    const museSection = page.locator(".welcome-mode").filter({ hasText: "Muse Mode" });
    await expect(museSection).toBeVisible();
    await expect(museSection).toContainText("60 seconds");
    await expect(museSection).toContainText("creative prompts");

    // Loki Mode section
    const lokiSection = page.locator(".welcome-mode").filter({ hasText: "Loki Mode" });
    await expect(lokiSection).toBeVisible();
    await expect(lokiSection).toContainText("Chaos mode");
    await expect(lokiSection).toContainText("random");

    // Lock Concept section
    const lockSection = page.locator(".welcome-mode").filter({ hasText: "Lock Concept" });
    await expect(lockSection).toBeVisible();
    await expect(lockSection).toContainText("locked");
    await expect(lockSection).toContainText("cannot delete");
  });

  test("should have accessible close button", async ({ page }) => {
    await expect(page.locator(".welcome-modal")).toBeVisible();

    const closeButton = page.locator(".welcome-modal-close");
    await expect(closeButton).toBeVisible();
    await expect(closeButton).toHaveAttribute("aria-label", "Close welcome modal");
  });

  test("should close modal when clicking close button", async ({ page }) => {
    const modal = page.locator(".welcome-modal");
    await expect(modal).toBeVisible();

    // Click close button
    await page.locator(".welcome-modal-close").click();

    // Modal should disappear
    await expect(modal).not.toBeVisible();
  });

  test("should close modal when pressing Escape key", async ({ page }) => {
    const modal = page.locator(".welcome-modal");
    await expect(modal).toBeVisible();

    // Press Escape
    await page.keyboard.press("Escape");

    // Modal should disappear
    await expect(modal).not.toBeVisible();
  });

  test("should close modal when clicking outside (overlay)", async ({ page }) => {
    const modal = page.locator(".welcome-modal");
    const overlay = page.locator(".welcome-modal-overlay");

    await expect(modal).toBeVisible();

    // Click outside the modal (on overlay, but not on modal itself)
    await overlay.click({ position: { x: 10, y: 10 } });

    // Modal should disappear
    await expect(modal).not.toBeVisible();
  });

  test('should have "Don\'t show again" checkbox', async ({ page }) => {
    await expect(page.locator(".welcome-modal")).toBeVisible();

    const checkbox = page.locator('.welcome-checkbox input[type="checkbox"]');
    await expect(checkbox).toBeVisible();
    await expect(checkbox).not.toBeChecked();

    // Label should be present
    await expect(page.locator(".welcome-checkbox")).toContainText("Don't show this again");
  });

  test('should persist "Don\'t show again" preference in localStorage', async ({ page }) => {
    await expect(page.locator(".welcome-modal")).toBeVisible();

    // Check the "Don't show again" checkbox
    await page.locator('.welcome-checkbox input[type="checkbox"]').check();

    // Click "Get Started" button
    await page.locator(".welcome-button").click();

    // Verify localStorage was set
    const storageValue = await page.evaluate(() =>
      localStorage.getItem("impetus-lock-welcome-dismissed")
    );
    expect(storageValue).toBe("true");

    // Reload page - modal should NOT appear
    await page.reload();
    await expect(page.locator(".welcome-modal")).not.toBeVisible({ timeout: 2000 });
  });

  test("should show modal again on subsequent visits if not dismissed permanently", async ({
    page,
  }) => {
    await expect(page.locator(".welcome-modal")).toBeVisible();

    // Close without checking "Don't show again"
    await page.locator(".welcome-modal-close").click();

    // Verify localStorage was NOT set
    const storageValue = await page.evaluate(() =>
      localStorage.getItem("impetus-lock-welcome-dismissed")
    );
    expect(storageValue).toBeNull();

    // Reload page - modal SHOULD appear again
    await page.reload();
    await expect(page.locator(".welcome-modal")).toBeVisible({ timeout: 5000 });
  });

  test('should re-open modal when pressing "?" key', async ({ page }) => {
    await expect(page.locator(".welcome-modal")).toBeVisible();

    // Close modal
    await page.locator(".welcome-button").click();
    await expect(page.locator(".welcome-modal")).not.toBeVisible();

    // Press "?" key
    await page.keyboard.press("?");

    // Modal should re-appear
    await expect(page.locator(".welcome-modal")).toBeVisible();
  });

  test('should NOT trigger "?" shortcut when typing in editor', async ({ page }) => {
    await expect(page.locator(".welcome-modal")).toBeVisible();

    // Close modal
    await page.locator(".welcome-button").click();
    await expect(page.locator(".welcome-modal")).not.toBeVisible();

    // Click in editor to focus it
    const editor = page.locator(".milkdown .ProseMirror");
    await editor.click();

    // Type "?" while editor is focused
    await page.keyboard.type("What is this?");

    // Modal should NOT appear (because we're typing in editor)
    await expect(page.locator(".welcome-modal")).not.toBeVisible();

    // Editor should contain the text
    await expect(editor).toContainText("What is this?");
  });

  test("should have proper ARIA attributes for accessibility", async ({ page }) => {
    const overlay = page.locator(".welcome-modal-overlay");
    await expect(overlay).toBeVisible();

    // Verify dialog role
    await expect(overlay).toHaveAttribute("role", "dialog");
    await expect(overlay).toHaveAttribute("aria-modal", "true");
    await expect(overlay).toHaveAttribute("aria-labelledby", "welcome-title");
  });

  test('should display hint about "?" keyboard shortcut', async ({ page }) => {
    await expect(page.locator(".welcome-modal")).toBeVisible();

    const hint = page.locator(".welcome-hint");
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('Press "?" key anytime');
  });

  test("should be responsive on mobile viewport", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    const modal = page.locator(".welcome-modal");
    await expect(modal).toBeVisible();

    // Modal should still be visible and readable
    await expect(page.locator("#welcome-title")).toBeVisible();
    await expect(page.locator(".welcome-button")).toBeVisible();

    // Get Started button should be full width on mobile
    const button = page.locator(".welcome-button");
    const buttonBox = await button.boundingBox();
    const modalBox = await modal.boundingBox();

    // Button width should be close to modal width (accounting for padding)
    if (buttonBox && modalBox) {
      expect(buttonBox.width).toBeGreaterThan(modalBox.width * 0.8);
    }
  });
});

test.describe("Welcome Modal - Integration with App", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
  });

  test("should allow user to interact with app after dismissing modal", async ({ page }) => {
    await page.goto("/");

    // Wait for and dismiss modal
    await page.locator(".welcome-button").click();
    await expect(page.locator(".welcome-modal")).not.toBeVisible();

    // Verify user can interact with mode selector
    const modeSelector = page.locator("#mode-selector");
    await expect(modeSelector).toBeVisible();
    await modeSelector.selectOption("muse");
    await expect(modeSelector).toHaveValue("muse");

    // Verify editor is accessible
    const editor = page.locator(".milkdown .ProseMirror");
    await editor.click();
    await page.keyboard.type("Testing after modal dismiss");
    await expect(editor).toContainText("Testing after modal dismiss");
  });

  test("should not block app functionality while modal is open", async ({ page }) => {
    await page.goto("/");

    // Modal should be visible
    await expect(page.locator(".welcome-modal")).toBeVisible();

    // But app elements should still be present in DOM (just behind overlay)
    await expect(page.locator("#mode-selector")).toBeInViewport({ ratio: 0 }); // May be covered
    await expect(page.locator(".milkdown")).toBeInViewport({ ratio: 0 });
  });
});
