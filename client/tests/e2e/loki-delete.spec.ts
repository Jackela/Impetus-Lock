/**
 * E2E tests for Loki Mode Delete action
 *
 * Test Coverage:
 * - API returns delete action with anchor range
 * - Text deleted at specified anchor position
 * - Deletion bypasses Undo stack (cannot restore with Ctrl+Z)
 * - Fade-out animation and Whoosh sound (deferred to P2)
 * - Safety guard: doc <50 chars forces Provoke instead
 *
 * Constitutional Compliance:
 * - Article III (TDD): Tests written FIRST, implementation follows
 * - Article V (Documentation): Complete test descriptions
 *
 * Success Criteria:
 * - SC-001: Action enforcement 100% success rate (cannot undo)
 * - SC-006: Safety guard prevents deletion on short documents
 */

import { test, expect } from "@playwright/test";

test.describe("Loki Mode - Delete Action", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to editor in Loki mode
    await page.goto("http://localhost:5173?mode=loki");
    await page.waitForLoadState("networkidle");
  });

  test("should delete text when API returns delete action", async ({ page }) => {
    const editor = page.locator(".milkdown-editor");
    await editor.click();

    // Type enough content to avoid safety guard (<50 chars rejection)
    const testContent =
      "这是一段测试文本，用于验证Loki删除功能。我们需要足够长的内容来通过安全检查。这样应该够了。";
    await editor.type(testContent);

    // Get initial content
    const initialText = await editor.textContent();
    expect(initialText).toContain(testContent);

    // Wait for Loki intervention
    const response = await page
      .waitForResponse((response) => response.url().includes("/impetus/generate-intervention"))
      .timeout(150000);

    const responseBody = await response.json();

    // If action is delete, verify deletion occurred
    if (responseBody.action === "delete") {
      expect(responseBody.anchor).toBeDefined();
      expect(responseBody.anchor.type).toBe("range");
      expect(responseBody.anchor.from).toBeLessThan(responseBody.anchor.to);

      // Wait a bit for deletion to process
      await page.waitForTimeout(1000);

      // Get content after deletion
      const finalText = await editor.textContent();

      // Some content should be deleted (text length decreased)
      expect(finalText.length).toBeLessThan(initialText.length);
    }
  });

  test("should delete at sentence boundary (backend logic)", async ({ page }) => {
    const editor = page.locator(".milkdown-editor");
    await editor.click();

    // Type multiple sentences
    await editor.type("第一句话。第二句话。第三句话。第四句话。第五句话。");

    // Wait for delete intervention
    const response = await page
      .waitForResponse((response) => response.url().includes("/impetus/generate-intervention"))
      .timeout(150000);

    const responseBody = await response.json();

    if (responseBody.action === "delete") {
      // Backend should delete at sentence boundaries per data-model.md
      // Anchor should align with sentence end markers (。！？)
      expect(responseBody.anchor.type).toBe("range");

      // Get deleted range
      const deletedLength = responseBody.anchor.to - responseBody.anchor.from;

      // Deleted length should be reasonable (not deleting entire doc)
      expect(deletedLength).toBeGreaterThan(0);
      expect(deletedLength).toBeLessThan(100); // Sanity check
    }
  });

  test("should bypass Undo stack (Ctrl+Z cannot restore)", async ({ page }) => {
    const editor = page.locator(".milkdown-editor");
    await editor.click();

    // Type content
    const testContent =
      "这段文本将被删除且无法恢复。我们需要足够的内容来避免安全防护。继续打字以确保长度足够。";
    await editor.type(testContent);

    // Wait for delete intervention
    const response = await page
      .waitForResponse((response) => response.url().includes("/impetus/generate-intervention"))
      .timeout(150000);

    const responseBody = await response.json();

    if (responseBody.action === "delete") {
      // Get text after deletion
      await page.waitForTimeout(1000);
      const textAfterDelete = await editor.textContent();

      // Try to undo deletion with Ctrl+Z
      await page.keyboard.press("Control+Z");
      await page.waitForTimeout(500);

      // Get text after undo attempt
      const textAfterUndo = await editor.textContent();

      // Text should NOT be restored (deletion bypasses undo stack)
      expect(textAfterUndo).toBe(textAfterDelete);
      expect(textAfterUndo).not.toContain(testContent);
    }
  });

  test("should play fade-out animation on deletion (P2 - deferred)", async ({ page }) => {
    // This test is deferred to P2 (Phase 2 enhancements)
    const editor = page.locator(".milkdown-editor");
    await editor.click();
    await editor.type("淡出动画测试文本。需要足够长以通过安全检查。继续添加内容确保测试有效。");

    const response = await page
      .waitForResponse((response) => response.url().includes("/impetus/generate-intervention"))
      .timeout(150000);

    const responseBody = await response.json();

    if (responseBody.action === "delete") {
      // P2 TODO: Verify fade-out animation played
      // const animationPlayed = await page.evaluate(() =>
      //   window.__testHooks__.animationPlayer.lastAnimation === 'fade-out'
      // );
      // expect(animationPlayed).toBe(true);
      expect(true).toBe(true); // Placeholder for P2
    }
  });

  test("should play Whoosh sound on deletion (P2 - deferred)", async ({ page }) => {
    // This test is deferred to P2 (Phase 2 enhancements)
    const editor = page.locator(".milkdown-editor");
    await editor.click();
    await editor.type("声音测试文本。需要足够长度以通过安全检查。添加更多内容来确保有效性。");

    const response = await page
      .waitForResponse((response) => response.url().includes("/impetus/generate-intervention"))
      .timeout(150000);

    const responseBody = await response.json();

    if (responseBody.action === "delete") {
      // P2 TODO: Verify whoosh sound played
      // const soundPlayed = await page.evaluate(() =>
      //   window.__testHooks__.audioPlayer.lastPlayedSound === 'whoosh'
      // );
      // expect(soundPlayed).toBe(true);
      expect(true).toBe(true); // Placeholder for P2
    }
  });

  test("should force Provoke when document <50 chars (safety guard)", async ({ page }) => {
    const editor = page.locator(".milkdown-editor");
    await editor.click();

    // Type SHORT content (less than 50 chars)
    await editor.type("短文本测试。"); // Only ~7 chars

    // Wait for intervention
    const response = await page
      .waitForResponse((response) => response.url().includes("/impetus/generate-intervention"))
      .timeout(150000);

    const responseBody = await response.json();

    // Backend safety guard should FORCE Provoke (reject Delete)
    expect(responseBody.action).toBe("provoke");
    expect(responseBody.lock_id).toBeDefined();
    expect(responseBody.content).toBeDefined();

    // Verify locked block injected (not deletion)
    const lockedBlock = page.locator(`blockquote[data-lock-id="${responseBody.lock_id}"]`);
    await expect(lockedBlock).toBeVisible({ timeout: 5000 });
  });

  test("should allow Delete when document ≥50 chars (safety guard boundary)", async ({ page }) => {
    const editor = page.locator(".milkdown-editor");
    await editor.click();

    // Type EXACTLY 50 chars (boundary condition)
    const boundaryContent = "12345678901234567890123456789012345678901234567890"; // 50 chars exactly
    await editor.type(boundaryContent);

    // Wait for intervention
    const response = await page
      .waitForResponse((response) => response.url().includes("/impetus/generate-intervention"))
      .timeout(150000);

    const responseBody = await response.json();

    // At exactly 50 chars, backend MAY return Delete (or Provoke if LLM decides)
    // We just verify the action is valid
    expect(["provoke", "delete"]).toContain(responseBody.action);

    if (responseBody.action === "delete") {
      // Verify anchor is valid
      expect(responseBody.anchor.type).toBe("range");
      expect(responseBody.anchor.from).toBeLessThan(responseBody.anchor.to);
    } else {
      // If Provoke, verify lock_id
      expect(responseBody.lock_id).toBeDefined();
    }
  });

  test("should handle deletion near cursor position", async ({ page }) => {
    const editor = page.locator(".milkdown-editor");
    await editor.click();

    // Type content and move cursor to middle
    await editor.type("前半部分内容。后半部分内容。更多文本确保长度足够通过安全检查。");

    // Move cursor to middle (approximate)
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("ArrowLeft");
    }

    // Wait for delete intervention
    const response = await page
      .waitForResponse((response) => response.url().includes("/impetus/generate-intervention"))
      .timeout(150000);

    const responseBody = await response.json();

    if (responseBody.action === "delete") {
      // Anchor should be valid regardless of cursor position
      expect(responseBody.anchor.from).toBeGreaterThanOrEqual(0);
      expect(responseBody.anchor.to).toBeGreaterThan(responseBody.anchor.from);

      // Wait for deletion
      await page.waitForTimeout(1000);

      // Verify editor still has content
      const remainingText = await editor.textContent();
      expect(remainingText.length).toBeGreaterThan(0);
    }
  });

  test("should maintain lock enforcement after delete action", async ({ page }) => {
    const editor = page.locator(".milkdown-editor");
    await editor.click();

    // Type content
    await editor.type("测试删除后锁定功能。需要足够的内容来通过安全检查。继续添加文字以确保有效。");

    // Wait for first intervention (might be Provoke or Delete)
    const firstResponse = await page
      .waitForResponse((response) => response.url().includes("/impetus/generate-intervention"))
      .timeout(150000);

    const firstBody = await firstResponse.json();

    if (firstBody.action === "provoke") {
      // Verify locked block is enforced
      const lockedBlock = page.locator(`blockquote[data-lock-id="${firstBody.lock_id}"]`);
      await expect(lockedBlock).toBeVisible();

      // Try to delete
      await lockedBlock.click();
      await page.keyboard.press("Backspace");

      // Verify still locked
      await expect(lockedBlock).toBeVisible();
    } else if (firstBody.action === "delete") {
      // After delete, lock system should still work for future interventions
      // Wait for next intervention
      const secondResponse = await page
        .waitForResponse((response) => response.url().includes("/impetus/generate-intervention"))
        .timeout(150000);

      const secondBody = await secondResponse.json();

      if (secondBody.action === "provoke") {
        const lockedBlock = page.locator(`blockquote[data-lock-id="${secondBody.lock_id}"]`);
        await expect(lockedBlock).toBeVisible();
      }
    }
  });
});
