/**
 * E2E tests for Muse mode intervention workflow.
 *
 * Tests automatic STUCK detection (60s idle) and intervention injection.
 *
 * Constitutional Compliance:
 * - Article III (TDD): Critical user journey E2E tests (RED phase)
 * - Article V (Documentation): Complete JSDoc for all test scenarios
 *
 * Success Criteria:
 * - SC-002: STUCK detection accuracy ≥95%
 * - SC-003: Intervention response time <2s (excluding idle wait)
 */

import { test, expect } from "@playwright/test";

test.describe("Muse Mode - STUCK Detection and Intervention", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to editor in Muse mode
    await page.goto("http://localhost:5173?mode=muse");

    // Wait for editor to initialize
    await page.waitForSelector(".milkdown-editor", { state: "visible" });
  });

  test("should detect STUCK state after 60s idle and trigger Muse intervention", async ({
    page,
  }) => {
    // Setup API intercept to verify request
    const apiCall = page.waitForRequest(
      (request) =>
        request.url().includes("/impetus/generate-intervention") && request.method() === "POST"
    );

    // Type a sentence
    const editor = page.locator(".milkdown-editor");
    await editor.click();
    await editor.type("他打开门，犹豫着要不要进去。");

    // Wait for STUCK threshold (60s)
    // Note: In real implementation, use page.clock.fastForward() for speed
    await page.waitForTimeout(60000);

    // Verify API was called
    const request = await apiCall;
    const requestBody = request.postDataJSON();

    expect(requestBody.mode).toBe("muse");
    expect(requestBody.context).toContain("他打开门");

    // Verify Idempotency-Key and Contract-Version headers
    expect(request.headers()["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(request.headers()["x-contract-version"]).toBe("2.0.0");
  });

  test("should inject locked blockquote with correct lock_id after intervention", async ({
    page,
  }) => {
    // Mock API response
    await page.route("**/impetus/generate-intervention", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          action: "provoke",
          content: "> 为什么门在这里？谁建造了它？",
          lock_id: "lock_test_12345",
          anchor: {
            type: "pos",
            from: 14,
          },
          action_id: "act_test_67890",
        }),
      });
    });

    // Type text and trigger STUCK
    const editor = page.locator(".milkdown-editor");
    await editor.click();
    await editor.type("他打开门，犹豫着要不要进去。");

    // Fast-forward to STUCK state
    await page.waitForTimeout(60000);

    // Verify locked block injected
    const lockedBlock = page.locator('[data-lock-id="lock_test_12345"]');
    await expect(lockedBlock).toBeVisible({ timeout: 3000 });

    // Verify content
    await expect(lockedBlock).toContainText("为什么门在这里？谁建造了它？");

    // Verify block is un-deletable
    await lockedBlock.click();
    await page.keyboard.press("Backspace");

    // Block should still exist
    await expect(lockedBlock).toBeVisible();
  });

  test('should play "Glitch" animation on intervention injection', async ({ page }) => {
    // Mock API response
    await page.route("**/impetus/generate-intervention", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          action: "provoke",
          content: "> 施压文本",
          lock_id: "lock_anim_test",
          anchor: { type: "pos", from: 10 },
          action_id: "act_anim_test",
        }),
      });
    });

    // Type and trigger STUCK
    const editor = page.locator(".milkdown-editor");
    await editor.click();
    await editor.type("测试文本");
    await page.waitForTimeout(60000);

    // Verify Glitch animation class applied
    const lockedBlock = page.locator('[data-lock-id="lock_anim_test"]');
    await expect(lockedBlock).toHaveClass(/glitch-animation/, { timeout: 3000 });

    // Verify animation completes (class removed after ~1s)
    await expect(lockedBlock).not.toHaveClass(/glitch-animation/, { timeout: 2000 });
  });

  test('should play "Clank" sound on intervention injection', async ({ page }) => {
    // Setup audio element spy
    await page.addInitScript(() => {
      window.audioPlayed = false;
      const originalPlay = HTMLAudioElement.prototype.play;
      HTMLAudioElement.prototype.play = function () {
        if (this.src.includes("clank.mp3")) {
          window.audioPlayed = true;
        }
        return originalPlay.call(this);
      };
    });

    // Mock API response
    await page.route("**/impetus/generate-intervention", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          action: "provoke",
          content: "> 音效测试",
          lock_id: "lock_sound_test",
          anchor: { type: "pos", from: 10 },
          action_id: "act_sound_test",
        }),
      });
    });

    // Type and trigger STUCK
    const editor = page.locator(".milkdown-editor");
    await editor.click();
    await editor.type("测试文本");
    await page.waitForTimeout(60000);

    // Verify sound played
    const audioPlayed = await page.evaluate(() => window.audioPlayed);
    expect(audioPlayed).toBe(true);
  });

  test("should return different content on second STUCK intervention (no repetition)", async ({
    page,
  }) => {
    const responses = [
      {
        action: "provoke",
        content: "> 第一次施压",
        lock_id: "lock_first",
        anchor: { type: "pos", from: 10 },
        action_id: "act_first",
      },
      {
        action: "provoke",
        content: "> 第二次施压（不同内容）",
        lock_id: "lock_second",
        anchor: { type: "pos", from: 20 },
        action_id: "act_second",
      },
    ];

    let callCount = 0;
    await page.route("**/impetus/generate-intervention", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(responses[callCount++] || responses[1]),
      });
    });

    // First intervention cycle
    const editor = page.locator(".milkdown-editor");
    await editor.click();
    await editor.type("第一段文本");
    await page.waitForTimeout(60000);

    const firstBlock = page.locator('[data-lock-id="lock_first"]');
    await expect(firstBlock).toBeVisible({ timeout: 3000 });
    await expect(firstBlock).toContainText("第一次施压");

    // Resume typing to exit STUCK state
    await editor.type("继续写作");

    // Second intervention cycle
    await page.waitForTimeout(60000);

    const secondBlock = page.locator('[data-lock-id="lock_second"]');
    await expect(secondBlock).toBeVisible({ timeout: 3000 });
    await expect(secondBlock).toContainText("第二次施压（不同内容）");

    // Verify both blocks exist (no replacement)
    await expect(firstBlock).toBeVisible();
    await expect(secondBlock).toBeVisible();
  });

  test("should extract last 3 sentences as context for API request", async ({ page }) => {
    const apiCall = page.waitForRequest(
      (request) =>
        request.url().includes("/impetus/generate-intervention") && request.method() === "POST"
    );

    // Type multiple sentences
    const editor = page.locator(".milkdown-editor");
    await editor.click();
    await editor.type("第一句话。第二句话。第三句话。第四句话。第五句话。");

    // Trigger STUCK
    await page.waitForTimeout(60000);

    // Verify context contains last 3 sentences only
    const request = await apiCall;
    const requestBody = request.postDataJSON();

    expect(requestBody.context).toBe("第三句话。第四句话。第五句话。");
    expect(requestBody.context).not.toContain("第一句话");
    expect(requestBody.context).not.toContain("第二句话");
  });

  test("should handle edge case: document has <3 sentences", async ({ page }) => {
    const apiCall = page.waitForRequest(
      (request) =>
        request.url().includes("/impetus/generate-intervention") && request.method() === "POST"
    );

    // Type only 2 sentences
    const editor = page.locator(".milkdown-editor");
    await editor.click();
    await editor.type("第一句话。第二句话。");

    // Trigger STUCK
    await page.waitForTimeout(60000);

    // Verify context contains all available sentences
    const request = await apiCall;
    const requestBody = request.postDataJSON();

    expect(requestBody.context).toBe("第一句话。第二句话。");
  });

  test('should not trigger intervention when mode="off"', async ({ page }) => {
    // Navigate to editor with mode=off
    await page.goto("http://localhost:5173?mode=off");
    await page.waitForSelector(".milkdown-editor", { state: "visible" });

    // Setup API spy to verify NO calls
    let apiCalled = false;
    await page.route("**/impetus/generate-intervention", (route) => {
      apiCalled = true;
      route.fulfill({ status: 200, body: "{}" });
    });

    // Type and wait beyond STUCK threshold
    const editor = page.locator(".milkdown-editor");
    await editor.click();
    await editor.type("测试文本");
    await page.waitForTimeout(65000); // 65s > 60s threshold

    // Verify API was NOT called
    expect(apiCalled).toBe(false);
  });

  test("should handle API error gracefully (show error notification)", async ({ page }) => {
    // Mock API failure
    await page.route("**/impetus/generate-intervention", (route) => {
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: "InternalServerError",
          message: "LLM service unavailable",
        }),
      });
    });

    // Type and trigger STUCK
    const editor = page.locator(".milkdown-editor");
    await editor.click();
    await editor.type("测试文本");
    await page.waitForTimeout(60000);

    // Verify error notification displayed
    const errorNotification = page.locator('[role="alert"]');
    await expect(errorNotification).toBeVisible({ timeout: 3000 });
    await expect(errorNotification).toContainText("服务暂时不可用");
  });

  test("should respect idempotency (same response for duplicate requests)", async ({ page }) => {
    let callCount = 0;
    const mockResponse = {
      action: "provoke",
      content: "> 幂等性测试",
      lock_id: "lock_idempotent",
      anchor: { type: "pos", from: 10 },
      action_id: "act_idempotent",
    };

    await page.route("**/impetus/generate-intervention", (route) => {
      callCount++;
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockResponse),
      });
    });

    // Trigger intervention
    const editor = page.locator(".milkdown-editor");
    await editor.click();
    await editor.type("测试文本");
    await page.waitForTimeout(60000);

    // Verify API called exactly once
    expect(callCount).toBe(1);

    // Manually trigger intervention again (via Demo button in US4)
    // This should use cached response (same Idempotency-Key)
    await page.click('[data-testid="demo-trigger"]');

    // Verify no additional API call within 15s window
    await page.waitForTimeout(1000);
    expect(callCount).toBe(1);
  });
});
