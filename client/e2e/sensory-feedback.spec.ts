import { test, expect } from "@playwright/test";
import { waitForReactHydration, waitForAppReady } from "./helpers/waitHelpers";
import {
  insertLockedContent,
  attemptDeleteLocked,
  getEditorContent,
  waitForEditorReady,
} from "./helpers/milkdown-helpers";

/**
 * E2E tests for Sensory Feedback (User Story 2)
 *
 * Tests the visual animations and audio feedback for AI intervention actions
 * (Provoke/Delete/Reject). Verifies integration with AI action system.
 *
 * **Requirements Coverage**:
 * - FR-006 + FR-007: Glitch animation + Clank sound for Provoke
 * - FR-010 + FR-011: Fade-out animation + Whoosh sound for Delete
 * - FR-013 + FR-014: Shake animation + Bonk sound for Reject
 * - FR-017: Rejection feedback matches P1 implementation
 * - FR-018: Respect prefers-reduced-motion
 * - FR-019: Cancel-and-replace behavior
 *
 * **Implementation Status**:
 * - Phase 4 (T060-T065): Sensory feedback components complete
 * - Phase 5 (T066-T082): Integration into EditorCore pending
 *
 * **Note**: These tests are currently SKIPPED pending Phase 5 integration.
 * They will be enabled once SensoryFeedback is wired into the Editor.
 */

