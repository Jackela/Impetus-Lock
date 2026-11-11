import { test, expect } from "@playwright/test";
import { waitForReactHydration, waitForAppReady, openHeaderDevTools } from "./helpers/waitHelpers";
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
 * **Note**: These tests are declared as explicit `test.fixme(true, "T066 ...")`
 * guards pending Phase 5 integration (T066-T082). They are reported as known-
 * broken rather than silently skipped, and must not be converted into passing
 * tests until the SensoryFeedback component is actually wired into the Editor.
 */

test.describe("Sensory Feedback", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");

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
   * TODO: Enable this test once Phase 5 integration (T066-T082) is complete
   */
  test("plays Clank sound and shows Glitch animation on Provoke", async ({ page }) => {
    // T066: SensoryFeedback is not wired into EditorCore yet, so this cannot pass.
    // Declared as an explicit fixme instead of a silent skip so the gap is
    // visible in the report; the body below does not execute while it is active.
    test.fixme(true, "T066 - SensoryFeedback integration into EditorCore pending (Phase 5)");

    await page.route("**/impetus/generate-intervention", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          action: "provoke",
          content: "手腕上的装置突然震动，提醒他时间所剩无几。",
          lock_id: "lock_sensory_provoke",
          anchor: { type: "pos", from: 0 },
          action_id: "act_sensory_provoke",
          issued_at: new Date().toISOString(),
          source: "muse",
        }),
      });
    });

    // Wait for app to be fully ready
    await waitForAppReady(page);

    const feedbackElement = page.locator('[data-testid="sensory-feedback"]');
    const modeSelector = page.locator('[data-testid="mode-selector"]');

    // Set Muse mode, then open the header menu's DEV "Dev tools" region
    await modeSelector.selectOption("muse");
    await openHeaderDevTools(page);
    const manualTrigger = page.locator('[data-testid="manual-trigger-button"]');
    await manualTrigger.click();

    // Verify Glitch animation appears
    await expect(feedbackElement).toBeVisible({ timeout: 5000 });
    await expect(feedbackElement).toHaveAttribute("data-animation", "glitch");

    // Wait for animation to complete (1.5s + buffer)
    await page.waitForTimeout(2000);
  });

  /**
   * Test: T062 - Plays Whoosh sound and shows Fade-out animation on Delete
   *
   * Verifies that when AI Delete action triggers:
   * - Fade-out animation displays (opacity 0 over 0.75s)
   * - Whoosh audio plays (wind/swoosh sound)
   * - Feedback disappears after animation completes
   *
   * **Status**: SKIPPED - Phase 6 feature not yet implemented
   * **Note**: Requires backend running with TESTING=true
   * TODO: Enable this test once DELETE action sensory feedback is implemented (Phase 6)
   */
  test("plays Whoosh sound and shows Fade-out animation on Delete", async ({ page, request }) => {
    // ⏳ Phase 6 feature - DELETE action sensory feedback not yet implemented
    // T066: explicit fixme (not a silent skip) so the missing implementation stays
    // visible in the report; the body below does not execute while it is active.
    test.fixme(true, "T066 - DELETE sensory feedback not implemented (Phase 6)");

    // Wait for app to be fully ready
    await waitForAppReady(page);

    const feedbackElement = page.locator('[data-testid="sensory-feedback"]');
    const modeSelector = page.locator('[data-testid="mode-selector"]');

    // Set Loki mode (required for DELETE action handling)
    await modeSelector.selectOption("loki");

    // Trigger DELETE action via test endpoint (bypasses random timer)
    const response = await request.post("http://localhost:8000/test/trigger-delete", {
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
   * **Status**: SKIPPED - Phase 6 feature not yet implemented
   * **Note**: Audio verification would require browser API mocking (future work)
   * TODO: Enable this test once rapid action cancellation is fully implemented (Phase 6)
   */
  test("cancels previous animation when new action triggers (rapid actions)", async ({
    page,
    request,
  }) => {
    // ⏳ Phase 6 feature - Rapid action cancellation not yet fully implemented
    // T066: explicit fixme (not a silent skip) so the missing implementation stays
    // visible in the report; the body below does not execute while it is active.
    test.fixme(true, "T066 - cancel-and-replace sensory feedback not implemented (Phase 6)");

    // Wait for app to be fully ready
    await waitForAppReady(page);

    const feedbackElement = page.locator('[data-testid="sensory-feedback"]');
    const modeSelector = page.locator('[data-testid="mode-selector"]');

    // Set Muse mode for PROVOKE
    await modeSelector.selectOption("muse");
    await openHeaderDevTools(page);
    const manualTrigger = page.locator('[data-testid="manual-trigger-button"]');

    // Trigger first action (PROVOKE via manual button)
    await manualTrigger.click();
    await expect(feedbackElement).toHaveAttribute("data-animation", "glitch", { timeout: 5000 });

    // Immediately trigger second action (DELETE via test endpoint)
    const deleteResponse = await request.post("http://localhost:8000/test/trigger-delete", {
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
   * **Status**: SKIPPED - Phase 6 feature not yet implemented
   * **Note**: This is Phase 6 (Optional UI Polish) - not blocking production readiness
   * TODO: Enable this test once rejection feedback visual enhancements are implemented (Phase 6)
   */
  test("rejection feedback matches P1 implementation", async ({ page }) => {
    // ⏳ Phase 6 feature - Rejection feedback visual enhancements not yet implemented
    // T066: explicit fixme (not a silent skip) so the missing implementation stays
    // visible in the report; the body below does not execute while it is active.
    test.fixme(true, "T066 - rejection feedback visual enhancements not implemented (Phase 6)");

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
