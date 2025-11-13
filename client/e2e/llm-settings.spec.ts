import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

async function openLLMSettings(page: Page) {
  const welcomeButton = page.getByRole("button", { name: "Get Started" });
  if (await welcomeButton.isVisible().catch(() => false)) {
    await welcomeButton.click();
  }

  const modal = page.getByTestId("config-error-modal");
  if (await modal.isVisible().catch(() => false)) {
    await page.getByTestId("config-error-open-settings").click();
  } else {
    const trigger = page.getByTestId("llm-settings-trigger");
    await trigger.waitFor({ state: "visible", timeout: 60000 });
    await trigger.click();
  }

  await expect(page.getByRole("heading", { name: "LLM Settings" })).toBeVisible();
  await page.getByTestId("storage-mode-select").waitFor({ state: "visible", timeout: 15000 });
}

test.describe("LLM Settings", () => {
  test("user can store BYOK credentials and forget them", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());

    await openLLMSettings(page);
    await page.getByTestId("llm-provider-select").selectOption("anthropic");
    await page.getByTestId("llm-model-input").fill("claude-3-5-haiku-latest");
    await page.getByTestId("llm-key-input").fill("sk-ant-playwright");
    const saveButton = page.getByTestId("llm-settings-save");
    await saveButton.scrollIntoViewIfNeeded();
    await saveButton.evaluate((button) => (button as HTMLButtonElement).click());

    const llmButton = page.getByTestId("llm-settings-trigger");
    await expect(llmButton).toContainText("Anthropic Claude");

    await page.getByTestId("forget-llm-key-button").click();
    await expect(llmButton).toHaveText("LLM Settings");
    const stored = await page.evaluate(() => window.localStorage.getItem("impetus.llmConfig"));
    expect(stored).toBeNull();
  });

  test("encrypted storage requires passphrase to unlock across reloads", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());

    await openLLMSettings(page);
    await page.getByTestId("llm-provider-select").selectOption("openai");
    await page.evaluate(() => {
      const select = document.querySelector('[data-testid="storage-mode-select"]') as HTMLSelectElement | null;
      if (select) {
        select.value = "encrypted";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.getByTestId("llm-passphrase-input").fill("hunter2-pass");
    await page.getByTestId("llm-passphrase-confirm-input").fill("hunter2-pass");
    await page.getByTestId("llm-key-input").fill("sk-test-encrypted");
    const saveEncrypted = page.getByTestId("llm-settings-save");
    await saveEncrypted.scrollIntoViewIfNeeded();
    await saveEncrypted.evaluate((button) => (button as HTMLButtonElement).click());

    await expect(page.getByTestId("llm-settings-trigger")).toContainText("LLM: OpenAI", { timeout: 15000 });

    await page.reload();
    await openLLMSettings(page);

    const passInput = page.getByTestId("llm-passphrase-input");
    await expect(passInput).toBeVisible();
    await passInput.fill("wrong-pass");
    await page
      .getByRole("button", { name: "Unlock" })
      .evaluate((button) => (button as HTMLButtonElement).click());
    await expect(page.getByText("Passphrase incorrect")).toBeVisible();

    await passInput.fill("hunter2-pass");
    await page
      .getByRole("button", { name: "Unlock" })
      .evaluate((button) => (button as HTMLButtonElement).click());
    await expect(page.getByText("Passphrase incorrect")).toHaveCount(0);
    await expect(page.getByTestId("llm-key-input")).toHaveValue("sk-test-encrypted");
  });

  test("session mode forgets keys after locking or reloading", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());

    await openLLMSettings(page);
    await page.getByTestId("llm-provider-select").selectOption("openai");
    await page.evaluate(() => {
      const select = document.querySelector('[data-testid="storage-mode-select"]') as HTMLSelectElement | null;
      if (select) {
        select.value = "session";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.getByTestId("llm-key-input").fill("sk-session-key");
    const saveSession = page.getByTestId("llm-settings-save");
    await saveSession.scrollIntoViewIfNeeded();
    await saveSession.evaluate((button) => (button as HTMLButtonElement).click());

    await expect(page.getByTestId("llm-settings-trigger")).toContainText("LLM: OpenAI", { timeout: 15000 });

    await page.getByTestId("lock-session-button").click();
    await expect(page.getByTestId("llm-settings-trigger")).toHaveText("LLM Settings");

    await openLLMSettings(page);
    await expect(page.getByTestId("llm-key-input")).toHaveValue("");
    await page.getByTestId("llm-key-input").fill("sk-session-key-2");
    await page.getByTestId("llm-settings-save").evaluate((button) => (button as HTMLButtonElement).click());

    await page.reload();
    await openLLMSettings(page);
    await expect(page.getByTestId("llm-key-input")).toHaveValue("");
  });
});
