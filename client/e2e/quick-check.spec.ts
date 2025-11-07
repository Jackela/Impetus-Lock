import { test, expect } from "@playwright/test";

/**
 * Quick manual check of Phase 5 features
 * This test verifies what's currently working in the app
 */
test.describe("Phase 5 Quick Check", () => {
  test("verify current app state", async ({ page }) => {
    // Navigate to app
    await page.goto("http://localhost:5173");

    // Wait for app to load
    await page.waitForSelector(".app", { timeout: 10000 });

    console.log("✅ App loaded");

    // Check editor
    const editor = page.locator(".milkdown");
    await expect(editor).toBeVisible({ timeout: 5000 });
    console.log("✅ Editor visible");

    // Check mode selector
    const modeSelector = page.locator('[data-testid="mode-selector"]');
    await expect(modeSelector).toBeVisible();
    console.log("✅ Mode selector visible");

    // Check manual trigger button
    const manualButton = page.locator('button:has-text("I\'m stuck")');
    const buttonExists = await manualButton.count();
    console.log(`Manual trigger button count: ${buttonExists}`);

    if (buttonExists > 0) {
      const isDisabled = await manualButton.isDisabled();
      console.log(`✅ Manual button found - disabled: ${isDisabled}`);

      // Try switching to Muse mode
      await modeSelector.selectOption("muse");
      await page.waitForTimeout(500);
      const isDisabledInMuse = await manualButton.isDisabled();
      console.log(`  In Muse mode - disabled: ${isDisabledInMuse}`);
    } else {
      console.log("❌ Manual trigger button NOT FOUND");
    }

    // Check for sensory feedback component
    const feedback = page.locator('[data-testid="sensory-feedback"]');
    const feedbackVisible = await feedback.isVisible().catch(() => false);
    console.log(`Sensory feedback visible: ${feedbackVisible}`);

    // Take a screenshot
    await page.screenshot({ path: "e2e-results/phase5-quick-check.png", fullPage: true });
    console.log("📸 Screenshot saved to e2e-results/phase5-quick-check.png");

    // List all buttons
    const allButtons = await page.locator("button").allTextContents();
    console.log("All buttons found:", allButtons);
  });
});
