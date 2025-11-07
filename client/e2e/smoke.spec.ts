import { test, expect } from "@playwright/test";
import { waitForReactHydration, waitForAppReady } from "./helpers/waitHelpers";

test("homepage renders successfully", async ({ page }) => {
  await page.goto("/");

  // Verify the page loads (actual title from index.html)
  await expect(page).toHaveTitle("client");

  // Wait for React to hydrate
  await waitForReactHydration(page);

  // Verify React is working - Impetus Lock title (in header, not editor content)
  const heading = page.locator(".app-header h1");
  await expect(heading).toBeVisible({ timeout: 5000 });
  await expect(heading).toHaveText("Impetus Lock");

  // Wait for editor to be ready
  const editorReady = page.getByTestId("editor-ready");
  await expect(editorReady).toBeVisible({ timeout: 10000 });

  // Verify editor is present
  await expect(page.locator(".milkdown")).toBeVisible({ timeout: 5000 });
});

test("app has mode selector and manual trigger", async ({ page }) => {
  await page.goto("/");

  // Wait for React + app header to be ready
  await waitForReactHydration(page);
  await page.waitForSelector(".app-header", { timeout: 5000 });

  // Find mode selector
  const modeSelector = page.getByTestId("mode-selector");
  await expect(modeSelector).toBeVisible({ timeout: 5000 });

  // Verify default mode is "off"
  await expect(modeSelector).toHaveValue("off");

  // Verify manual trigger button exists
  const manualTrigger = page.getByTestId("manual-trigger-button");
  await expect(manualTrigger).toBeVisible({ timeout: 5000 });

  // Manual trigger should be disabled in Off mode
  await expect(manualTrigger).toBeDisabled();
});
