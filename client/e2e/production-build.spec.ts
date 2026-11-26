import { test, expect } from "@playwright/test";
import { waitForReactHydration, openHeaderDevTools } from "./helpers/waitHelpers";

// Production behavior is checked with the Docker images in production-proxy.spec.ts.
test.describe("Development server", () => {
  test("Page title is branded", async ({ page }) => {
    await page.goto("/");
    expect(await page.title()).toBe("Impetus Lock");
  });

  test("Test Delete button visible in development", async ({ page }) => {
    // This test runs against dev server (npm run dev)
    // Test Delete button should be visible when import.meta.env.DEV = true
    await page.goto("/");
    await waitForReactHydration(page);

    // Dev-only triggers are nested in the header menu's "Dev tools" disclosure.
    await openHeaderDevTools(page);

    const testDeleteButton = page.locator('[data-testid="manual-delete-trigger"]');

    // In development mode, button should exist and be visible
    await expect(testDeleteButton).toBeVisible();
    await expect(testDeleteButton).toHaveText("Test Delete");
  });
});
