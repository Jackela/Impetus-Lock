import { test, expect } from "@playwright/test";

test.describe("LLM Settings", () => {
  test("user can store BYOK credentials", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());

    await page.route("**/api/v1/impetus/generate-intervention", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          action: "provoke",
          content: "模拟内容",
          lock_id: "lock_test",
          anchor: { type: "pos", from: 0 },
          action_id: "act_test",
          issued_at: new Date().toISOString(),
          source: "muse",
        }),
      });
    });

    const welcomeButton = page.getByRole("button", { name: "Get Started" });
    if (await welcomeButton.isVisible().catch(() => false)) {
      await welcomeButton.click();
    }

    const modal = page.getByTestId("config-error-modal");
    const modalVisible = await modal.isVisible().catch(() => false);
    if (modalVisible) {
      await page.getByTestId("config-error-open-settings").click();
    } else {
      await page.waitForFunction(
        () => !!document.querySelector('[data-testid="llm-settings-trigger"]'),
        undefined,
        { timeout: 60000 }
      );
      await page.getByTestId("llm-settings-trigger").click();
    }

    await expect(page.getByRole("heading", { name: "LLM Settings" })).toBeVisible();
    await page.getByTestId("llm-provider-select").selectOption("anthropic");
    await page.getByTestId("llm-model-input").fill("claude-3-5-haiku-latest");
    await page.getByTestId("llm-key-input").fill("sk-ant-playwright");
    await page.getByTestId("llm-settings-save").click();

    await expect(page.getByRole("button", { name: /LLM:/ })).toContainText("Anthropic Claude");
  });
});
