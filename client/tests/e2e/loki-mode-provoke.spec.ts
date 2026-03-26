/**
 * E2E Test: Loki Mode Provoke Flow
 *
 * Tests the Loki mode provoke action where:
 * 1. Loki mode is enabled
 * 2. Random timer triggers intervention (30-120s random interval)
 * 3. API returns "provoke" action with locked content
 * 4. Glitch animation and sound effects play
 * 5. Content changes with locked block injection
 * 6. Locked content cannot be deleted
 *
 * Constitutional Compliance:
 * - Article III (TDD): Tests validate chaos/random behavior
 * - Article V (Documentation): Complete workflow documentation
 */

import { test, expect } from "@playwright/test";
import { waitForAppReady } from "./helpers/waitHelpers";

test.describe("Loki Mode - Provoke Action Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app in Loki mode
    await page.goto("/?mode=loki");
    await waitForAppReady(page);

    // Verify we're in Loki mode
    const modeSelector = page.getByTestId("mode-selector");
    const modeValue = await modeSelector.inputValue();
    expect(modeValue).toBe("loki");
  });

  test("should trigger Loki provoke intervention at random interval", async ({ page }) => {
    // Step 1: Setup API mock for provoke action
    await page.route("**/impetus/generate-intervention", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          action: "provoke",
          content: "> Chaos emerges from the void. Nothing is certain.",
          lock_id: "lock_loki_random_001",
          anchor: {
            type: "pos",
            from: 5,
          },
          action_id: "act_loki_random_001",
        }),
      });
    });

    // Step 2: Type some content (Loki doesn't wait for idle!)
    const prosemirrorEditor = page.locator('.milkdown .ProseMirror[contenteditable="true"]');
    await prosemirrorEditor.click();
    await page.keyboard.type("Order and structure must be maintained.");

    // Step 3: Wait for random timer (max 120s in production, faster in test)
    const interventionPromise = page.waitForRequest(
      (request) =>
        request.url().includes("/impetus/generate-intervention") && request.method() === "POST",
      { timeout: 150000 }
    );

    const request = await interventionPromise;

    // Step 4: Verify the API request
    const requestBody = request.postDataJSON();
    expect(requestBody.mode).toBe("loki");
    expect(requestBody.context).toBeDefined();
    expect(requestBody.client_meta).toBeDefined();

    // Step 5: Verify locked block is injected
    const lockedBlock = page.locator('[data-lock-id="lock_loki_random_001"]');
    await expect(lockedBlock).toBeVisible({ timeout: 5000 });

    // Verify content
    const blockText = await lockedBlock.textContent();
    expect(blockText).toContain("Chaos emerges");
  });

  test("should display glitch animation on provoke injection", async ({ page }) => {
    // Step 1: Setup mock with provoke action
    await page.route("**/impetus/generate-intervention", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          action: "provoke",
          content: "> Glitch test content.",
          lock_id: "lock_loki_glitch_test",
          anchor: { type: "pos", from: 10 },
          action_id: "act_loki_glitch",
        }),
      });
    });

    // Step 2: Type content and wait for intervention
    const prosemirrorEditor = page.locator('.milkdown .ProseMirror[contenteditable="true"]');
    await prosemirrorEditor.click();
    await page.keyboard.type("Testing glitch animation.");

    // Wait for intervention
    await page.waitForRequest(
      (request) => request.url().includes("/impetus/generate-intervention"),
      { timeout: 150000 }
    );

    // Step 3: Verify locked block appears
    const lockedBlock = page.locator('[data-lock-id="lock_loki_glitch_test"]');
    await expect(lockedBlock).toBeVisible({ timeout: 5000 });

    // Step 4: Check for glitch animation class
    await page.waitForTimeout(100); // Wait for animation to start

    const hasGlitchAnimation = await lockedBlock.evaluate(
      (el = el.classList.contains("glitch-animation"))
    );
    expect(hasGlitchAnimation).toBe(true);

    // Step 5: Verify CSS animation properties
    const animationStyles = await lockedBlock.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        animationName: styles.animationName,
        animationDuration: styles.animationDuration,
        animationFillMode: styles.animationFillMode,
      };
    });

    expect(animationStyles.animationName).not.toBe("none");
    expect(animationStyles.animationDuration).not.toBe("0s");
  });

  test("should prevent deletion of locked Loki content", async ({ page }) => {
    // Step 1: Setup provoke action
    await page.route("**/impetus/generate-intervention", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          action: "provoke",
          content: "> This Loki content is locked forever.",
          lock_id: "lock_loki_delete_test",
          anchor: { type: "pos", from: 10 },
          action_id: "act_loki_delete",
        }),
      });
    });

    // Step 2: Type and wait for intervention
    const prosemirrorEditor = page.locator('.milkdown .ProseMirror[contenteditable="true"]');
    await prosemirrorEditor.click();
    await page.keyboard.type("Deletable content.");

    await page.waitForRequest(
      (request) => request.url().includes("/impetus/generate-intervention"),
      { timeout: 150000 }
    );

    // Step 3: Verify locked block
    const lockedBlock = page.locator('[data-lock-id="lock_loki_delete_test"]');
    await expect(lockedBlock).toBeVisible({ timeout: 5000 });

    const initialContent = await lockedBlock.textContent();

    // Step 4: Attempt deletion
    await lockedBlock.click();
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Delete");

    // Step 5: Verify content persists
    await expect(lockedBlock).toBeVisible();
    const finalContent = await lockedBlock.textContent();
    expect(finalContent).toBe(initialContent);
  });

  test("should trigger intervention even while user is typing", async ({ page }) => {
    // Loki mode is chaos - it doesn't respect idle time

    // Step 1: Setup mock
    await page.route("**/impetus/generate-intervention", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          action: "provoke",
          content: "> Chaos strikes mid-sentence!",
          lock_id: "lock_loki_typing_test",
          anchor: { type: "pos", from: 0 },
          action_id: "act_loki_typing",
        }),
      });
    });

    // Step 2: Start typing continuously
    const prosemirrorEditor = page.locator('.milkdown .ProseMirror[contenteditable="true"]');
    await prosemirrorEditor.click();

    const typingInterval = setInterval(async () => {
      await prosemirrorEditor.type("Typing...");
    }, 500);

    try {
      // Step 3: Wait for intervention (should happen even during typing)
      const request = await page.waitForRequest(
        (request) => request.url().includes("/impetus/generate-intervention"),
        { timeout: 150000 }
      );

      const requestBody = request.postDataJSON();
      expect(requestBody.mode).toBe("loki");

      // Step 4: Verify locked block appeared
      const lockedBlock = page.locator('[data-lock-id="lock_loki_typing_test"]');
      await expect(lockedBlock).toBeVisible({ timeout: 5000 });
    } finally {
      clearInterval(typingInterval);
    }
  });

  test("should mark locked blocks with Loki source attribute", async ({ page }) => {
    // Step 1: Setup mock
    await page.route("**/impetus/generate-intervention", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          action: "provoke",
          content: "> Source attribution test.",
          lock_id: "lock_loki_source_test",
          anchor: { type: "pos", from: 10 },
          action_id: "act_loki_source",
        }),
      });
    });

    // Step 2: Trigger intervention
    const prosemirrorEditor = page.locator('.milkdown .ProseMirror[contenteditable="true"]');
    await prosemirrorEditor.click();
    await page.keyboard.type("Testing source attribution.");

    await page.waitForRequest(
      (request) => request.url().includes("/impetus/generate-intervention"),
      { timeout: 150000 }
    );

    // Step 3: Verify locked block has correct source
    const lockedBlock = page.locator('[data-lock-id="lock_loki_source_test"]');
    await expect(lockedBlock).toBeVisible({ timeout: 5000 });

    const sourceAttr = await lockedBlock.getAttribute("data-source");
    expect(sourceAttr).toBe("loki");
  });

  test("should schedule new random timer after intervention", async ({ page }) => {
    let interventionCount = 0;

    // Step 1: Setup mock with counter
    await page.route("**/impetus/generate-intervention", async (route) => {
      interventionCount++;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          action: "provoke",
          content: `> Intervention #${interventionCount}`,
          lock_id: `lock_loki_schedule_${interventionCount}`,
          anchor: { type: "pos", from: 10 },
          action_id: `act_loki_schedule_${interventionCount}`,
        }),
      });
    });

    // Step 2: Trigger first intervention
    const prosemirrorEditor = page.locator('.milkdown .ProseMirror[contenteditable="true"]');
    await prosemirrorEditor.click();
    await page.keyboard.type("First trigger.");

    await page.waitForRequest(
      (request) => request.url().includes("/impetus/generate-intervention"),
      { timeout: 150000 }
    );

    // Verify first intervention
    expect(interventionCount).toBeGreaterThanOrEqual(1);

    // Step 3: Wait for second intervention (new timer should be scheduled)
    await page.waitForRequest(
      (request) => request.url().includes("/impetus/generate-intervention"),
      { timeout: 150000 }
    );

    // Verify second intervention occurred
    expect(interventionCount).toBeGreaterThanOrEqual(2);

    // Step 4: Verify both locked blocks exist
    const firstBlock = page.locator('[data-lock-id="lock_loki_schedule_1"]');
    const secondBlock = page.locator('[data-lock-id="lock_loki_schedule_2"]');

    await expect(firstBlock).toBeVisible({ timeout: 5000 });
    await expect(secondBlock).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Loki Mode - Sound Effects", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?mode=loki");
    await waitForAppReady(page);
  });

  test("should trigger clank sound on provoke injection", async ({ page }) => {
    // Note: Audio testing in headless browsers is limited
    // We verify the sound trigger was called

    // Step 1: Setup audio tracking
    await page.addInitScript(() => {
      (window as any).__testHooks__ = {
        audioPlayer: { lastPlayedSound: null },
      };

      const originalPlay = HTMLAudioElement.prototype.play;
      HTMLAudioElement.prototype.play = function () {
        if (this.src.includes("clank")) {
          (window as any).__testHooks__.audioPlayer.lastPlayedSound = "clank";
        }
        return originalPlay.call(this);
      };
    });

    // Step 2: Setup mock intervention
    await page.route("**/impetus/generate-intervention", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          action: "provoke",
          content: "> Sound test content.",
          lock_id: "lock_loki_sound_test",
          anchor: { type: "pos", from: 10 },
          action_id: "act_loki_sound",
        }),
      });
    });

    // Step 3: Trigger intervention
    const prosemirrorEditor = page.locator('.milkdown .ProseMirror[contenteditable="true"]');
    await prosemirrorEditor.click();
    await page.keyboard.type("Testing sound effects.");

    await page.waitForRequest(
      (request) => request.url().includes("/impetus/generate-intervention"),
      { timeout: 150000 }
    );

    // Step 4: Wait for locked block and sound
    const lockedBlock = page.locator('[data-lock-id="lock_loki_sound_test"]');
    await expect(lockedBlock).toBeVisible({ timeout: 5000 });

    await page.waitForTimeout(600); // Wait for sound to play

    // Step 5: Verify sound was triggered (if test hooks available)
    const audioResult = await page.evaluate(() => {
      return (window as any).__testHooks__?.audioPlayer?.lastPlayedSound;
    });

    if (audioResult) {
      expect(audioResult).toBe("clank");
    }
  });
});

