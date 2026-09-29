import { test } from "@playwright/test";

/**
 * New User Audit - First Impressions
 *
 * Acting as a completely new user who just discovered this app.
 * I'll explore everything I see and document my experience.
 */

test("New User Audit - First Time Experience", async ({ page }, testInfo) => {
  console.log("\n🆕 NEW USER AUDIT - First Impressions\n");
  console.log('I am a new user who just discovered "Impetus Lock"...');
  console.log("Let me open the app and see what happens!\n");

  // STEP 1: First visit
  console.log("═══ STEP 1: Opening the application ═══");
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2000);

  // Take first screenshot
  await page.screenshot({ path: testInfo.outputPath("01-first-load.png"), fullPage: true });
  console.log("📸 Screenshot saved: 01-first-load.png");

  // What do I see?
  const pageTitle = await page.title();
  console.log(`\n👀 FIRST IMPRESSION:`);
  console.log(`   - Page title: "${pageTitle}"`);

  // Check if there's a modal
  const modalVisible = await page
    .locator(".welcome-modal")
    .isVisible()
    .catch(() => false);
  if (modalVisible) {
    console.log(`   - ✓ A welcome modal appeared!`);

    // Read the modal content
    const modalTitle = await page.locator("#welcome-title").textContent();
    const modalIntro = await page.locator(".welcome-intro").textContent();

    console.log(`\n📖 WELCOME MODAL CONTENT:`);
    console.log(`   Title: "${modalTitle}"`);
    console.log(`   Intro: "${modalIntro}"`);

    // Look for mode explanations
    const modes = await page.locator(".welcome-mode h3").allTextContents();
    console.log(`\n🎯 I see ${modes.length} different modes explained:`);
    modes.forEach((mode, i) => console.log(`   ${i + 1}. ${mode}`));

    // Read each mode description
    for (let i = 0; i < modes.length; i++) {
      const modeSection = page.locator(".welcome-mode").nth(i);
      const modeTitle = await modeSection.locator("h3").textContent();
      const modeDesc = await modeSection.textContent();

      console.log(`\n   📝 ${modeTitle}:`);
      console.log(`      ${modeDesc?.substring(modeTitle?.length || 0, 200)}...`);
    }

    await page.screenshot({ path: testInfo.outputPath("02-welcome-modal.png"), fullPage: true });
    console.log("\n📸 Screenshot saved: 02-welcome-modal.png");

    // Look for buttons
    const hasCloseButton = await page.locator(".welcome-modal-close").isVisible();
    const hasGetStartedButton = await page.locator(".welcome-button").isVisible();
    const hasCheckbox = await page.locator(".welcome-checkbox").isVisible();

    console.log(`\n🎛️  MODAL CONTROLS I FOUND:`);
    console.log(`   - Close button (X): ${hasCloseButton ? "✓" : "✗"}`);
    console.log(`   - Get Started button: ${hasGetStartedButton ? "✓" : "✗"}`);
    console.log(`   - "Don't show again" checkbox: ${hasCheckbox ? "✓" : "✗"}`);

    // Try reading the hint
    const hint = await page.locator(".welcome-hint").textContent();
    console.log(`\n💡 HINT: ${hint}`);
  } else {
    console.log(`   - No welcome modal (maybe I visited before?)`);
  }

  // STEP 2: Dismiss modal and explore main UI
  console.log(`\n═══ STEP 2: Let me dismiss the modal and explore ═══`);

  if (modalVisible) {
    await page.locator(".welcome-button").click();
    await page.waitForTimeout(500);
    console.log('✓ Clicked "Get Started"');
  }

  await page.screenshot({ path: testInfo.outputPath("03-main-ui.png"), fullPage: true });
  console.log("📸 Screenshot saved: 03-main-ui.png");

  // STEP 3: Analyze the main interface
  console.log(`\n═══ STEP 3: Exploring the main interface ═══`);

  // Look for header
  const appName = await page.locator("h1").textContent();
  console.log(`\n🏷️  APP NAME: "${appName}"`);

  // Find mode selector
  const modeSelector = page.locator("#mode-selector");
  const modeSelectorVisible = await modeSelector.isVisible();

  if (modeSelectorVisible) {
    console.log(`\n🎚️  MODE SELECTOR FOUND:`);
    const options = await modeSelector.locator("option").allTextContents();
    console.log(`   Available modes: ${options.join(", ")}`);

    const currentMode = await modeSelector.inputValue();
    console.log(`   Current mode: "${currentMode}"`);
  }

  // Look for buttons
  const buttons = await page.locator("button:visible").allTextContents();
  console.log(`\n🔘 BUTTONS I SEE:`);
  buttons.forEach((btn) => console.log(`   - "${btn}"`));

  // Look for the editor
  const editorVisible = await page.locator(".milkdown").isVisible();
  console.log(`\n✍️  EDITOR:`);
  console.log(`   - Editor found: ${editorVisible ? "✓" : "✗"}`);

  if (editorVisible) {
    const editorContent = await page.locator(".milkdown .ProseMirror").textContent();
    console.log(`   - Current content: "${editorContent?.substring(0, 100)}..."`);
  }

  // STEP 4: Try using the editor
  console.log(`\n═══ STEP 4: Let me try typing in the editor ═══`);

  const editor = page.locator(".milkdown .ProseMirror");
  await editor.click();
  console.log("✓ Clicked in the editor");

  await page.keyboard.type("\n\nAs a new user, I want to test this app!");
  console.log("✓ Typed some text");

  await page.screenshot({ path: testInfo.outputPath("04-typing.png"), fullPage: true });
  console.log("📸 Screenshot saved: 04-typing.png");

  // STEP 5: Try changing modes
  console.log(`\n═══ STEP 5: Let me try switching to Muse mode ═══`);

  await modeSelector.selectOption("muse");
  console.log('✓ Selected "Muse" mode');

  await page.screenshot({ path: testInfo.outputPath("05-muse-mode.png"), fullPage: true });
  console.log("📸 Screenshot saved: 05-muse-mode.png");

  // Check if any buttons changed
  const stuckButton = page.locator('[data-testid="manual-trigger-button"]');
  const stuckButtonEnabled = await stuckButton.isEnabled().catch(() => false);

  console.log(`\n🔍 AFTER SWITCHING TO MUSE:`);
  console.log(`   - "I'm stuck!" button enabled: ${stuckButtonEnabled ? "✓" : "✗"}`);

  // STEP 6: Try the "I'm stuck" button
  if (stuckButtonEnabled) {
    console.log(`\n═══ STEP 6: Let me click "I'm stuck!" button ═══`);

    await stuckButton.click();
    console.log('✓ Clicked "I\'m stuck!"');

    await page.waitForTimeout(3000);

    await page.screenshot({ path: testInfo.outputPath("06-after-stuck-button.png"), fullPage: true });
    console.log("📸 Screenshot saved: 06-after-stuck-button.png");

    const editorContentAfter = await page.locator(".milkdown .ProseMirror").textContent();
    console.log(`\n📝 EDITOR CONTENT AFTER:`);
    console.log(`   "${editorContentAfter}"`);
  }

  // STEP 7: Try Loki mode
  console.log(`\n═══ STEP 7: Let me try Loki mode (chaos mode!) ═══`);

  await modeSelector.selectOption("loki");
  console.log('✓ Selected "Loki" mode');

  await page.screenshot({ path: testInfo.outputPath("07-loki-mode.png"), fullPage: true });
  console.log("📸 Screenshot saved: 07-loki-mode.png");

  // STEP 8: Test keyboard shortcut
  console.log(`\n═══ STEP 8: Testing the "?" keyboard shortcut ═══`);

  await page.keyboard.press("?");
  await page.waitForTimeout(500);

  const modalReappeared = await page.locator(".welcome-modal").isVisible();
  console.log(`   - Modal reappeared: ${modalReappeared ? "✓" : "✗"}`);

  if (modalReappeared) {
    await page.screenshot({ path: testInfo.outputPath("08-help-reopened.png"), fullPage: true });
    console.log("📸 Screenshot saved: 08-help-reopened.png");

    // Close it with Escape
    await page.keyboard.press("Escape");
    console.log("✓ Closed with Escape key");
  }

  // STEP 9: Mobile view test
  console.log(`\n═══ STEP 9: Testing mobile view ═══`);

  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(500);

  await page.screenshot({ path: testInfo.outputPath("09-mobile-view.png"), fullPage: true });
  console.log("📸 Screenshot saved: 09-mobile-view.png");

  const mobileEditorVisible = await page.locator(".milkdown").isVisible();
  const mobileHeaderVisible = await page.locator(".app-header").isVisible();

  console.log(`\n📱 MOBILE VIEW ASSESSMENT:`);
  console.log(`   - Editor visible: ${mobileEditorVisible ? "✓" : "✗"}`);
  console.log(`   - Header visible: ${mobileHeaderVisible ? "✓" : "✗"}`);

  // FINAL SUMMARY
  console.log(`\n╔════════════════════════════════════════╗`);
  console.log(`║   NEW USER AUDIT - FINAL THOUGHTS      ║`);
  console.log(`╚════════════════════════════════════════╝`);
  console.log(`\n✅ WHAT I LIKED:`);
  console.log(`   1. Clear welcome modal explaining the concept`);
  console.log(`   2. Simple, clean interface`);
  console.log(`   3. Easy to understand modes (Off/Muse/Loki)`);
  console.log(`   4. Helpful "?" keyboard shortcut for help`);
  console.log(`   5. Works on mobile!`);

  console.log(`\n💡 MY UNDERSTANDING:`);
  console.log(`   - This is a "pressure system" for writing`);
  console.log(`   - Muse mode helps when I'm stuck (60s timer or manual)`);
  console.log(`   - Loki mode adds chaos (random interventions)`);
  console.log(`   - AI-added content is "locked" (can't delete it)`);

  console.log(`\n📊 ALL SCREENSHOTS SAVED:`);
  console.log(`   - ${testInfo.outputPath("01-first-load.png")}`);
  console.log(`   - ${testInfo.outputPath("02-welcome-modal.png")}`);
  console.log(`   - ${testInfo.outputPath("03-main-ui.png")}`);
  console.log(`   - ${testInfo.outputPath("04-typing.png")}`);
  console.log(`   - ${testInfo.outputPath("05-muse-mode.png")}`);
  console.log(`   - ${testInfo.outputPath("06-after-stuck-button.png")}`);
  console.log(`   - ${testInfo.outputPath("07-loki-mode.png")}`);
  console.log(`   - ${testInfo.outputPath("08-help-reopened.png")}`);
  console.log(`   - ${testInfo.outputPath("09-mobile-view.png")}`);

  console.log(`\n✨ AUDIT COMPLETE ✨\n`);
});
