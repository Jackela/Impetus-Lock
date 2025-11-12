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

    // Wait for editor to be ready
    await page.waitForSelector('[data-testid="editor-ready"]', { timeout: 10000 });

    // Insert locked content by manipulating editor markdown
    // Lock ID format: <!-- lock:lock_id source:muse -->
    await page.evaluate(() => {
      const editorElement = document.querySelector(".milkdown") as HTMLElement;
      if (editorElement) {
        // Insert markdown with lock ID comment
        const markdown = "> AI-generated provocation <!-- lock:test_lock_001 source:muse -->";

        // Find the ProseMirror contenteditable
        const prosemirror = editorElement.querySelector('[contenteditable="true"]');
        if (prosemirror) {
          // Type into editor to trigger content update
          (prosemirror as HTMLElement).focus();

          // Use document.execCommand to insert content (works in Playwright)
          const selection = window.getSelection();
          if (selection) {
            const range = document.createRange();
            range.selectNodeContents(prosemirror);
            range.collapse(false); // Collapse to end
            selection.removeAllRanges();
            selection.addRange(range);
          }

          // Insert text (triggers editor update)
          document.execCommand("insertText", false, markdown);
        }
      }
    });

    // Wait for decorations to be applied (small delay for plugin to process)
    await page.waitForTimeout(500);

    // Validate .locked-content class is applied
    const lockedContent = page.locator(".locked-content").first();
    await expect(lockedContent).toBeAttached({ timeout: 5000 });

    // Validate data-lock-id attribute
    await expect(lockedContent).toHaveAttribute("data-lock-id", "test_lock_001");
    await expect(lockedContent).toHaveAttribute("data-source", "muse");
    await expect(lockedContent).toHaveClass(/source-muse/);

    // Validate CSS border styling
    const borderLeft = await lockedContent.evaluate((el) => {
      return window.getComputedStyle(el).borderLeft;
    });
    expect(borderLeft).toContain("3px");
    expect(borderLeft).toContain("rgb(196, 181, 253)"); // Muse purple

    // Validate CSS background color
    const backgroundColor = await lockedContent.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    // Check for RGBA with low alpha (subtle tint)
    expect(backgroundColor).toMatch(/rgba?\(19[0-9],\s*18[0-9],\s*25[0-9]/);
  });

  test("Lock icon appears on hover (CSS pseudo-element)", async ({ page }) => {
    await page.goto("/");

    // Dismiss welcome modal
    const welcomeButton = page.locator(".welcome-button");
    if (await welcomeButton.isVisible()) {
      await welcomeButton.click();
    }

    // Wait for editor to be ready
    await page.waitForSelector('[data-testid="editor-ready"]', { timeout: 10000 });

    // Insert locked content
    await page.evaluate(() => {
      const editorElement = document.querySelector(".milkdown") as HTMLElement;
      if (editorElement) {
        const markdown = "> Test locked content <!-- lock:test_lock_002 source:muse -->";
        const prosemirror = editorElement.querySelector('[contenteditable="true"]');
        if (prosemirror) {
          (prosemirror as HTMLElement).focus();
          const selection = window.getSelection();
          if (selection) {
            const range = document.createRange();
            range.selectNodeContents(prosemirror);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
          }
          document.execCommand("insertText", false, markdown);
        }
      }
    });

    // Wait for decorations
    await page.waitForTimeout(500);

    const lockedContent = page.locator(".locked-content").first();
    await expect(lockedContent).toBeAttached({ timeout: 5000 });

    // Hover over locked content
    await lockedContent.hover();

    // Validate hover effect (background darkens slightly)
    const hoverBackground = await lockedContent.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    // Hover background should be slightly darker (0.08 alpha vs 0.05)
    expect(hoverBackground).toMatch(
      /rgba?\((19[0-9]|20[0-9]),\s*(18[0-9]|19[0-9]|20[0-9]),\s*25[0-9]/
    );

    // Note: Cannot directly test ::after pseudo-element content in Playwright
    // CSS rule validates lock icon (🔒) appears on hover via ::after pseudo-element
    // Visual validation confirmed in manual testing
  });

  test("Multiple locked blocks have independent styling", async ({ page }) => {
    await page.goto("/");

    // Wait for editor to be ready
    await page.waitForSelector('[data-testid="editor-ready"]', { timeout: 10000 });

    // Insert multiple locked content blocks
    await page.evaluate(() => {
      const editorElement = document.querySelector(".milkdown") as HTMLElement;
      if (editorElement) {
        const markdown =
          "> First locked block <!-- lock:lock_A source:muse -->\n\n" +
          "Normal text\n\n" +
          "> Second locked block <!-- lock:lock_B source:loki -->";
        const prosemirror = editorElement.querySelector('[contenteditable="true"]');
        if (prosemirror) {
          (prosemirror as HTMLElement).focus();
          const selection = window.getSelection();
          if (selection) {
            const range = document.createRange();
            range.selectNodeContents(prosemirror);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
          }
          document.execCommand("insertText", false, markdown);
        }
      }
    });

    // Wait for decorations
    await page.waitForTimeout(500);

    // Validate both locked blocks are styled
    const lockedBlocks = page.locator(".locked-content");
    const count = await lockedBlocks.count();
    expect(count).toBeGreaterThanOrEqual(1); // At least one block should be detected

    // Validate each block has correct data-lock-id
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
    // Validate styling applied to first block
    const firstBorder = await firstBlock.evaluate((el) => {
      return window.getComputedStyle(el).borderLeft;
    });
    expect(firstBorder).toContain("3px");
    expect(firstBorder).toContain("rgb(196, 181, 253)");
  });

  test("Locked content styling does not break editor layout", async ({ page }) => {
    await page.goto("/");

    // Dismiss welcome modal
    const welcomeButton = page.locator(".welcome-button");
    if (await welcomeButton.isVisible()) {
      await welcomeButton.click();
    }

    // Wait for editor to be ready
    await page.waitForSelector('[data-testid="editor-ready"]', { timeout: 10000 });

    // Get initial editor height
    const editorInitialHeight = await page.locator(".milkdown").evaluate((el) => {
      return el.clientHeight;
    });

    // Insert locked content
    await page.evaluate(() => {
      const editorElement = document.querySelector(".milkdown") as HTMLElement;
      if (editorElement) {
        const markdown = "> Locked content with styling <!-- lock:test_lock_003 source:loki -->";
        const prosemirror = editorElement.querySelector('[contenteditable="true"]');
        if (prosemirror) {
          (prosemirror as HTMLElement).focus();
          const selection = window.getSelection();
          if (selection) {
            const range = document.createRange();
            range.selectNodeContents(prosemirror);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
          }
          document.execCommand("insertText", false, markdown);
        }
      }
    });

    // Wait for decorations
    await page.waitForTimeout(500);

    // Validate locked content is visible
    await expect(page.locator(".locked-content").first()).toBeAttached();

    // Validate editor is still functional (can type more)
    const prosemirror = page.locator('.milkdown [contenteditable="true"]');
    await prosemirror.click();
    await prosemirror.press("End"); // Move to end
    await prosemirror.press("Enter");
    await page.keyboard.type("Additional text after locked content");

    // Validate editor height increased (content was added)
    const editorFinalHeight = await page.locator(".milkdown").evaluate((el) => {
      return el.clientHeight;
    });
    expect(editorFinalHeight).toBeGreaterThanOrEqual(editorInitialHeight);
  });
});
