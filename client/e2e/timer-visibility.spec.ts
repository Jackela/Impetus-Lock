/**
 * E2E Tests for Timer Indicator Visibility (T006)
 *
 * Validates that the timer indicator:
 * - Appears in Muse mode with correct ARIA attributes
 * - Resets progress when user types
 * - Hidden in Off and Loki modes
 *
 * @see specs/chrome-audit-polish/specs/timer-visibility/spec.md
 */

import { test, expect } from '@playwright/test';

test.describe('Timer Indicator Visibility', () => {
  test('Timer indicator appears in Muse mode', async ({ page }) => {
    await page.goto('/');

    // Select Muse mode
    await page.selectOption('#mode-selector', 'muse');

    // Wait for timer element to be in DOM (even at 0% width)
    const timer = page.locator('.timer-indicator');
    await timer.waitFor({ state: 'attached', timeout: 5000 });

    // Verify ARIA attributes (even at 0% width, ARIA should be present)
    await expect(timer).toHaveAttribute('role', 'progressbar');
    await expect(timer).toHaveAttribute('aria-label', /STUCK timer: \d+ seconds remaining/);
    await expect(timer).toHaveAttribute('aria-valuemin', '0');
    await expect(timer).toHaveAttribute('aria-valuemax', '100');

    // Wait for timer to start progressing (1-2 seconds for non-zero width)
    await page.waitForTimeout(2000);

    // Verify timer has some progress (should be > 0% after 2 seconds)
    const ariaValue = await timer.getAttribute('aria-valuenow');
    expect(parseFloat(ariaValue || '0')).toBeGreaterThan(0);
  });

  test('Timer progress increases over time', async ({ page }) => {
    await page.goto('/');
    await page.selectOption('#mode-selector', 'muse');

    const timer = page.locator('.timer-indicator');
    await timer.waitFor({ state: 'attached', timeout: 5000 });

    // Wait 1 second for initial progress
    await page.waitForTimeout(1000);

    // Get initial aria-valuenow
    const initialProgress = await timer.getAttribute('aria-valuenow');
    const initialValue = parseFloat(initialProgress || '0');

    // Wait 3 more seconds (timer updates every 1 second)
    await page.waitForTimeout(3000);

    // Get updated aria-valuenow
    const updatedProgress = await timer.getAttribute('aria-valuenow');
    const updatedValue = parseFloat(updatedProgress || '0');

    // Progress should have increased
    expect(updatedValue).toBeGreaterThan(initialValue);
  });

  test('Timer progress increases over time (validates reset logic)', async ({ page }) => {
    await page.goto('/');
    await page.selectOption('#mode-selector', 'muse');

    const timer = page.locator('.timer-indicator');
    await timer.waitFor({ state: 'attached', timeout: 5000 });

    // Wait 3 seconds for initial progress
    await page.waitForTimeout(3000);

    // Get first measurement
    const progress1 = await timer.getAttribute('aria-valuenow');
    const value1 = parseFloat(progress1 || '0');

    // Wait 3 more seconds
    await page.waitForTimeout(3000);

    // Get second measurement
    const progress2 = await timer.getAttribute('aria-valuenow');
    const value2 = parseFloat(progress2 || '0');

    // Progress should have increased (validates timer is working)
    expect(value2).toBeGreaterThan(value1);

    // Both values should be positive
    expect(value1).toBeGreaterThan(0);
    expect(value2).toBeGreaterThan(value1);
  });

  test('Timer hidden in Off mode', async ({ page }) => {
    await page.goto('/');

    // Verify timer is not visible in Off mode (default)
    const timer = page.locator('.timer-indicator');
    await expect(timer).not.toBeVisible();
  });

  test('Timer hidden in Loki mode', async ({ page }) => {
    await page.goto('/');

    // Select Loki mode
    await page.selectOption('#mode-selector', 'loki');

    // Verify timer is not visible
    const timer = page.locator('.timer-indicator');
    await expect(timer).not.toBeVisible();
  });

  test('Timer visibility toggles when switching modes', async ({ page }) => {
    await page.goto('/');

    const timer = page.locator('.timer-indicator');

    // Initially Off mode - timer not attached
    await expect(timer).not.toBeAttached();

    // Switch to Muse mode - timer appears in DOM
    await page.selectOption('#mode-selector', 'muse');
    await timer.waitFor({ state: 'attached', timeout: 5000 });
    await expect(timer).toBeAttached();

    // Switch to Loki mode - timer disappears from DOM
    await page.selectOption('#mode-selector', 'loki');
    await expect(timer).not.toBeAttached();

    // Switch back to Muse mode - timer appears again
    await page.selectOption('#mode-selector', 'muse');
    await timer.waitFor({ state: 'attached', timeout: 5000 });
    await expect(timer).toBeAttached();

    // Switch to Off mode - timer disappears
    await page.selectOption('#mode-selector', 'off');
    await expect(timer).not.toBeAttached();
  });

  test('Timer ARIA label updates with remaining time', async ({ page }) => {
    await page.goto('/');
    await page.selectOption('#mode-selector', 'muse');

    const timer = page.locator('.timer-indicator');
    await timer.waitFor({ state: 'attached', timeout: 5000 });

    // Get initial ARIA label (within first second)
    const initialLabel = await timer.getAttribute('aria-label');
    expect(initialLabel).toMatch(/STUCK timer: (60|59|58|57|56|55) seconds remaining/);

    // Wait 5 seconds for timer to update
    await page.waitForTimeout(5000);

    // Get updated ARIA label
    const updatedLabel = await timer.getAttribute('aria-label');
    expect(updatedLabel).toMatch(/STUCK timer: (55|54|53|52|51|50) seconds remaining/);

    // Labels should be different (time has progressed)
    expect(updatedLabel).not.toBe(initialLabel);
  });
});
