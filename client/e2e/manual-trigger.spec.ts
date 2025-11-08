import { test, expect } from "@playwright/test";
import { waitForReactHydration, waitForAppReady } from "./helpers/waitHelpers";

/**
 * E2E tests for Manual Trigger Button (User Story 1)
 *
 * Tests the "I'm stuck!" manual trigger button functionality across different
 * agent modes (Muse/Loki/Off) and verifies integration with AI Provoke API.
 *
 * **Requirements Coverage**:
 * - FR-001: Display clearly labeled manual trigger button when Muse mode is active
 * - FR-002: Button disabled (non-clickable, visually grayed out) in Loki/Off modes
 * - FR-003: Immediately trigger AI Provoke action on button click in Muse mode
 * - FR-004: Debounce clicks to prevent multiple simultaneous API requests (2s cooldown)
 * - FR-005: Show loading/disabled state while AI action is in progress
 * - FR-016: Display error feedback when API call fails (red flash + buzz sound)
 *
 * **Implementation Status**:
 * - Phase 3 (T028-T032): Manual trigger button component complete
 * - Phase 5 (T066-T082): Integration into EditorCore pending
 *
 * **Note**: These tests currently validate the isolated ManualTriggerButton component.
 * Integration tests with EditorCore and mode selector will be enabled in Phase 5.
 */

