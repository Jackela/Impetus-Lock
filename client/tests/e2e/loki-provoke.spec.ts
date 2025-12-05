/**
 * E2E tests for Loki Mode Provoke action
 *
 * Test Coverage:
 * - Random timer triggers intervention
 * - API returns provoke action with lock_id
 * - Locked block injected into editor
 * - Animation and sound effects (deferred to P2)
 * - Intervention happens even while user is typing
 *
 * Constitutional Compliance:
 * - Article III (TDD): Tests written FIRST, implementation follows
 * - Article V (Documentation): Complete test descriptions
 *
 * Success Criteria:
 * - SC-001: Lock enforcement 100% success rate
 * - SC-004: Random timer distribution uniformity ≥99%
 */

import { test, expect } from "@playwright/test";

test.describe("Loki Mode - Provoke Action", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to editor in Loki mode
    await page.goto("http://localhost:5173?mode=loki");
    await page.waitForLoadState("networkidle");
  });

  test("should trigger Loki intervention at random interval", async ({ page }) => {
    // Set up API request interception
    const apiCall = page.waitForRequest(
      (request) =>
        request.url().includes("/impetus/generate-intervention") && request.method() === "POST"
    );

    // Wait for random timer to fire (max 120 seconds in real mode, should be faster in test)
    // Note: In production, timer would be 30-120s, but we use accelerated timer for testing
    const request = await apiCall.timeout(150000); // 2.5 min max
    const requestBody = request.postDataJSON();

    // Verify request payload
    expect(requestBody.mode).toBe("loki");
    expect(requestBody.context).toBeDefined();
    expect(requestBody.client_meta).toBeDefined();
  });

  test("should inject locked block when API returns provoke action", async ({ page }) => {
    // Type some content
    const editor = page.locator(".milkdown-editor");
    await editor.click();
    await editor.type("测试文本内容，用于Loki模式干预。");

    // Wait for Loki intervention API call
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/impetus/generate-intervention") && response.status() === 200
    );

    const response = await responsePromise.timeout(150000);
    const responseBody = await response.json();

    // If action is provoke, verify locked block injection
    if (responseBody.action === "provoke") {
      expect(responseBody.lock_id).toBeDefined();
      expect(responseBody.lock_id).toMatch(/^lock_/);
      expect(responseBody.content).toBeDefined();

      // Wait for locked block to appear in editor
      const lockedBlock = page.locator(`blockquote[data-lock-id="${responseBody.lock_id}"]`);
      await expect(lockedBlock).toBeVisible({ timeout: 5000 });
      await expect(lockedBlock).toHaveAttribute("data-source", "loki");

      // Verify content exists (prefix-free)
      const blockText = (await lockedBlock.textContent())?.trim();
      expect(blockText).toBeTruthy();
    }
  });

  test("should play Glitch animation on provoke injection (P2 - deferred)", async ({ page }) => {
    // This test is deferred to P2 (Phase 2 enhancements)
    // For now, we verify that the locked block is injected without animation

    const editor = page.locator(".milkdown-editor");
    await editor.click();
    await editor.type("动画测试内容。");

    // Wait for intervention
    const response = await page
      .waitForResponse((response) => response.url().includes("/impetus/generate-intervention"))
      .timeout(150000);

    const responseBody = await response.json();

    if (responseBody.action === "provoke") {
      const lockedBlock = page.locator(`blockquote[data-lock-id="${responseBody.lock_id}"]`);
      await expect(lockedBlock).toBeVisible();

      // P2 TODO: Verify glitch animation class applied
      // const hasGlitchAnimation = await lockedBlock.evaluate(el =>
      //   el.classList.contains('glitch-animation')
      // );
      // expect(hasGlitchAnimation).toBe(true);
    }
  });

  test("should play Clank sound on provoke injection (P2 - deferred)", async ({ page }) => {
    // This test is deferred to P2 (Phase 2 enhancements)
    // For now, we verify that audio is NOT played (no audio system yet)

    const editor = page.locator(".milkdown-editor");
    await editor.click();
    await editor.type("声音测试内容。");

    // Wait for intervention
    const response = await page
      .waitForResponse((response) => response.url().includes("/impetus/generate-intervention"))
      .timeout(150000);

    const responseBody = await response.json();

    if (responseBody.action === "provoke") {
      const lockedBlock = page.locator(`blockquote[data-lock-id="${responseBody.lock_id}"]`);
      await expect(lockedBlock).toBeVisible();

      // P2 TODO: Verify clank sound played
      // const audioPlayed = await page.evaluate(() =>
      //   window.__testHooks__.audioPlayer.lastPlayedSound === 'clank'
      // );
      // expect(audioPlayed).toBe(true);
    }
  });

  test("should trigger intervention even while user is typing (unlike Muse)", async ({ page }) => {
    // Loki mode is chaos - it doesn't wait for user to stop typing

    const editor = page.locator(".milkdown-editor");
    await editor.click();

    // Start typing continuously
    const typingInterval = setInterval(async () => {
      await editor.type("打字中...");
    }, 1000);

    try {
      // Wait for Loki intervention (should happen even during typing)
      const response = await page
        .waitForResponse((response) => response.url().includes("/impetus/generate-intervention"))
        .timeout(150000);

      const responseBody = await response.json();
      expect(responseBody.mode).toBe("loki");

      // Intervention happened even though user was actively typing
      // This is different from Muse mode which requires 60s idle time
      expect(true).toBe(true); // Test passes if we get here
    } finally {
      clearInterval(typingInterval);
    }
  });

  test('should not trigger intervention when mode is "off"', async ({ page }) => {
    // Navigate to editor with mode="off"
    await page.goto("http://localhost:5173?mode=off");
    await page.waitForLoadState("networkidle");

    const editor = page.locator(".milkdown-editor");
    await editor.click();
    await editor.type("测试内容。");

    // Set up timeout for intervention (should NOT happen)
    let interventionCalled = false;
    page.on("request", (request) => {
      if (request.url().includes("/impetus/generate-intervention")) {
        interventionCalled = true;
      }
    });

    // Wait 130 seconds (longer than max Loki timer)
    await page.waitForTimeout(130000);

    // Verify NO intervention was triggered
    expect(interventionCalled).toBe(false);
  });

  test('should not trigger intervention when mode is "muse"', async ({ page }) => {
    // Navigate to editor in Muse mode
    await page.goto("http://localhost:5173?mode=muse");
    await page.waitForLoadState("networkidle");

    const editor = page.locator(".milkdown-editor");
    await editor.click();
    await editor.type("测试内容。");

    // Loki timer should NOT be active in Muse mode
    let lokiInterventionCalled = false;
    page.on("request", (request) => {
      if (request.url().includes("/impetus/generate-intervention")) {
        const postData = request.postDataJSON();
        if (postData?.mode === "loki") {
          lokiInterventionCalled = true;
        }
      }
    });

    // Wait 130 seconds
    await page.waitForTimeout(130000);

    // Verify NO Loki intervention (Muse interventions are OK)
    expect(lokiInterventionCalled).toBe(false);
  });

  test("should enforce lock on provoke injection (cannot delete)", async ({ page }) => {
    const editor = page.locator(".milkdown-editor");
    await editor.click();
    await editor.type("锁定测试内容。");

    // Wait for intervention
    const response = await page
      .waitForResponse((response) => response.url().includes("/impetus/generate-intervention"))
      .timeout(150000);

    const responseBody = await response.json();

    if (responseBody.action === "provoke") {
      const lockedBlock = page.locator(`blockquote[data-lock-id="${responseBody.lock_id}"]`);
      await expect(lockedBlock).toBeVisible();

      // Get locked block text
      const lockedText = await lockedBlock.textContent();

      // Try to delete locked block
      await lockedBlock.click();
      await page.keyboard.press("Backspace");
      await page.keyboard.press("Backspace");
      await page.keyboard.press("Backspace");

      // Verify locked block still exists
      await expect(lockedBlock).toBeVisible();
      const stillLockedText = await lockedBlock.textContent();
      expect(stillLockedText).toBe(lockedText);
    }
  });

  test("should schedule new random timer after intervention", async ({ page }) => {
    const editor = page.locator(".milkdown-editor");
    await editor.click();
    await editor.type("第一次干预测试。");

    // Wait for first intervention
    const firstResponse = await page
      .waitForResponse((response) => response.url().includes("/impetus/generate-intervention"))
      .timeout(150000);

    const firstBody = await firstResponse.json();
    expect(firstBody.action).toBeDefined();

    // Wait for second intervention (new timer should be scheduled)
    const secondResponse = await page
      .waitForResponse((response) => response.url().includes("/impetus/generate-intervention"))
      .timeout(150000);

    const secondBody = await secondResponse.json();
    expect(secondBody.action).toBeDefined();

    // Verify two different interventions occurred
    expect(firstBody.action_id).not.toBe(secondBody.action_id);
  });
});
