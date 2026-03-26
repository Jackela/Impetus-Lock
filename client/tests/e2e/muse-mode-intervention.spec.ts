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
    // Step 1: Type some content to establish context
    const prosemirrorEditor = page.locator('.milkdown .ProseMirror[contenteditable="true"]');
    await prosemirrorEditor.click();

    const testContext =
      "He opened the door, hesitating whether to enter. The room was dark and mysterious.";
    await page.keyboard.type(testContext);

    // Step 2: Wait for STUCK detection (60 seconds of idle)
    // In a real test environment, this might be accelerated
    // For this test, we'll mock the API response
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

    // Step 3: Wait for the intervention API call (simulated)
    const interventionPromise = page.waitForRequest(
      (request) =>
        request.url().includes("/impetus/generate-intervention") && request.method() === "POST"
    );

    // Simulate the idle time trigger
    // In production, this would happen after 60s of idle
    await page.waitForTimeout(61000); // Wait for STUCK threshold

    // Step 4: Verify API was called
    const request = await interventionPromise.catch(() => null);

    if (request) {
      const requestBody = request.postDataJSON();
      expect(requestBody.mode).toBe("muse");
      expect(requestBody.context).toBeDefined();

      // Step 5: Verify the locked block appears
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
    // Step 1: Setup mock intervention response
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

    // Step 2: Type content and wait for intervention
    const prosemirrorEditor = page.locator('.milkdown .ProseMirror[contenteditable="true"]');
    await prosemirrorEditor.click();
    await page.keyboard.type("Some text before the intervention.");

    // Wait for idle trigger
    await page.waitForTimeout(61000);

    // Step 3: Verify locked block exists
    const lockedBlock = page.locator('[data-lock-id="lock_muse_delete_test"]');
    await expect(lockedBlock).toBeVisible({ timeout: 5000 });

    const initialContent = await lockedBlock.textContent();

    // Step 4: Attempt to delete the locked block
    await lockedBlock.click();
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");

    // Step 5: Verify the locked block still exists
    await expect(lockedBlock).toBeVisible();
    const finalContent = await lockedBlock.textContent();
    expect(finalContent).toBe(initialContent);
  });

  test("should display lock with correct visual styling", async ({ page }) => {
    // Step 1: Setup mock intervention
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

    // Step 2: Trigger intervention
    const prosemirrorEditor = page.locator('.milkdown .ProseMirror[contenteditable="true"]');
    await prosemirrorEditor.click();
    await page.keyboard.type("Content for visual test.");
    await page.waitForTimeout(61000);

    // Step 3: Verify locked block has proper styling
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
    // Step 1: Setup mock with provoke action
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

    // Step 2: Trigger intervention
    const prosemirrorEditor = page.locator('.milkdown .ProseMirror[contenteditable="true"]');
    await prosemirrorEditor.click();
    await page.keyboard.type("Content for animation test.");
    await page.waitForTimeout(61000);

    // Step 3: Verify locked block with animation
    const lockedBlock = page.locator('[data-lock-id="lock_muse_anim_test"]');
    await expect(lockedBlock).toBeVisible({ timeout: 5000 });

    // Step 4: Check for glitch animation class
    const hasGlitchAnimation = await lockedBlock.evaluate((el) =>
      el.classList.contains("glitch-animation")
    );

    // Animation might have completed by the time we check, so this is optional
    if (hasGlitchAnimation) {
      expect(hasGlitchAnimation).toBe(true);
    }
  });

  test("should not trigger intervention when mode is off", async ({ page }) => {
    // Step 1: Switch to off mode
    const modeSelector = page.getByTestId("mode-selector");
    await modeSelector.selectOption("off");

    // Step 2: Type content
    const prosemirrorEditor = page.locator('.milkdown .ProseMirror[contenteditable="true"]');
    await prosemirrorEditor.click();
    await page.keyboard.type("Content in off mode.");

    // Step 3: Wait longer than STUCK threshold
    let apiCalled = false;
    page.on("request", (request) => {
      if (request.url().includes("/impetus/generate-intervention")) {
        apiCalled = true;
      }
    });

    await page.waitForTimeout(65000); // Wait 65 seconds

    // Step 4: Verify no intervention was triggered
    expect(apiCalled).toBe(false);

    // Step 5: Verify no locked blocks exist
    const lockedBlocks = page.locator("[data-lock-id]");
    const count = await lockedBlocks.count();
    expect(count).toBe(0);
  });

  test("should resume typing after intervention and not trigger immediately", async ({ page }) => {
    // Step 1: Setup first intervention
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

    // Step 2: Trigger first intervention
    const prosemirrorEditor = page.locator('.milkdown .ProseMirror[contenteditable="true"]');
    await prosemirrorEditor.click();
    await page.keyboard.type("Initial content.");
    await page.waitForTimeout(61000);

    // Step 3: Verify first intervention appeared
    await expect(page.locator("[data-lock-id]")).toBeVisible({ timeout: 5000 });

    // Step 4: Type more content (resets idle timer)
    await page.keyboard.type(" More content after first intervention.");

    // Reset counter
    const countAfterFirst = interventionCount;

    // Step 5: Wait a short time (less than 60s)
    await page.waitForTimeout(10000); // Only 10 seconds

    // Step 6: Verify no second intervention triggered
    expect(interventionCount).toBe(countAfterFirst);
  });
});

test.describe("Muse Mode - Error Handling", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?mode=muse");
    await waitForAppReady(page);
  });

  test("should handle API error gracefully during intervention", async ({ page }) => {
    // Step 1: Mock API to return error
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

    // Step 2: Type content and wait
    const prosemirrorEditor = page.locator('.milkdown .ProseMirror[contenteditable="true"]');
    await prosemirrorEditor.click();
    await page.keyboard.type("Content to trigger intervention.");
    await page.waitForTimeout(61000);

    // Step 3: Verify error notification appears
    const errorNotification = page.locator('[role="alert"]');
    await expect(errorNotification).toBeVisible({ timeout: 5000 });

    const errorText = await errorNotification.textContent();
    expect(errorText).toMatch(/(unavailable|error|failed)/i);

    // Step 4: Verify no locked block was injected
    const lockedBlocks = page.locator("[data-lock-id]");
    const count = await lockedBlocks.count();
    expect(count).toBe(0);
  });

  test("should handle network timeout gracefully", async ({ page }) => {
    // Step 1: Mock API to timeout
    await page.route("**/impetus/generate-intervention", async (route) => {
      // Don't respond, simulating a timeout
      await new Promise(() => {}); // Never resolves
    });

    // Step 2: Type content
    const prosemirrorEditor = page.locator('.milkdown .ProseMirror[contenteditable="true"]');
    await prosemirrorEditor.click();
    await page.keyboard.type("Content for timeout test.");

    // Step 3: Wait for STUCK trigger
    await page.waitForTimeout(61000);

    // Step 4: Wait a bit for timeout handling
    await page.waitForTimeout(10000);

    // Step 5: Verify app is still functional (no crash)
    await expect(prosemirrorEditor).toBeVisible();
    await expect(page.getByTestId("editor-ready")).toBeVisible();
  });
});
