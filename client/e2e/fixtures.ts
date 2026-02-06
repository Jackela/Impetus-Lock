/**
 * Playwright Test Fixtures
 *
 * Provides global test setup/teardown to ensure state isolation between tests.
 * This prevents state leakage that causes tests to pass locally but fail in CI.
 *
 * Key problems solved:
 * - localStorage pollution between tests
 * - Chinese text persistence from other tests
 * - Task sidebar interference with editor operations
 */

import { test as base } from "@playwright/test";

// Extend base test with page auto-cleanup fixture
/* eslint-disable react-hooks/rules-of-hooks -- Playwright fixtures use 'use' callback, not React hooks */
export const test = base.extend({
  // Auto-cleanup page fixture: clears localStorage before each test
  page: async ({ page }, use) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await use(page);
  },
});
/* eslint-enable react-hooks/rules-of-hooks */

export { expect } from "@playwright/test";
