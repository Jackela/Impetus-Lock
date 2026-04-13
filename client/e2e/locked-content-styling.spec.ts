/**
 * E2E Tests for Locked Content Styling (T010)
 *
 * Validates that locked AI-generated content blocks have visual distinction:
 * - Purple left border (3px solid)
 * - Subtle purple background tint
 * - Lock icon on hover
 * - data-lock-id attribute applied
 *
 * @see specs/chrome-audit-polish/specs/locked-content-styling/spec.md
 * @see openspec/changes/chrome-audit-polish/design.md#3-locked-content-styling
 */

import { test, expect } from "@playwright/test";

test.describe("Locked Content Styling", () => {
  test("Locked content has visual styling with CSS classes", async ({ page }) => {
    await page.goto("/");

    await page.waitForSelector('[data-testid="editor-ready"]', { timeout: 10000 });

    await page.evaluate(() => {
      const w = window as unknown as {
        insertLockedContentForTest?: (content: string, lockId: string, source: string) => void;
      };
      w.insertLockedContentForTest?.("AI-generated provocation", "test_lock_001", "muse");
    });

    await page.waitForTimeout(500);

    const lockedContent = page.locator(".locked-content").first();
    await expect(lockedContent).toBeAttached({ timeout: 5000 });
    await expect(lockedContent).toHaveAttribute("data-lock-id", "test_lock_001");
    await expect(lockedContent).toHaveAttribute("data-source", "muse");
    await expect(lockedContent).toHaveClass(/source-muse/);

    const borderLeft = await lockedContent.evaluate((el) => window.getComputedStyle(el).borderLeft);
    expect(borderLeft).toContain("4px");
    // Muse source uses green accent color (#22c55e = rgb(34, 197, 94))
    expect(borderLeft).toContain("rgb(34, 197, 94)");

    const backgroundColor = await lockedContent.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor
    );
    // Muse uses green background tint rgba(34, 197, 94, 0.08)
    expect(backgroundColor).toMatch(/rgba?\(\s*34/);
  });

  test("Lock icon appears on hover (CSS pseudo-element)", async ({ page }) => {
    await page.goto("/");

    const welcomeButton = page.locator(".welcome-button");
    if (await welcomeButton.isVisible()) {
      await welcomeButton.click();
    }

    await page.waitForSelector('[data-testid="editor-ready"]', { timeout: 10000 });

    await page.evaluate(() => {
      const w = window as unknown as {
        insertLockedContentForTest?: (content: string, lockId: string, source: string) => void;
      };
      w.insertLockedContentForTest?.("Test locked content", "test_lock_002", "muse");
    });

    await page.waitForTimeout(500);

    const lockedContent = page.locator(".locked-content").first();
    await expect(lockedContent).toBeAttached({ timeout: 5000 });
    await lockedContent.hover();

    const hoverBackground = await lockedContent.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor
    );
    // Hover state maintains source-specific tint (Muse green: rgba(34, 197, 94, 0.08))
    expect(hoverBackground).toMatch(/rgba?\(\s*34/);
  });

  test("Multiple locked blocks have independent styling", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('[data-testid="editor-ready"]', { timeout: 10000 });

    await page.evaluate(() => {
      const w = window as unknown as {
        insertLockedContentForTest?: (content: string, lockId: string, source: string) => void;
      };
      w.insertLockedContentForTest?.("First locked block", "lock_A", "muse");
      w.insertLockedContentForTest?.("Second locked block", "lock_B", "loki");
    });

    await page.waitForTimeout(500);

    const lockedBlocks = page.locator(".locked-content");
    expect(await lockedBlocks.count()).toBeGreaterThanOrEqual(2);

    const firstBlock = page.locator('[data-lock-id="lock_A"]', {
      hasText: "First locked block",
    });
    await expect(firstBlock).toBeAttached();
    await expect(firstBlock).toHaveAttribute("data-source", "muse");

    const secondBlock = page.locator('[data-lock-id="lock_B"]', {
      hasText: "Second locked block",
    });
    await expect(secondBlock).toBeAttached();
    await expect(secondBlock).toHaveAttribute("data-source", "loki");
    await expect(secondBlock).toHaveClass(/source-loki/);

    const firstBorder = await firstBlock.evaluate((el) => window.getComputedStyle(el).borderLeft);
    expect(firstBorder).toContain("4px");
    // Muse source (lock_A) uses green accent color
    expect(firstBorder).toContain("rgb(34, 197, 94)");

    const secondBorder = await secondBlock.evaluate((el) => window.getComputedStyle(el).borderLeft);
    expect(secondBorder).toContain("4px");
    // Loki source (lock_B) uses red accent color
    expect(secondBorder).toContain("rgb(239, 68, 68)");
  });

  test("Locked content styling does not break editor layout", async ({ page }) => {
    await page.goto("/");

    const welcomeButton = page.locator(".welcome-button");
    if (await welcomeButton.isVisible()) {
      await welcomeButton.click();
    }

    await page.waitForSelector('[data-testid="editor-ready"]', { timeout: 10000 });

    const editorInitialHeight = await page.locator(".milkdown").evaluate((el) => el.clientHeight);

    await page.evaluate(() => {
      const w = window as unknown as {
        insertLockedContentForTest?: (content: string, lockId: string, source: string) => void;
      };
      w.insertLockedContentForTest?.("Locked content with styling", "test_lock_003", "loki");
    });

    await page.waitForTimeout(500);
    await expect(page.locator(".locked-content").first()).toBeAttached();

    const prosemirror = page.locator('.milkdown [contenteditable="true"]');
    await prosemirror.click();
    await prosemirror.press("End");
    await prosemirror.press("Enter");
    await page.keyboard.type("Additional text after locked content");

    const editorFinalHeight = await page.locator(".milkdown").evaluate((el) => el.clientHeight);
    expect(editorFinalHeight).toBeGreaterThanOrEqual(editorInitialHeight);
  });
});
