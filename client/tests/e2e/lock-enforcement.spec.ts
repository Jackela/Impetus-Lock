/**
 * E2E Tests for Lock Enforcement
 *
 * Tests editor-level transaction filtering to prevent deletion of locked blocks.
 * Uses Playwright to simulate real user interactions (Backspace, Delete, Ctrl+A).
 *
 * Constitutional Compliance:
 * - Article III (TDD): Tests written BEFORE implementation (RED phase)
 * - Article V (Documentation): JSDoc comments for all test cases
 *
 * Expected Initial State: All tests FAIL (filterTransaction not implemented yet)
 */

import { test, expect } from "@playwright/test";

/**
 * Test fixture: Inject a locked block into editor for testing.
 *
 * This helper simulates AI intervention by injecting a Markdown blockquote
 * with lock_id marker into the editor.
 *
 * @param page - Playwright page object
 * @param lockId - Lock ID to use (default: "lock_test_001")
 * @returns The injected content string
 */
async function injectLockedBlock(page: any, lockId = "lock_test_001") {
  const content = `> Muse 注入：门后传来低沉的呼吸声。<!-- lock:${lockId} -->`;

  // Inject via editor API (will be implemented in Phase 3)
  await page.evaluate((text: string) => {
    // @ts-ignore - Editor instance will be available
    window.__editor__.setMarkdown(text);
  }, content);

  return content;
}

test.describe("Lock Enforcement - Backspace/Delete Prevention", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to editor page
    await page.goto("http://localhost:5173");

    // Wait for editor to load
    await page.waitForSelector(".editor-container");
  });

  /**
   * Test: Backspace key should NOT delete locked block.
   *
   * User Story 1, Acceptance Scenario 1:
   * Given locked block exists, When user presses Backspace,
   * Then block persists + shake animation + bonk sound.
   *
   * Expected (RED): Test fails (filterTransaction not implemented)
   */
  test("should prevent deletion via Backspace key", async ({ page }) => {
    // Inject locked block
    const lockedContent = await injectLockedBlock(page);

    // Position cursor at end of locked block
    await page.keyboard.press("End");

    // Try to delete with Backspace
    await page.keyboard.press("Backspace");

    // Verify block still exists
    const editorContent = await page.evaluate(() => {
      // @ts-ignore
      return window.__editor__.getMarkdown();
    });

    expect(editorContent).toContain(lockedContent);

    // Verify shake animation triggered (visual feedback)
    const hasShakeAnimation = await page.evaluate(() => {
      const lockedBlock = document.querySelector("[data-lock-id]");
      return lockedBlock?.classList.contains("shake-animation");
    });

    expect(hasShakeAnimation).toBe(true);

    // TODO Phase 7: Verify bonk sound played (P2 feature)
  });

  /**
   * Test: Delete key should NOT delete locked block.
   *
   * Expected (RED): Test fails (filterTransaction not implemented)
   */
  test("should prevent deletion via Delete key", async ({ page }) => {
    const lockedContent = await injectLockedBlock(page);

    // Position cursor at start of locked block
    await page.keyboard.press("Home");

    // Try to delete with Delete key
    await page.keyboard.press("Delete");

    // Verify block still exists
    const editorContent = await page.evaluate(() => {
      // @ts-ignore
      return window.__editor__.getMarkdown();
    });

    expect(editorContent).toContain(lockedContent);
  });

  /**
   * Test: Ctrl+A then Delete should only delete non-locked content.
   *
   * User Story 1, Acceptance Scenario 3:
   * Given multiple locked blocks exist, When user does Ctrl+A + Delete,
   * Then locked blocks persist, only normal text deleted.
   *
   * Expected (RED): Test fails (filterTransaction not implemented)
   */
  test("should preserve locked blocks when deleting all content", async ({ page }) => {
    // Add normal text before locked block
    await page.evaluate(() => {
      // @ts-ignore
      window.__editor__.setMarkdown("这是普通文本。\n\n");
    });

    // Inject locked block
    const lockId = "lock_test_002";
    const lockedContent = `> 测试内容 <!-- lock:${lockId} -->`;
    await page.evaluate((text: string) => {
      // @ts-ignore
      const current = window.__editor__.getMarkdown();
      window.__editor__.setMarkdown(current + text + "\n\n更多普通文本。");
    }, lockedContent);

    // Select all and delete
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Delete");

    // Verify locked block still exists
    const editorContent = await page.evaluate(() => {
      // @ts-ignore
      return window.__editor__.getMarkdown();
    });

    expect(editorContent).toContain(lockedContent);

    // Verify normal text was deleted
    expect(editorContent).not.toContain("这是普通文本");
    expect(editorContent).not.toContain("更多普通文本");
  });

  /**
   * Test: Selection + typing should NOT replace locked block.
   *
   * User Story 1, Acceptance Scenario 4:
   * Locked block boundaries must be clearly marked, editing blocked.
   *
   * Expected (RED): Test fails (filterTransaction not implemented)
   */
  test("should prevent replacement via selection + typing", async ({ page }) => {
    const lockedContent = await injectLockedBlock(page);

    // Try to select locked block
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");

    // Try to replace by typing
    await page.keyboard.type("新文本");

    // Verify locked block still exists (not replaced)
    const editorContent = await page.evaluate(() => {
      // @ts-ignore
      return window.__editor__.getMarkdown();
    });

    expect(editorContent).toContain(lockedContent);
  });
});

test.describe("Lock Enforcement - Multiple Locks", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:5173");
    await page.waitForSelector(".editor-container");
  });

  /**
   * Test: Multiple locked blocks should all be protected.
   *
   * Expected (RED): Test fails (filterTransaction not implemented)
   */
  test("should protect all locked blocks simultaneously", async ({ page }) => {
    // Inject 3 locked blocks
    const locks = ["lock_test_multi_001", "lock_test_multi_002", "lock_test_multi_003"];

    for (const lockId of locks) {
      const content = `> Loki 锁定：Block ${lockId} <!-- lock:${lockId} -->\n\n`;
      await page.evaluate((text: string) => {
        // @ts-ignore
        const current = window.__editor__.getMarkdown();
        window.__editor__.setMarkdown(current + text);
      }, content);
    }

    // Try to delete all
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Delete");

    // Verify all locks still exist
    const editorContent = await page.evaluate(() => {
      // @ts-ignore
      return window.__editor__.getMarkdown();
    });

    for (const lockId of locks) {
      expect(editorContent).toContain(lockId);
    }
  });
});
