import { expect, test } from "@playwright/test";
import { waitForAppReady } from "./helpers/waitHelpers";
import type { components } from "../src/types/api.generated";

type InterventionResponse = components["schemas"]["InterventionResponse"];

test.use({
  video: {
    mode: "on",
    size: { width: 1280, height: 720 },
  },
});

test.describe("Impetus Lock demo showcase", () => {
  test("captures provoke, rewrite, and delete feedback", async ({ page }) => {
    let museCalls = 0;
    page.on("console", (msg) => {
      if (msg.text().includes("LockDecorations")) {
        console.log("[browser]", msg.text());
      }
    });
    await page.route("**/api/v1/impetus/generate-intervention", (route, request) => {
      const body = request.postDataJSON();
      const isMuse = body?.mode === "muse";
      const selectionFrom = body?.client_meta?.selection_from ?? 80;

      let responseBody: InterventionResponse;

      if (isMuse) {
        if (museCalls === 0) {
          responseBody = {
            action: "provoke",
            content: "立即让主角曝露一个秘密。",
            lock_id: "lock_demo_provoke",
            anchor: { type: "pos", from: selectionFrom },
            action_id: "act_demo_provoke",
            issued_at: new Date().toISOString(),
            source: "muse",
          };
        } else {
          responseBody = {
            action: "rewrite",
            content: "她忽然说出一个惊人的真相。",
            lock_id: "lock_demo_rewrite",
            anchor: {
              type: "range",
              from: Math.max(0, selectionFrom - 24),
              to: selectionFrom,
            },
            action_id: `act_demo_rewrite_${museCalls}`,
            issued_at: new Date().toISOString(),
            source: "muse",
          };
        }
        museCalls += 1;
      } else {
        responseBody = {
          action: "delete",
          content: null,
          lock_id: null,
          anchor: {
            type: "range",
            from: Math.max(0, selectionFrom - 60),
            to: selectionFrom,
          },
          action_id: "act_demo_delete",
          issued_at: new Date().toISOString(),
          source: "loki",
        };
      }

      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(responseBody),
      });
    });

    await page.goto("http://localhost:5173");
    await waitForAppReady(page);

    const welcomeDismiss = page.locator(".welcome-button");
    if (await welcomeDismiss.isVisible({ timeout: 1000 }).catch(() => false)) {
      await welcomeDismiss.click();
    }

    const modeSelector = page.getByTestId("mode-selector");
    const manualTrigger = page.getByTestId("manual-trigger-button");
    const manualDelete = page.getByTestId("manual-delete-trigger");
    const editor = page.locator(".milkdown .ProseMirror");

    await modeSelector.selectOption("muse");
    await editor.click();
    await editor.type("他打开门，犹豫着要不要进去。空气里有铁锈味，像是有人刚拔出一把刀。");

    const provokeRequest = page.waitForRequest("**/api/v1/impetus/generate-intervention");
    const provokeResponse = page.waitForResponse("**/api/v1/impetus/generate-intervention");
    await manualTrigger.click();
    await Promise.all([provokeRequest, provokeResponse]);

    const lockedBlock = page.locator('.locked-content[data-lock-id="lock_demo_provoke"]').first();
    await expect(lockedBlock).toBeVisible({ timeout: 5000 });
    await lockedBlock.click();
    await page.keyboard.press("Backspace");
    await expect(lockedBlock).toBeVisible();

    await page.evaluate(() => (window as any).triggerMuseRewriteForTest?.());
    const inlineRewrite = page.locator('.locked-content[data-lock-id="lock_demo_rewrite"]').first();
    await expect(inlineRewrite).toBeVisible({ timeout: 5000 });
    await expect(inlineRewrite).toHaveAttribute("data-lock-shape", "inline");
    await expect(inlineRewrite).toHaveAttribute("data-source", "muse");

    if (await manualDelete.isVisible().catch(() => false)) {
      await manualDelete.click();
      await expect(manualDelete).toHaveText(/Test Delete/i);
    } else {
      await page.evaluate(() => (window as any).triggerManualDeleteForTest?.());
    }

    await page.waitForTimeout(2000);
  });
});
