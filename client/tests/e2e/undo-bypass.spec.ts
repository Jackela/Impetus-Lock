/**
 * E2E Tests for Undo Bypass
 *
 * Tests that AI Delete actions bypass the Undo stack (cannot be undone),
 * while preserving normal Undo functionality for user edits.
 *
 * Constitutional Compliance:
 * - Article III (TDD): Tests written BEFORE implementation (RED phase)
 * - Article V (Documentation): JSDoc comments for all test cases
 *
 * Expected Initial State: All tests FAIL (Undo bypass not implemented yet)
 */

import { test, expect } from "@playwright/test";

test.describe("Undo Bypass - AI Delete Actions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:5173");
    await page.waitForSelector(".editor-container");
  });

  /**
   * Test: AI Delete action should NOT be undoable.
   *
   * User Story 1, Acceptance Scenario 2:
   * Given AI executed Delete action, When user presses Ctrl+Z,
   * Then deletion cannot be undone (bypassed Undo stack).
   *
   * Expected (RED): Test fails (Undo bypass not implemented)
   */
  test("should prevent undo of AI delete actions", async ({ page }) => {
    // Set initial content
    const initialText = "他打开门，犹豫着要不要进去。突然，门后传来脚步声。";
    await page.evaluate((text: string) => {
      // @ts-ignore
      window.__editor__.setMarkdown(text);
    }, initialText);

    // Verify initial content
    let content = await page.evaluate(() => {
      // @ts-ignore
      return window.__editor__.getMarkdown();
    });
    expect(content).toContain("突然，门后传来脚步声。");

    // Simulate AI Delete action (via API that bypasses Undo)
    await page.evaluate(() => {
      // This will call a special API that deletes without Undo
      // @ts-ignore
      window.__editor__.deleteWithoutUndo({ from: 30, to: 50 });
    });

    // Verify content was deleted
    content = await page.evaluate(() => {
      // @ts-ignore
      return window.__editor__.getMarkdown();
    });
    expect(content).not.toContain("突然，门后传来脚步声。");

    // Try to undo with Ctrl+Z
    await page.keyboard.press("Control+Z");

    // Verify deletion still persists (cannot be undone)
    content = await page.evaluate(() => {
      // @ts-ignore
      return window.__editor__.getMarkdown();
    });
    expect(content).not.toContain("突然，门后传来脚步声。");
  });

  /**
   * Test: Normal user edits should still be undoable.
   *
   * User Story 1, Acceptance Scenario 2 (inverse case):
   * Given user typed text, When user presses Ctrl+Z,
   * Then normal Undo works (only AI actions bypass).
   *
   * Expected (RED): Test fails (need to ensure normal Undo still works)
   */
  test("should allow undo of normal user edits", async ({ page }) => {
    // User types text normally
    await page.keyboard.type("用户输入的文本");

    // Verify text was added
    let content = await page.evaluate(() => {
      // @ts-ignore
      return window.__editor__.getMarkdown();
    });
    expect(content).toContain("用户输入的文本");

    // Undo with Ctrl+Z (should work for user edits)
    await page.keyboard.press("Control+Z");

    // Verify text was undone
    content = await page.evaluate(() => {
      // @ts-ignore
      return window.__editor__.getMarkdown();
    });
    expect(content).not.toContain("用户输入的文本");
  });

  /**
   * Test: Mixed actions - user edit, AI delete, user edit again.
   *
   * Undo should skip over AI delete and undo user edits only.
   *
   * Expected (RED): Test fails (complex Undo bypass logic not implemented)
   */
  test("should skip AI actions when undoing user edits", async ({ page }) => {
    // User types first text
    await page.keyboard.type("第一段文本。");

    // User types second text
    await page.keyboard.type("第二段文本。");

    // Simulate AI Delete action (deletes "第一段文本。")
    await page.evaluate(() => {
      // @ts-ignore
      window.__editor__.deleteWithoutUndo({ from: 0, to: 7 });
    });

    // User types third text
    await page.keyboard.type("第三段文本。");

    // Get content before undo
    let content = await page.evaluate(() => {
      // @ts-ignore
      return window.__editor__.getMarkdown();
    });
    expect(content).not.toContain("第一段文本");
    expect(content).toContain("第二段文本");
    expect(content).toContain("第三段文本");

    // Undo once (should undo "第三段文本。")
    await page.keyboard.press("Control+Z");

    content = await page.evaluate(() => {
      // @ts-ignore
      return window.__editor__.getMarkdown();
    });
    expect(content).not.toContain("第三段文本");
    expect(content).toContain("第二段文本");

    // Undo again (should undo "第二段文本。", skip AI delete)
    await page.keyboard.press("Control+Z");

    content = await page.evaluate(() => {
      // @ts-ignore
      return window.__editor__.getMarkdown();
    });
    expect(content).not.toContain("第二段文本");

    // AI deletion should still persist (not undoable)
    expect(content).not.toContain("第一段文本");
  });
});
