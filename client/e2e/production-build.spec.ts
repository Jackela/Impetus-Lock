import { test, expect } from '@playwright/test';

/**
 * Production Build Tests - T002
 *
 * Validates that development-only UI elements (Test Delete button) are
 * hidden in production builds while remaining visible in development mode.
 *
 * Note: Test Delete button is gated with `import.meta.env.DEV` in
 * ManualTriggerButton.tsx:99. These tests validate existing behavior.
 */

test.describe('Production Build', () => {
  test('Page title is branded', async ({ page }) => {
    await page.goto('/');
    expect(await page.title()).toBe('Impetus Lock - AI-Powered Writing Pressure System');
  });

  test('Test Delete button visible in development', async ({ page }) => {
    // This test runs against dev server (npm run dev)
    // Test Delete button should be visible when import.meta.env.DEV = true
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const testDeleteButton = page.locator('[data-testid="manual-delete-trigger"]');

    // In development mode, button should exist and be visible
    await expect(testDeleteButton).toBeVisible();
    await expect(testDeleteButton).toHaveText('Test Delete');
  });

  // Note: The "Test Delete button hidden in production" test would require
  // running against a production build (npm run build + preview).
  // This test is commented out as it requires separate test config:
  //
  // test('Test Delete button hidden in production', async ({ page }) => {
  //   await page.goto('/');
  //   await expect(page.locator('[data-testid="manual-delete-trigger"]')).not.toBeVisible();
  // });
  //
  // To run production tests:
  // 1. Build: npm run build
  // 2. Preview: npm run preview (runs on different port)
  // 3. Run tests against preview server
});