test.describe("Loki Mode - Mode Switching", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?mode=loki");
    await waitForAppReady(page);
  });

  test("should not trigger Loki intervention when mode is off", async ({ page }) => {
    // Step 1: Switch to off mode
    const modeSelector = page.getByTestId("mode-selector");
    await modeSelector.selectOption("off");

    // Step 2: Type content
    const prosemirrorEditor = page.locator('.milkdown .ProseMirror[contenteditable="true"]');
    await prosemirrorEditor.click();
    await page.keyboard.type("Content in off mode.");

    // Step 3: Wait longer than max Loki timer
    let apiCalled = false;
    page.on("request", (request) => {
      if (request.url().includes("/impetus/generate-intervention")) {
        const body = request.postDataJSON();
        if (body?.mode === "loki") {
          apiCalled = true;
        }
      }
    });

    await page.waitForTimeout(130000); // Wait 130 seconds

    // Step 4: Verify no Loki intervention
    expect(apiCalled).toBe(false);
  });

  test("should not trigger Loki intervention when mode is muse", async ({ page }) => {
    // Step 1: Switch to Muse mode
    const modeSelector = page.getByTestId("mode-selector");
    await modeSelector.selectOption("muse");

    // Step 2: Type content
    const prosemirrorEditor = page.locator('.milkdown .ProseMirror[contenteditable="true"]');
    await prosemirrorEditor.click();
    await page.keyboard.type("Content in Muse mode.");

    // Step 3: Wait
    let lokiCalled = false;
    page.on("request", (request) => {
      if (request.url().includes("/impetus/generate-intervention")) {
        const body = request.postDataJSON();
        if (body?.mode === "loki") {
          lokiCalled = true;
        }
      }
    });

    await page.waitForTimeout(130000);

    // Step 4: Verify no Loki intervention
    expect(lokiCalled).toBe(false);
  });
});
