import { test, expect } from "@playwright/test";
import { waitForReactHydration } from "./helpers/waitHelpers";

test("export modal opens from header and shows markdown and pdf buttons", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await waitForReactHydration(page);

  const exportButton = page.getByTestId("export-button");
  await expect(exportButton).toBeVisible({ timeout: 5000 });
  await exportButton.click();

  // Verify the modal appears
  const exportModal = page.getByTestId("export-modal");
  await expect(exportModal).toBeVisible({ timeout: 5000 });

  // Verify modal content
  await expect(page.getByText("Export Document")).toBeVisible();
  await expect(page.getByTestId("export-filename-input")).toBeVisible();
  await expect(page.getByTestId("export-markdown")).toBeVisible();
  await expect(page.getByTestId("export-pdf")).toBeVisible();
  await expect(page.getByTestId("export-cancel")).toBeVisible();

  // Click cancel to close
  await page.getByTestId("export-cancel").click();

  // Wait for modal to disappear (150ms animation + buffer)
  await expect(exportModal).not.toBeVisible({ timeout: 3000 });
});

test("export modal closes with Escape key", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await waitForReactHydration(page);

  const exportButton = page.getByTestId("export-button");
  await expect(exportButton).toBeVisible({ timeout: 5000 });
  await exportButton.click();

  const exportModal = page.getByTestId("export-modal");
  await expect(exportModal).toBeVisible({ timeout: 5000 });

  await page.keyboard.press("Escape");
  await expect(exportModal).not.toBeVisible({ timeout: 3000 });
});
