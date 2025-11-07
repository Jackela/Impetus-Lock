import { test, expect } from "@playwright/test";

/**
 * Debug test for manual trigger behavior
 */
test.describe("Manual Trigger Debug", () => {
  test("debug manual trigger and sensory feedback", async ({ page }) => {
    // Capture console logs
    const consoleLogs: string[] = [];
    const consoleErrors: string[] = [];

    page.on("console", (msg) => {
      const text = msg.text();
      if (msg.type() === "error") {
        consoleErrors.push(text);
        console.log(`[BROWSER ERROR]: ${text}`);
      } else {
        consoleLogs.push(text);
        console.log(`[BROWSER LOG]: ${text}`);
      }
    });

    // Capture network requests
    const networkRequests: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (url.includes("intervention") || url.includes("provoke") || url.includes("api")) {
        console.log(`[REQUEST]: ${request.method()} ${url}`);
        networkRequests.push(url);
      }
    });

    page.on("response", (response) => {
      const url = response.url();
      if (url.includes("intervention") || url.includes("provoke") || url.includes("api")) {
        console.log(`[RESPONSE]: ${response.status()} ${url}`);
      }
    });

    // Navigate
    await page.goto("http://localhost:5173");
    await page.waitForSelector(".app", { timeout: 10000 });
    console.log("✅ App loaded");

    // Switch to Muse mode
    const modeSelector = page.locator('[data-testid="mode-selector"]');
    await modeSelector.selectOption("muse");
    console.log("✅ Switched to Muse mode");
    await page.waitForTimeout(500);

    // Click button
    const manualButton = page.locator('button:has-text("I\'m stuck")');
    await expect(manualButton).toBeEnabled();
    console.log("🖱️ Clicking button...");

    await manualButton.click();

    // Wait for any async actions
    await page.waitForTimeout(2000);

    // Check sensory feedback
    const feedback = page.locator('[data-testid="sensory-feedback"]');
    const isVisible = await feedback.isVisible().catch(() => false);

    console.log("\\n=== RESULTS ===");
    console.log(`Sensory feedback visible: ${isVisible}`);
    console.log(`Network requests made: ${networkRequests.length}`);
    console.log(`Console errors: ${consoleErrors.length}`);

    if (consoleErrors.length > 0) {
      console.log("\\n=== CONSOLE ERRORS ===");
      consoleErrors.forEach((err) => console.log(`  - ${err}`));
    }

    if (networkRequests.length > 0) {
      console.log("\\n=== NETWORK REQUESTS ===");
      networkRequests.forEach((req) => console.log(`  - ${req}`));
    }

    // Take screenshot
    await page.screenshot({ path: "e2e-results/trigger-debug.png", fullPage: true });
  });
});
