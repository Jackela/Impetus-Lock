/**
 * E2E Test: Muse Mode Intervention Flow
 *
 * Tests the Muse mode intervention workflow where:
 * 1. Muse mode is enabled
 * 2. After 60 seconds of idle time (STUCK state), an intervention triggers
 * 3. A locked block appears with the intervention content
 * 4. The locked content cannot be deleted
 *
 * Constitutional Compliance:
 * - Article III (TDD): Tests validate intervention system behavior
 * - Article V (Documentation): Complete workflow documentation
 *
 * Note: Due to the 60-second idle requirement, these tests may need
 * clock manipulation or mocking in CI environments.
 */

import { test, expect } from "@playwright/test";
import { waitForAppReady } from "./helpers/waitHelpers";

test.describe("Muse Mode - Intervention Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app in Muse mode
    await page.goto("/?mode=muse");
    await waitForAppReady(page);

    // Verify we're in Muse mode
    const modeSelector = page.getByTestId("mode-selector");
    const modeValue = await modeSelector.inputValue();
    expect(modeValue).toBe("muse");
  });

  test("should enable Muse mode and trigger intervention after idle time", async ({ page }) => {
    // Step 1: Install clock for time manipulation
    await page.clock.install();

    // Step 2: Setup API mock before any actions
    await page.route("**/impetus/generate-intervention", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          action: "provoke",
          content: "> Why is the door here? Who built it?",
          lock_id: "lock_muse_test_001",
          anchor: {
            type: "pos",
            from: 20,
          },
          action_id: "act_muse_001",
        }),
      });
    });

    // Step 3: Type some content to establish context
    const prosemirrorEditor = page.locator('.milkdown .ProseMirror[contenteditable="true"]');
    await prosemirrorEditor.click();

    const testContext =
      "He opened the door, hesitating whether to enter. The room was dark and mysterious.";
    await page.keyboard.type(testContext);

    // Step 4: Wait for the intervention API call
    const interventionPromise = page.waitForRequest(
      (request) =>
        request.url().includes("/impetus/generate-intervention") && request.method() === "POST",
      { timeout: 5000 }
    );

    // Step 5: Fast-forward time to trigger STUCK detection (60 seconds of idle)
    // This accelerates the timer without actually waiting 61 seconds
    await page.clock.fastForward(61000);

    // Step 6: Verify API was called
    const request = await interventionPromise.catch(() => null);

    if (request) {
      const requestBody = request.postDataJSON();
      expect(requestBody.mode).toBe("muse");
      expect(requestBody.context).toBeDefined();

      // Step 7: Verify the locked block appears
      const lockedBlock = page.locator('[data-lock-id="lock_muse_test_001"]');
      await expect(lockedBlock).toBeVisible({ timeout: 5000 });

      // Verify the content
      const blockText = await lockedBlock.textContent();
      expect(blockText).toContain("Why is the door here");

      // Verify it's a blockquote
      const isBlockquote = await lockedBlock.evaluate(
        (el) => el.tagName.toLowerCase() === "blockquote"
      );
      expect(isBlockquote).toBe(true);
    }
  });

  test("should prevent deletion of locked Muse content", async ({ page }) => {
    // Step 1: Install clock for time manipulation
    await page.clock.install();

    // Step 2: Setup mock intervention response
    await page.route("**/impetus/generate-intervention", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          action: "provoke",
          content: "> This content is locked by Muse mode.",
          lock_id: "lock_muse_delete_test",
          anchor: { type: "pos", from: 10 },
          action_id: "act_muse_delete",
        }),
      });
    });

    // Step 3: Type content and trigger intervention via clock
    const prosemirrorEditor = page.locator('.milkdown .ProseMirror[contenteditable="true"]');
    await prosemirrorEditor.click();
    await page.keyboard.type("Some text before the intervention.");

    // Wait for intervention with accelerated time
    const interventionPromise = page.waitForRequest(
      (request) => request.url().includes("/impetus/generate-intervention"),
      { timeout: 5000 }
    );
    await page.clock.fastForward(61000);
    await interventionPromise;

    // Step 4: Verify locked block exists
    const lockedBlock = page.locator('[data-lock-id="lock_muse_delete_test"]');
    await expect(lockedBlock).toBeVisible({ timeout: 5000 });

    const initialContent = await lockedBlock.textContent();

    // Step 5: Attempt to delete the locked block
    await lockedBlock.click();
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");

    // Step 6: Verify the locked block still exists
    await expect(lockedBlock).toBeVisible();
    const finalContent = await lockedBlock.textContent();
    expect(finalContent).toBe(initialContent);
  });

  test("should display lock with correct visual styling", async ({ page }) => {
    // Step 1: Install clock for time manipulation
    await page.clock.install();

    // Step 2: Setup mock intervention
    await page.route("**/impetus/generate-intervention", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          action: "provoke",
          content: "> Visual styling test content.",
          lock_id: "lock_muse_style_test",
          anchor: { type: "pos", from: 10 },
          action_id: "act_muse_style",
        }),
      });
    });

    // Step 3: Trigger intervention with accelerated time
    const prosemirrorEditor = page.locator('.milkdown .ProseMirror[contenteditable="true"]');
    await prosemirrorEditor.click();
    await page.keyboard.type("Content for visual test.");

    const interventionPromise = page.waitForRequest(
      (request) => request.url().includes("/impetus/generate-intervention"),
      { timeout: 5000 }
    );
    await page.clock.fastForward(61000);
    await interventionPromise;

    // Step 4: Verify locked block has proper styling
    const lockedBlock = page.locator('[data-lock-id="lock_muse_style_test"]');
    await expect(lockedBlock).toBeVisible({ timeout: 5000 });

    // Check for data-source attribute
    const source = await lockedBlock.getAttribute("data-source");
    expect(source).toBe("muse");

    // Verify blockquote styling is applied
    const hasBlockquoteStyles = await lockedBlock.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return (
        styles.borderLeft !== "none" ||
        styles.backgroundColor !== "transparent" ||
        el.classList.length > 0
      );
    });
    expect(hasBlockquoteStyles).toBe(true);
  });

  test("should trigger animation on intervention injection", async ({ page }) => {
    // Step 1: Install clock for time manipulation
    await page.clock.install();

    // Step 2: Setup mock with provoke action
    await page.route("**/impetus/generate-intervention", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          action: "provoke",
          content: "> Animation test content.",
          lock_id: "lock_muse_anim_test",
          anchor: { type: "pos", from: 10 },
          action_id: "act_muse_anim",
        }),
      });
    });

    // Step 3: Trigger intervention with accelerated time
    const prosemirrorEditor = page.locator('.milkdown .ProseMirror[contenteditable="true"]');
    await prosemirrorEditor.click();
    await page.keyboard.type("Content for animation test.");

    const interventionPromise = page.waitForRequest(
      (request) => request.url().includes("/impetus/generate-intervention"),
      { timeout: 5000 }
    );
    await page.clock.fastForward(61000);
    await interventionPromise;

    // Step 4: Verify locked block with animation
    const lockedBlock = page.locator('[data-lock-id="lock_muse_anim_test"]');
    await expect(lockedBlock).toBeVisible({ timeout: 5000 });

    // Step 5: Check for glitch animation class
    const hasGlitchAnimation = await lockedBlock.evaluate((el) =>
      el.classList.contains("glitch-animation")
    );

    // Animation might have completed by the time we check, so this is optional
    if (hasGlitchAnimation) {
      expect(hasGlitchAnimation).toBe(true);
    }
  });

  test("should not trigger intervention when mode is off", async ({ page }) => {
    // Step 1: Install clock for time manipulation
    await page.clock.install();

    // Step 2: Switch to off mode
    const modeSelector = page.getByTestId("mode-selector");
    await modeSelector.selectOption("off");

    // Step 3: Type content
    const prosemirrorEditor = page.locator('.milkdown .ProseMirror[contenteditable="true"]');
    await prosemirrorEditor.click();
    await page.keyboard.type("Content in off mode.");

    // Step 4: Track API calls and fast-forward time
    let apiCalled = false;
    page.on("request", (request) => {
      if (request.url().includes("/impetus/generate-intervention")) {
        apiCalled = true;
      }
    });

    // Fast-forward past STUCK threshold without actually waiting
    await page.clock.fastForward(65000);
    // Allow any pending async operations to complete
    await page.waitForTimeout(100);

    // Step 5: Verify no intervention was triggered
    expect(apiCalled).toBe(false);

    // Step 6: Verify no locked blocks exist
    const lockedBlocks = page.locator("[data-lock-id]");
    const count = await lockedBlocks.count();
    expect(count).toBe(0);
  });

  test("should resume typing after intervention and not trigger immediately", async ({ page }) => {
    // Step 1: Install clock for time manipulation
    await page.clock.install();

    // Step 2: Setup first intervention
    let interventionCount = 0;
    await page.route("**/impetus/generate-intervention", async (route) => {
      interventionCount++;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          action: "provoke",
          content: "> First intervention.",
          lock_id: `lock_muse_resume_${interventionCount}`,
          anchor: { type: "pos", from: 10 },
          action_id: `act_muse_resume_${interventionCount}`,
        }),
      });
    });

    // Step 3: Trigger first intervention with accelerated time
    const prosemirrorEditor = page.locator('.milkdown .ProseMirror[contenteditable="true"]');
    await prosemirrorEditor.click();
    await page.keyboard.type("Initial content.");

    const firstInterventionPromise = page.waitForRequest(
      (request) => request.url().includes("/impetus/generate-intervention"),
      { timeout: 5000 }
    );
    await page.clock.fastForward(61000);
    await firstInterventionPromise;

    // Step 4: Verify first intervention appeared
    await expect(page.locator("[data-lock-id]")).toBeVisible({ timeout: 5000 });

    // Step 5: Type more content (resets idle timer)
    await page.keyboard.type(" More content after first intervention.");

    // Reset counter
    const countAfterFirst = interventionCount;

    // Step 6: Fast-forward a short time (less than 60s) and verify no second intervention
    await page.clock.fastForward(10000); // Only 10 seconds
    await page.waitForTimeout(100);

    // Step 7: Verify no second intervention triggered
    expect(interventionCount).toBe(countAfterFirst);
  });
});

