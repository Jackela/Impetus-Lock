/**
 * Milkdown/ProseMirror E2E Test Helpers
 *
 * Provides utilities for interacting with Milkdown editor in Playwright tests.
 * ProseMirror editors don't work with standard Playwright fill/selectText methods,
 * so these helpers use the ProseMirror DOM structure and commands.
 */

import { Page, Locator } from "@playwright/test";

/**
 * Insert text into Milkdown editor at cursor position.
 *
 * @param page - Playwright page object
 * @param text - Text content to insert (supports Markdown)
 * @returns Promise that resolves when text is inserted
 *
 * @example
 * await insertText(page, "Hello world");
 * await insertText(page, "Locked content <!-- lock:test-lock source:muse -->");
 */
export async function insertText(page: Page, text: string): Promise<void> {
  const editor = page.locator('[data-testid="milkdown-editor"] .milkdown');

  // Click to focus editor
  await editor.click();

  // Type text character by character (more reliable than paste)
  await page.keyboard.type(text);
}

/**
 * Insert locked content block into Milkdown editor.
 *
 * Creates a content block with lock marker comment that will be
 * enforced by the P1 lock system.
 *
 * @param page - Playwright page object
 * @param content - Content text (without lock marker)
 * @param lockId - Lock ID for the block
 * @returns Promise that resolves when locked content is inserted
 *
 * @example
 * await insertLockedContent(page, "Critical section", "lock_critical_1");
 */
export async function insertLockedContent(
  page: Page,
  content: string,
  lockId: string,
  source: "muse" | "loki" = "muse"
): Promise<void> {
  const lockedText = `${content} <!-- lock:${lockId} source:${source} -->`;
  await insertText(page, lockedText);
}

/**
 * Attempt to delete text in Milkdown editor using keyboard.
 *
 * This simulates user attempting to delete content, which should
 * trigger rejection feedback if content is locked.
 *
 * @param page - Playwright page object
 * @param fromPos - Start position (character index)
 * @param toPos - End position (character index)
 * @returns Promise that resolves after delete attempt
 *
 * @example
 * // Delete characters 10-20
 * await attemptDelete(page, 10, 20);
 *
 * @note For locked content, delete should be rejected with Shake animation + Bonk audio
 */
export async function attemptDelete(page: Page, fromPos: number, toPos: number): Promise<void> {
  const editor = page.locator('[data-testid="milkdown-editor"] .milkdown');

  // Focus editor
  await editor.click();

  // Select range using keyboard (Shift+ArrowRight)
  // First, position cursor at fromPos
  await page.keyboard.press("Home"); // Go to start
  for (let i = 0; i < fromPos; i++) {
    await page.keyboard.press("ArrowRight");
  }

  // Then select to toPos
  const selectLength = toPos - fromPos;
  for (let i = 0; i < selectLength; i++) {
    await page.keyboard.press("Shift+ArrowRight");
  }

  // Attempt delete
  await page.keyboard.press("Backspace");
}

/**
 * Attempt to delete locked content (should trigger rejection).
 *
 * Convenience wrapper around attemptDelete for testing lock enforcement.
 *
 * @param page - Playwright page object
 * @param lockId - Lock ID to find and attempt deletion
 * @returns Promise that resolves after delete attempt
 *
 * @example
 * await attemptDeleteLocked(page, "lock_test_1");
 * // Expects: Shake animation + Bonk audio
 */
export async function attemptDeleteLocked(page: Page, lockId: string): Promise<void> {
  // Find the lock marker comment in editor content
  const editor = page.locator('[data-testid="milkdown-editor"] .milkdown');
  const content = await editor.textContent();

  if (!content) {
    throw new Error("Editor content is empty");
  }

  // Find lock marker position
  const lockPattern = new RegExp(`<!--\\s*lock:${lockId}(?:\\s+source:[^>\\s]+)?\\s*-->`, "i");
  const match = lockPattern.exec(content);
  const lockPos = match?.index ?? -1;

  if (lockPos === -1) {
    throw new Error(`Lock marker not found for ${lockId}`);
  }

  // Find the content before the lock marker (assume it's on same line)
  // For simplicity, select 10 characters before the lock marker
  const fromPos = Math.max(0, lockPos - 10);
  const toPos = lockPos + (match?.[0].length ?? 0);

  await attemptDelete(page, fromPos, toPos);
}

/**
 * Get current editor content as plain text.
 *
 * @param page - Playwright page object
 * @returns Promise resolving to editor content
 *
 * @example
 * const content = await getEditorContent(page);
 * expect(content).toContain("locked content");
 */
export async function getEditorContent(page: Page): Promise<string> {
  const editor = page.locator('[data-testid="milkdown-editor"] .milkdown');
  return (await editor.textContent()) || "";
}

/**
 * Clear all editor content.
 *
 * @param page - Playwright page object
 * @returns Promise that resolves when content is cleared
 *
 * @example
 * await clearEditor(page);
 */
export async function clearEditor(page: Page): Promise<void> {
  const editor = page.locator('[data-testid="milkdown-editor"] .milkdown');
  await editor.click();

  // Select all and delete
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
}

/**
 * Wait for editor to be ready (loaded and initialized).
 *
 * @param page - Playwright page object
 * @param timeout - Maximum wait time in milliseconds
 * @returns Promise that resolves when editor is ready
 *
 * @example
 * await waitForEditorReady(page);
 */
export async function waitForEditorReady(page: Page, timeout = 5000): Promise<void> {
  const editor = page.locator('[data-testid="milkdown-editor"] .milkdown');
  await editor.waitFor({ state: "visible", timeout });

  // Wait for editor to be editable (contenteditable=true)
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="milkdown-editor"] .milkdown');
      return el?.getAttribute("contenteditable") === "true";
    },
    { timeout }
  );
}
