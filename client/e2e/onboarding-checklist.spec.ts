import { test, expect } from "@playwright/test";
import { dismissWelcomeModal } from "./helpers/waitHelpers";

/** Verify the current in-app BYOK guidance and configuration contract. */
test("BYOK onboarding guides provider setup and key removal", async ({ page }) => {
  await page.goto("/");
  await dismissWelcomeModal(page);
  await page.getByTestId("llm-settings-trigger").click();

  const dialog = page
    .getByRole("dialog")
    .filter({ has: page.getByRole("heading", { name: "LLM Settings" }) });
  await expect(dialog.getByText("How this works", { exact: true })).toBeVisible();
  await expect(dialog).toContainText("Choose a provider and model");
  await page.getByTestId("storage-mode-select").selectOption("session");
  await expect(page.getByTestId("storage-mode-select")).toHaveValue("session");
  await page.getByTestId("llm-provider-select").selectOption("gemini");
  await expect(dialog.getByRole("link", { name: "Google Gemini API docs" })).toHaveAttribute(
    "href",
    "https://ai.google.dev/gemini-api/docs"
  );
  await expect(page.getByTestId("llm-model-input")).toHaveValue("gemini-2.0-flash-lite");
  await page.getByTestId("llm-key-input").fill("AIza-controlled-browser-fixture-only0000000000");
  const save = page.getByTestId("llm-settings-save");
  await expect(save).toBeEnabled();
  await save.click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByTestId("llm-settings-trigger")).toContainText("Google Gemini");
  await page.getByTestId("forget-llm-key-button").click();
  await expect(page.getByTestId("llm-settings-trigger")).toHaveText("LLM Settings");
});
