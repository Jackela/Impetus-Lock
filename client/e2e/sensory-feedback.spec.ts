import { test, expect } from "@playwright/test";
import { waitForReactHydration, waitForAppReady } from "./helpers/waitHelpers";

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
   * **Status**: SKIPPED - Requires Phase 5 integration (T066)
   * **Blocker**: SensoryFeedback not yet wired to AI action events
   */
  test.skip("plays Whoosh sound and shows Fade-out animation on Delete", async ({ page }) => {
    // Wait for app to be fully ready
    await waitForAppReady(page);

    const feedbackElement = page.locator('[data-testid="sensory-feedback"]');
    const modeSelector = page.locator('[data-testid="mode-selector"]');

    // Set Loki mode (Delete actions occur randomly)
    await modeSelector.selectOption("loki");

    // Wait for Delete action to trigger (Loki random timing: 30-120s)
    // In test environment, this should be mockable/triggerable
    // TODO: Add test trigger mechanism for Delete actions

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
   * **Status**: SKIPPED - Requires Phase 5 integration (T066)
   * **Blocker**: Need mechanism to trigger rapid AI actions in test
   */
  test.skip("cancels previous animation when new action triggers (rapid actions)", async ({
    page,
  }) => {
    // Wait for app to be fully ready
    await waitForAppReady(page);

    const feedbackElement = page.locator('[data-testid="sensory-feedback"]');
    const manualTrigger = page.locator('[data-testid="manual-trigger-button"]');

    // Trigger first action (PROVOKE)
    await manualTrigger.click();
    await expect(feedbackElement).toHaveAttribute("data-animation", "glitch", { timeout: 5000 });

    // Immediately trigger second action (DELETE)
    // TODO: Add mechanism to trigger DELETE action in test
    // await triggerDeleteAction(page);

    // Verify animation changed (cancel-and-replace)
    await expect(feedbackElement).toHaveAttribute("data-animation", "fadeout", { timeout: 5000 });

    // Verify only Whoosh audio is playing (Clank stopped)
    // Audio verification requires advanced browser API mocking
    // TODO: Implement audio playback verification
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
   * **Status**: SKIPPED - Requires complex Milkdown/ProseMirror interaction
   * **Blocker**: Playwright locator methods (fill/selectText) don't work with ProseMirror
   * **Note**: This is Phase 6 (Optional UI Polish) - not blocking production readiness
   */
  test.skip("rejection feedback matches P1 implementation", async ({ page }) => {
    // Wait for app to be fully ready
    await waitForAppReady(page);

    const feedbackElement = page.locator('[data-testid="sensory-feedback"]');
    const editor = page.locator('[data-testid="milkdown-editor"]');

    // Create locked content
    await editor.fill("This is locked content <!-- LOCK: test-lock -->");

    // Attempt to delete locked content (should trigger REJECT)
    await editor.selectText("locked content");
    await page.keyboard.press("Backspace");

    // Verify Shake animation appears
    await expect(feedbackElement).toBeVisible({ timeout: 5000 });
    await expect(feedbackElement).toHaveAttribute("data-animation", "shake");

    // Wait for animation to complete (0.5s + buffer)
    await page.waitForTimeout(700);

    // Verify feedback disappears
    await expect(feedbackElement).not.toBeVisible();

    // Verify locked content was NOT deleted (P1 enforcement)
    await expect(editor).toContainText("locked content");
  });
});