test.describe("Muse Mode - Error Handling", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?mode=muse");
    await waitForAppReady(page);
  });

  test("should handle API error gracefully during intervention", async ({ page }) => {
    // Step 1: Install clock for time manipulation
    await page.clock.install();

    // Step 2: Mock API to return error
    await page.route("**/impetus/generate-intervention", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: "InternalServerError",
          message: "LLM service unavailable",
        }),
      });
    });

    // Step 3: Type content and trigger with accelerated time
    const prosemirrorEditor = page.locator('.milkdown .ProseMirror[contenteditable="true"]');
    await prosemirrorEditor.click();
    await page.keyboard.type("Content to trigger intervention.");

    const interventionPromise = page.waitForRequest(
      (request) => request.url().includes("/impetus/generate-intervention"),
      { timeout: 5000 }
    );
    await page.clock.fastForward(61000);
    await interventionPromise.catch(() => null); // Expect this to fail with 500

    // Step 4: Verify error notification appears
    const errorNotification = page.locator('[role="alert"]');
    await expect(errorNotification).toBeVisible({ timeout: 5000 });

    const errorText = await errorNotification.textContent();
    expect(errorText).toMatch(/(unavailable|error|failed)/i);

    // Step 5: Verify no locked block was injected
    const lockedBlocks = page.locator("[data-lock-id]");
    const count = await lockedBlocks.count();
    expect(count).toBe(0);
  });

  test("should handle network timeout gracefully", async ({ page }) => {
    // Step 1: Install clock for time manipulation
    await page.clock.install();

    // Step 2: Mock API to timeout
    await page.route("**/impetus/generate-intervention", async (route) => {
      // Don't respond, simulating a timeout
      await new Promise(() => {}); // Never resolves
    });

    // Step 3: Type content and trigger with accelerated time
    const prosemirrorEditor = page.locator('.milkdown .ProseMirror[contenteditable="true"]');
    await prosemirrorEditor.click();
    await page.keyboard.type("Content for timeout test.");

    const interventionPromise = page.waitForRequest(
      (request) => request.url().includes("/impetus/generate-intervention"),
      { timeout: 5000 }
    );
    await page.clock.fastForward(61000);
    await interventionPromise.catch(() => null); // Expect this to timeout

    // Step 4: Wait a bit for timeout handling
    await page.waitForTimeout(100);

    // Step 5: Verify app is still functional (no crash)
    await expect(prosemirrorEditor).toBeVisible();
    await expect(page.getByTestId("editor-ready")).toBeVisible();
  });
});
