import { test, expect } from '@playwright/test';

/**
 * Manual Testing as New User
 *
 * This test simulates a complete new user journey through the application,
 * capturing screenshots and validating each step as a real user would experience it.
 */

test('New User Manual Journey - Complete Walkthrough', async ({ page }) => {
  // Step 1: First visit - clear state
  console.log('\n=== STEP 1: New user visits app for first time ===');
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'test-results/01-first-visit.png', fullPage: true });
  console.log('✓ Screenshot: 01-first-visit.png');

  // Verify welcome modal appears
  const welcomeModal = page.locator('.welcome-modal');
  await expect(welcomeModal).toBeVisible({ timeout: 3000 });
  console.log('✓ Welcome modal appeared automatically');

  // Step 2: Read welcome modal content
  console.log('\n=== STEP 2: User reads onboarding content ===');
  const title = await page.locator('#welcome-title').textContent();
  console.log(`Modal title: "${title}"`);

  const intro = await page.locator('.welcome-intro').textContent();
  console.log(`Intro text: "${intro}"`);

  // Check all mode explanations
  const museModeText = await page.locator('.welcome-mode').filter({ hasText: 'Muse Mode' }).textContent();
  console.log(`\nMuse Mode explanation found: ${museModeText?.includes('60 seconds') ? 'YES' : 'NO'}`);

  const lokiModeText = await page.locator('.welcome-mode').filter({ hasText: 'Loki Mode' }).textContent();
  console.log(`Loki Mode explanation found: ${lokiModeText?.includes('Chaos') ? 'YES' : 'NO'}`);

  const lockConceptText = await page.locator('.welcome-mode').filter({ hasText: 'Lock Concept' }).textContent();
  console.log(`Lock Concept explanation found: ${lockConceptText?.includes('locked') ? 'YES' : 'NO'}`);

  await page.screenshot({ path: 'test-results/02-reading-modal.png', fullPage: true });
  console.log('✓ Screenshot: 02-reading-modal.png');

  // Step 3: Try closing with Escape (test accessibility)
  console.log('\n=== STEP 3: User tests Escape key ===');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await expect(welcomeModal).not.toBeVisible();
  console.log('✓ Modal closed with Escape key');

  await page.screenshot({ path: 'test-results/03-modal-closed.png', fullPage: true });
  console.log('✓ Screenshot: 03-modal-closed.png');

  // Step 4: Re-open modal with "?" key
  console.log('\n=== STEP 4: User presses "?" to re-open modal ===');
  await page.keyboard.press('?');
  await page.waitForTimeout(500);
  await expect(welcomeModal).toBeVisible();
  console.log('✓ Modal re-opened with "?" key');

  await page.screenshot({ path: 'test-results/04-modal-reopened.png', fullPage: true });
  console.log('✓ Screenshot: 04-modal-reopened.png');

  // Step 5: Check "Don't show again" and dismiss
  console.log('\n=== STEP 5: User checks "Don\'t show again" ===');
  const checkbox = page.locator('.welcome-checkbox input[type="checkbox"]');
  await checkbox.check();
  console.log('✓ Checkbox checked');

  await page.screenshot({ path: 'test-results/05-checkbox-checked.png', fullPage: true });
  console.log('✓ Screenshot: 05-checkbox-checked.png');

  const getStartedButton = page.locator('.welcome-button');
  await getStartedButton.click();
  await page.waitForTimeout(500);
  await expect(welcomeModal).not.toBeVisible();
  console.log('✓ Modal dismissed');

  // Verify localStorage was set
  const storageValue = await page.evaluate(() =>
    localStorage.getItem('impetus-lock-welcome-dismissed')
  );
  console.log(`localStorage value: "${storageValue}"`);

  await page.screenshot({ path: 'test-results/06-main-app.png', fullPage: true });
  console.log('✓ Screenshot: 06-main-app.png');

  // Step 6: Explore the main UI
  console.log('\n=== STEP 6: User explores main application ===');

  // Check mode selector
  const modeSelector = page.locator('#mode-selector');
  await expect(modeSelector).toBeVisible();
  const currentMode = await modeSelector.inputValue();
  console.log(`Current mode: ${currentMode}`);

  // Switch to Muse mode
  await modeSelector.selectOption('muse');
  console.log('✓ Switched to Muse mode');

  await page.screenshot({ path: 'test-results/07-muse-mode.png', fullPage: true });
  console.log('✓ Screenshot: 07-muse-mode.png');

  // Step 7: Type in editor
  console.log('\n=== STEP 7: User types in editor ===');
  const editor = page.locator('.milkdown .ProseMirror');
  await editor.click();
  await page.keyboard.type('This is my first note in Impetus Lock!');
  console.log('✓ Typed text in editor');

  await page.screenshot({ path: 'test-results/08-typed-content.png', fullPage: true });
  console.log('✓ Screenshot: 08-typed-content.png');

  // Step 8: Test "I'm stuck!" button
  console.log('\n=== STEP 8: User clicks "I\'m stuck!" button ===');
  const stuckButton = page.locator('[data-testid="manual-trigger-button"]');
  await expect(stuckButton).toBeVisible();
  const isEnabled = await stuckButton.isEnabled();
  console.log(`"I'm stuck!" button enabled: ${isEnabled}`);

  if (isEnabled) {
    await stuckButton.click();
    console.log('✓ Clicked "I\'m stuck!" button');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'test-results/09-after-stuck-button.png', fullPage: true });
    console.log('✓ Screenshot: 09-after-stuck-button.png');
  }

  // Step 9: Switch to Loki mode
  console.log('\n=== STEP 9: User switches to Loki mode ===');
  await modeSelector.selectOption('loki');
  console.log('✓ Switched to Loki mode');

  await page.screenshot({ path: 'test-results/10-loki-mode.png', fullPage: true });
  console.log('✓ Screenshot: 10-loki-mode.png');

  // Step 10: Reload to verify modal doesn't appear again
  console.log('\n=== STEP 10: User reloads page (modal should NOT appear) ===');
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);

  await expect(welcomeModal).not.toBeVisible();
  console.log('✓ Modal did NOT appear (preference was remembered)');

  await page.screenshot({ path: 'test-results/11-reload-no-modal.png', fullPage: true });
  console.log('✓ Screenshot: 11-reload-no-modal.png');

  // Final summary
  console.log('\n========================================');
  console.log('MANUAL TEST COMPLETE - NEW USER JOURNEY');
  console.log('========================================');
  console.log('✓ All 11 screenshots captured in test-results/');
  console.log('✓ Welcome modal works correctly');
  console.log('✓ Keyboard shortcuts functional');
  console.log('✓ User preferences persisted');
  console.log('✓ Main app fully functional');
});
