import { chromium } from "playwright";

async function ensureWelcomeClosed(page) {
  const welcomeButton = page.locator(".welcome-button");
  if (await welcomeButton.isVisible().catch(() => false)) {
    await welcomeButton.click();
    await page.waitForTimeout(500);
  }
}

async function insertLockedContent(page) {
  await page.evaluate(() => {
    const editorElement = document.querySelector(".milkdown");
    if (!editorElement) return;
    const markdown =
      "> AI-injected prompt to expose a secret <!-- lock:manual_flow_lock source:muse -->\n\n" +
      "Regular paragraph after lock";
    const prosemirror = editorElement.querySelector('[contenteditable="true"]');
    if (!prosemirror) return;
    prosemirror.focus();
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(prosemirror);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    document.execCommand("insertText", false, `\n\n${markdown}`);
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const baseUrl = process.env.MANUAL_FLOW_URL || "http://localhost:5173";

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "test-results/manual-flow/welcome.png", fullPage: true });

  await ensureWelcomeClosed(page);
  await page.waitForSelector('[data-testid="editor-ready"]', { timeout: 15000 });

  // LLM settings modal screenshot
  await page.getByTestId("llm-settings-trigger").click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/manual-flow/llm-settings.png", fullPage: true });
  await page.locator(".llm-settings__close").click();

  // Switch to Muse mode to show timer
  await page.selectOption("#mode-selector", "muse");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "test-results/manual-flow/muse-mode.png", fullPage: true });

  // Insert locked content and capture styling
  await insertLockedContent(page);
  await page.waitForTimeout(800);
  const lockedBlock = page.locator(".locked-content").first();
  if (await lockedBlock.isVisible().catch(() => false)) {
    await lockedBlock.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: "test-results/manual-flow/locked-content.png", fullPage: true });

  // Footer hint screenshot
  const footer = page.locator(".app-footer");
  if (await footer.isVisible().catch(() => false)) {
    await footer.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await page.screenshot({ path: "test-results/manual-flow/footer.png", fullPage: true });
  }

  await browser.close();
}

main().catch((error) => {
  console.error("Manual user flow failed:", error);
  process.exitCode = 1;
});