test.describe("Manual Trigger Button", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to application
    await page.goto("http://localhost:5173");

    // Wait for React to hydrate
    await waitForReactHydration(page);
  });

  /**
   * Test: T029 - Manual trigger button enabled only in Muse mode
   *
   * Verifies that the manual trigger button is:
   * - Enabled (clickable, full opacity) in Muse mode
   * - Disabled (grayed out, not clickable) in Loki mode
   * - Disabled (grayed out, not clickable) in Off mode
   *
   * **Status**: SKIPPED - Requires Phase 5 integration
   * **Reason**: ManualTriggerButton not yet integrated into EditorCore (T073)
   * **Blocker**: Mode selector not accessible until integration complete
   */
  test("manual trigger button enabled only in Muse mode", async ({ page }) => {
    // Wait for app header to be ready
    await page.waitForSelector(".app-header", { timeout: 5000 });

    const button = page.getByTestId("manual-trigger-button");
    const modeSelector = page.getByTestId("mode-selector");

    // Wait for controls to be visible
    await expect(modeSelector).toBeVisible({ timeout: 5000 });
    await expect(button).toBeVisible({ timeout: 5000 });

    // Test 1: Muse mode - button should be enabled
    await modeSelector.selectOption("muse");
    await expect(button).toBeEnabled();
    await expect(button).toHaveCSS("opacity", "1");

    // Test 2: Loki mode - button should be disabled
    await modeSelector.selectOption("loki");
    await expect(button).toBeDisabled();
    await expect(button).toHaveCSS("opacity", "0.6");

    // Test 3: Off mode - button should be disabled
    await modeSelector.selectOption("off");
    await expect(button).toBeDisabled();
    await expect(button).toHaveCSS("opacity", "0.6");
  });

  /**
   * Test: T030 - Manual trigger calls Provoke API and shows feedback
   *
   * Verifies that clicking the manual trigger button:
   * - Sends POST request to /api/intervention/trigger-provoke
   * - Shows loading state ("Thinking..." text, disabled button)
   * - Triggers Glitch animation (from SensoryFeedback component - Phase 4)
   * - Plays Clank audio (from SensoryFeedback component - Phase 4)
   *
   * **Status**: SKIPPED - Requires Phase 5 integration
   * **Reason**: ManualTriggerButton not yet integrated into EditorCore (T073)
   * **Blocker**: Mode selector and API integration pending
   */
  test("manual trigger calls Provoke API and shows feedback", async ({ page }) => {
    // Wait for app header to be ready
    await page.waitForSelector(".app-header", { timeout: 5000 });

    const button = page.getByTestId("manual-trigger-button");
    const modeSelector = page.getByTestId("mode-selector");

    // Wait for controls to be visible
    await expect(modeSelector).toBeVisible({ timeout: 5000 });
    await expect(button).toBeVisible({ timeout: 5000 });

    // Set up API request listener
    // API endpoint: /api/v1/impetus/generate-intervention (POST)
    const apiRequestPromise = page.waitForRequest(
      (request) =>
        request.url().includes("/api/v1/impetus/generate-intervention") &&
        request.method() === "POST",
      { timeout: 5000 }
    );

    // Ensure Muse mode is active
    await modeSelector.selectOption("muse");

    // Click manual trigger button
    await button.click();

    // Verify 1: API request was sent
    const apiRequest = await apiRequestPromise;
    expect(apiRequest.method()).toBe("POST");

    // Verify 2: Button shows loading state
    await expect(button).toHaveText("Thinking...");
    await expect(button).toBeDisabled();

    // Verify 3: Sensory feedback appears (Glitch animation)
    const sensoryFeedback = page.locator('[data-testid="sensory-feedback"]');
    await expect(sensoryFeedback).toBeVisible({ timeout: 2000 });
    await expect(sensoryFeedback).toHaveAttribute("data-animation", "glitch");

    // Verify 4: Button returns to ready state after API timeout + debounce cooldown
    // API timeout is 5s, so wait at least 6s total
    await page.waitForTimeout(6000); // Wait for API timeout + animation + debounce
    await expect(button).toHaveText("I'm stuck!");
    await expect(button).toBeEnabled();
  });

  /**
   * Test: T031 - Manual trigger API failure shows error feedback
   *
   * Verifies that when the API call fails (network error, 500 response):
   * - Button shows error state (red flash animation - Phase 4)
   * - Error audio plays (buzz sound - Phase 4)
   * - Button returns to ready state after error feedback
   *
   * **Coverage**: FR-016 (API error feedback) - addresses analysis gap
   * **Status**: SKIPPED - Requires Phase 5 integration
   * **Reason**: ManualTriggerButton not yet integrated into EditorCore (T073)
   * **Blocker**: Error feedback UI pending (Phase 4 SensoryFeedback component)
   */
  test("manual trigger API failure shows error feedback", async ({ page }) => {
    // Mock API to return error response BEFORE navigation
    await page.route("**/api/v1/impetus/generate-intervention", (route) => {
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal server error" }),
      });
    });

    // Wait for app header to be ready
    await page.waitForSelector(".app-header", { timeout: 5000 });

    const button = page.getByTestId("manual-trigger-button");
    const modeSelector = page.getByTestId("mode-selector");

    // Wait for controls to be visible
    await expect(modeSelector).toBeVisible({ timeout: 5000 });
    await expect(button).toBeVisible({ timeout: 5000 });

    // Set up console log listener BEFORE triggering
    const consoleLogs: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleLogs.push(msg.text());
      }
    });

    // Ensure Muse mode is active
    await modeSelector.selectOption("muse");

    // Click manual trigger button
    await button.click();

    // Verify 1: Button shows error state (red flash animation - Phase 4)
    // TODO: Add assertion for red flash animation once error feedback is implemented
    // const errorAnimation = page.locator('[data-animation-type="error-flash"]');
    // await expect(errorAnimation).toBeVisible();

    // Verify 2: Error audio plays (buzz sound - Phase 4)
    // TODO: Add assertion for audio playback once useAudioFeedback is integrated
    // This requires mocking AudioContext or listening for audio element creation

    // Verify 3: Button returns to ready state after error feedback
    // Wait for loading state to clear (API error + finally block + React state update)
    await expect(button).toHaveText("I'm stuck!", { timeout: 5000 });
    await expect(button).toBeEnabled();

    // Verify 4: Error is logged to console
    await page.waitForTimeout(500); // Wait for console error to be logged
    expect(consoleLogs.some((log) => log.includes("Manual trigger failed"))).toBe(true);
  });
});
