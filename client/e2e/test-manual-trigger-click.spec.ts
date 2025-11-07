import { test, expect } from "@playwright/test";

/**
 * Test manual trigger button click and sensory feedback
 */
test.describe("Manual Trigger Click Test", () => {
  test("clicking manual trigger shows sensory feedback", async ({ page }) => {
    // Navigate to app
    await page.goto("http://localhost:5173");
    await page.waitForSelector(".app", { timeout: 10000 });

    console.log("✅ App loaded");

    // Switch to Muse mode
    const modeSelector = page.locator('[data-testid="mode-selector"]');
    await modeSelector.selectOption("muse");
    console.log("✅ Switched to Muse mode");

    // Find manual trigger button
    const manualButton = page.locator('button:has-text("I\'m stuck")');
    await expect(manualButton).toBeEnabled({ timeout: 2000 });
    console.log("✅ Manual button is enabled");

    // Check for sensory feedback BEFORE click
    const feedback = page.locator('[data-testid="sensory-feedback"]');
    const feedbackBeforeClick = await feedback.isVisible().catch(() => false);
    console.log(`Sensory feedback before click: ${feedbackBeforeClick}`);

    // Click the button
    console.log("🖱️ Clicking manual trigger button...");
    await manualButton.click();

    // Wait a bit for any async actions
    await page.waitForTimeout(500);

    // Check for sensory feedback AFTER click
    const feedbackAfterClick = await feedback.isVisible().catch(() => false);
    console.log(`Sensory feedback after click: ${feedbackAfterClick}`);

    if (feedbackAfterClick) {
      const animationType = await feedback.getAttribute("data-animation");
      console.log(`✅ Sensory feedback shown! Animation type: ${animationType}`);
    } else {
      console.log("❌ Sensory feedback NOT shown after click");
    }

    // Check console for errors
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log("Browser error:", msg.text());
      }
    });

    // Check network requests
    page.on("response", (response) => {
      if (response.url().includes("provoke")) {
        console.log(`API call: ${response.url()} - Status: ${response.status()}`);
      }
    });

    // Take screenshot
    await page.screenshot({ path: "e2e-results/manual-trigger-clicked.png", fullPage: true });
    console.log("📸 Screenshot saved");

    // Wait for animation if visible
    if (feedbackAfterClick) {
      await page.waitForTimeout(2000); // Wait for animation to complete
    }
  });
});
