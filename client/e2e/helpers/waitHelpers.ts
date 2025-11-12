/**
 * E2E Test Wait Helpers
 *
 * Robust waiting strategies for React hydration and Milkdown initialization.
 * Uses data-testid attributes + reasonable timeouts to avoid flaky tests.
 */

import { Page, expect } from "@playwright/test";

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
  await overlay.waitFor({ state: "hidden", timeout }).catch(() => undefined);
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
export async function waitForReactHydration(page: Page, timeout = 10000) {
  // Wait directly for app container (rendered by React)
  await page.waitForSelector(".app", { timeout });
  await dismissWelcomeModal(page).catch(() => undefined);
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
