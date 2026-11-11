/**
 * E2E Test Wait Helpers
 *
 * Robust waiting strategies for React hydration and Milkdown initialization.
 * Uses data-testid attributes + reasonable timeouts to avoid flaky tests.
 */

import { type Page, expect } from "@playwright/test";

const WELCOME_STORAGE_KEY = "impetus-lock-welcome-dismissed";
let welcomeDismissScriptInjected = false;
const reloadedPages = new WeakSet<Page>();

async function ensureWelcomeModalSuppressed(page: Page) {
  if (!welcomeDismissScriptInjected) {
    await page.addInitScript((key) => {
      window.localStorage.setItem(key, "true");
    }, WELCOME_STORAGE_KEY);
    welcomeDismissScriptInjected = true;
  }

  const needsReload = await page.evaluate((key) => {
    const alreadyDismissed = window.localStorage.getItem(key) === "true";
    window.localStorage.setItem(key, "true");
    return !alreadyDismissed;
  }, WELCOME_STORAGE_KEY);

  if (needsReload && !reloadedPages.has(page)) {
    reloadedPages.add(page);
    await page.reload({ waitUntil: "domcontentloaded" });
  }
}

export async function dismissWelcomeModal(page: Page, timeout = 5000): Promise<boolean> {
  const overlay = page.locator(".welcome-modal-overlay");
  const getStartedButton = page.getByRole("button", { name: "Get Started" });

  let isVisible = await overlay.isVisible().catch(() => false);

  if (!isVisible) {
    try {
      await overlay.waitFor({ state: "visible", timeout });
      isVisible = true;
    } catch {
      return false;
    }
  }

  if (!isVisible) {
    return false;
  }

  await getStartedButton.click();
  await overlay.waitFor({ state: "hidden", timeout });
  return true;
}

/**
 * Wait for React to hydrate the app (root div has React app).
 *
 * Strategy: Wait for .app container which is rendered by React.
 * This is more reliable than checking if #root is empty.
 *
 * @param page - Playwright page instance
 * @param timeout - Maximum wait time in ms (default: 10000)
 */
const HYDRATION_RETRIES = 2;

export async function waitForReactHydration(page: Page, timeout = process.env.CI ? 20000 : 10000) {
  await ensureWelcomeModalSuppressed(page);

  let lastError: unknown;
  for (let attempt = 0; attempt <= HYDRATION_RETRIES; attempt += 1) {
    try {
      await page.waitForSelector(".app", { timeout });
      await dismissWelcomeModal(page).catch(() => undefined);
      return;
    } catch (error) {
      lastError = error;
      if (attempt === HYDRATION_RETRIES) {
        break;
      }
      // Pages in CI occasionally respond before React hydrates; reload and retry.
      await page.reload({ waitUntil: "domcontentloaded" });
    }
  }
  throw lastError;
}

/**
 * Wait for editor to finish loading and be ready.
 *
 * Strategy:
 * 1. Wait for loading state to appear (optional - may already be ready)
 * 2. Wait for loading state to disappear
 * 3. Wait for ready state to appear
 *
 * @param page - Playwright page instance
 * @param timeout - Maximum wait time in ms (default: 10000)
 */
export async function waitForEditorReady(page: Page, timeout = 10000) {
  try {
    // Option A: Editor is still loading - wait for it to finish
    const loadingState = page.getByTestId("editor-loading");
    const isLoading = await loadingState.isVisible({ timeout: 1000 }).catch(() => false);

    if (isLoading) {
      // Wait for loading state to disappear
      await expect(loadingState).not.toBeVisible({ timeout });
    }
  } catch {
    // Loading state never appeared or already gone - that's fine
  }

  // Wait for ready state
  const readyState = page.getByTestId("editor-ready");
  await expect(readyState).toBeVisible({ timeout });

  // Wait for Milkdown to render
  await page.waitForSelector(".milkdown", { timeout: 5000 });

  // Ensure the actual ProseMirror surface is present
  const proseMirror = page.locator(".milkdown .ProseMirror");
  await expect(proseMirror).toBeVisible({ timeout: 5000 });
}

/**
 * Wait for app header (mode selector + manual trigger button) to be ready.
 *
 * @param page - Playwright page instance
 * @param timeout - Maximum wait time in ms (default: 5000)
 */
export async function waitForAppHeader(page: Page, timeout = 5000) {
  await page.waitForSelector(".app-header", { timeout });
  await page.waitForSelector("#mode-selector", { timeout: 2000 });
}

/**
 * Complete app initialization wait (React + Editor + Header).
 *
 * Use this at the start of most E2E tests.
 *
 * @param page - Playwright page instance
 */
export async function waitForAppReady(page: Page) {
  await waitForReactHydration(page);
  await waitForAppHeader(page);
  await waitForEditorReady(page);
}

/**
 * Wait for editor to be interactive (ready + clickable).
 *
 * @param page - Playwright page instance
 */
export async function waitForEditorInteractive(page: Page) {
  await waitForEditorReady(page);

  // Wait for ProseMirror to be ready
  const proseMirror = page.locator(".milkdown .ProseMirror");
  await expect(proseMirror).toBeVisible({ timeout: 5000 });

  // Ensure it's not in loading/disabled state
  await proseMirror.waitFor({ state: "visible", timeout: 5000 });
}

/**
 * Open the header `⋯` overflow menu if it is not already open.
 *
 * Every header command (Tasks, Style, Stats, Achievements, Export, LLM Settings,
 * Lock/Forget) lives inside this menu, so tests must open it before interacting
 * with those controls. The menu unmounts when closed, so re-open it after any
 * menu item click.
 *
 * @param page - Playwright page instance
 */
export async function openHeaderMenu(page: Page) {
  const menu = page.getByRole("menu", { name: "Main menu" });
  if (await menu.isVisible().catch(() => false)) return;
  await page.getByTestId("header-menu-button").click();
  await menu.waitFor({ state: "visible", timeout: 5000 });
}

/**
 * Open the header menu and expand its DEV-only `Dev tools` disclosure so the
 * manual AI trigger buttons are reachable.
 *
 * Production builds render the manual trigger inline instead (no disclosure),
 * so the `header-dev-region` lookup is skipped when it is absent.
 *
 * @param page - Playwright page instance
 */
export async function openHeaderDevTools(page: Page) {
  await openHeaderMenu(page);
  const dev = page.getByTestId("header-dev-region");
  if ((await dev.count()) === 0) return; // production renders the trigger inline
  await dev.waitFor({ state: "visible", timeout: 5000 });
  const open = await dev.evaluate((d) => (d as HTMLDetailsElement).open);
  if (!open) await dev.locator("summary").click();
}

/**
 * Run a header menu command by its `data-testid`.
 *
 * Opens the menu (if needed) and clicks the item. The menu closes afterwards,
 * so call `openHeaderMenu` again before the next command or assertion that
 * targets a menu item.
 *
 * @param page - Playwright page instance
 * @param testId - `data-testid` of the menu item to click
 */
export async function clickHeaderMenuItem(page: Page, testId: string) {
  await openHeaderMenu(page);
  await page.getByTestId(testId).click();
}