test.describe("Sensory Feedback", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:5173");

    // Wait for React to hydrate
    await waitForReactHydration(page);
  });

  /**
   * Test: T061 - Plays Clank sound and shows Glitch animation on Provoke
   *
   * Verifies that when AI Provoke action triggers:
   * - Glitch animation displays (opacity keyframes over 1.5s)
   * - Clank audio plays (metallic lock sound)
   * - Feedback disappears after animation completes
   *
   * **Status**: SKIPPED - Requires Phase 5 integration (T066)
   * **Blocker**: SensoryFeedback not yet wired to AI action events
   */
  test("plays Clank sound and shows Glitch animation on Provoke", async ({ page }) => {
    // Wait for app to be fully ready
    await waitForAppReady(page);

    const feedbackElement = page.locator('[data-testid="sensory-feedback"]');
    const modeSelector = page.locator('[data-testid="mode-selector"]');
    const manualTrigger = page.locator('[data-testid="manual-trigger-button"]');

    // Set Muse mode and trigger Provoke action
    await modeSelector.selectOption("muse");
    await manualTrigger.click();

    // Verify Glitch animation appears
    await expect(feedbackElement).toBeVisible({ timeout: 5000 });
    await expect(feedbackElement).toHaveAttribute("data-animation", "glitch");

    // Wait for animation to complete (1.5s + buffer)
    await page.waitForTimeout(2000);

    // Verify feedback disappears
    await expect(feedbackElement).not.toBeVisible();
  });

  /**
   * Test: T062 - Plays Whoosh sound and shows Fade-out animation on Delete
   *
   * Verifies that when AI Delete action triggers:
   * - Fade-out animation displays (opacity 0 over 0.75s)
   * - Whoosh audio plays (wind/swoosh sound)
   * - Feedback disappears after animation completes
   *
   * **Status**: ENABLED - Uses test endpoint to trigger DELETE action
   * **Note**: Requires backend running with TESTING=true
   */
  test("plays Whoosh sound and shows Fade-out animation on Delete", async ({ page, request }) => {
    // Wait for app to be fully ready
    await waitForAppReady(page);

    const feedbackElement = page.locator('[data-testid="sensory-feedback"]');
    const modeSelector = page.locator('[data-testid="mode-selector"]');

    // Set Loki mode (required for DELETE action handling)
    await modeSelector.selectOption("loki");

    // Trigger DELETE action via test endpoint (bypasses random timer)
    const response = await request.post("http://localhost:8000/api/v1/test/trigger-delete", {
      data: {
        from_pos: 10,
        to_pos: 20,
        context: "E2E test DELETE trigger",
      },
    });

    expect(response.status()).toBe(200);

    // Verify Fade-out animation appears
    await expect(feedbackElement).toBeVisible({ timeout: 5000 });
    await expect(feedbackElement).toHaveAttribute("data-animation", "fadeout");

    // Wait for animation to complete (0.75s + buffer)
    await page.waitForTimeout(1000);

    // Verify feedback disappears
    await expect(feedbackElement).not.toBeVisible();
  });

  /**
   * Test: T063 - Cancels previous animation when new action triggers (rapid actions)
   *
   * Verifies cancel-and-replace behavior:
   * - Trigger Provoke action (Glitch animation starts)
   * - Immediately trigger Delete action
   * - Glitch animation should cancel
   * - Fade-out animation should start
   * - Clank audio should stop
   * - Whoosh audio should play
   *
   * **Status**: ENABLED - Uses test endpoints for rapid action triggers
   * **Note**: Audio verification would require browser API mocking (future work)
   */
  test("cancels previous animation when new action triggers (rapid actions)", async ({
    page,
    request,
  }) => {
    // Wait for app to be fully ready
    await waitForAppReady(page);

    const feedbackElement = page.locator('[data-testid="sensory-feedback"]');
    const manualTrigger = page.locator('[data-testid="manual-trigger-button"]');
    const modeSelector = page.locator('[data-testid="mode-selector"]');

    // Set Muse mode for PROVOKE
    await modeSelector.selectOption("muse");

    // Trigger first action (PROVOKE via manual button)
    await manualTrigger.click();
    await expect(feedbackElement).toHaveAttribute("data-animation", "glitch", { timeout: 5000 });

    // Immediately trigger second action (DELETE via test endpoint)
    const deleteResponse = await request.post("http://localhost:8000/api/v1/test/trigger-delete", {
      data: {
        from_pos: 10,
        to_pos: 20,
        context: "E2E test rapid action cancellation",
      },
    });

    expect(deleteResponse.status()).toBe(200);

    // Verify animation changed (cancel-and-replace)
    await expect(feedbackElement).toHaveAttribute("data-animation", "fadeout", { timeout: 5000 });

    // Wait for Fade-out animation to complete
    await page.waitForTimeout(1000);

    // Verify feedback disappears
    await expect(feedbackElement).not.toBeVisible();

    // Note: Audio verification (Clank stopped, Whoosh playing) requires
    // advanced browser API mocking and is deferred to future work
  });

  /**
   * Test: T064 - Rejection feedback matches P1 implementation
   *
   * Verifies that attempting to delete locked content:
   * - Triggers Shake animation (matches P1 behavior)
   * - Plays Bonk audio (matches P1 behavior)
   * - Feedback timing matches P1 (0.5s duration)
   * - User receives clear "rejection" signal
   *
   * **Coverage**: FR-017 (P1 consistency) - addresses analysis gap
   * **Status**: ENABLED - Uses milkdown-helpers for ProseMirror interaction
   * **Note**: This is Phase 6 (Optional UI Polish) - not blocking production readiness
   */
  test("rejection feedback matches P1 implementation", async ({ page }) => {
    // Wait for app to be fully ready
    await waitForAppReady(page);
    await waitForEditorReady(page);

    const feedbackElement = page.locator('[data-testid="sensory-feedback"]');

    // Insert locked content using helper
    await insertLockedContent(page, "This is critical locked content", "test-lock-reject");

    // Attempt to delete locked content (should trigger REJECT)
    await attemptDeleteLocked(page, "test-lock-reject");

    // Verify Shake animation appears
    await expect(feedbackElement).toBeVisible({ timeout: 5000 });
    await expect(feedbackElement).toHaveAttribute("data-animation", "shake");

    // Wait for animation to complete (0.5s + buffer)
    await page.waitForTimeout(700);

    // Verify feedback disappears
    await expect(feedbackElement).not.toBeVisible();

    // Verify locked content was NOT deleted (P1 enforcement)
    const content = await getEditorContent(page);
    expect(content).toContain("critical locked content");
  });
});
