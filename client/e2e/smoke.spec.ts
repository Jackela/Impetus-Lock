import { test, expect } from "@playwright/test";

test("homepage renders successfully", async ({ page }) => {
  await page.goto("/");

  // Verify the page loads (actual title from index.html)
  await expect(page).toHaveTitle("client");

  // Verify React is working
  await expect(page.locator("h1")).toBeVisible();
});

test("has working counter button", async ({ page }) => {
  await page.goto("/");

  // Find and click the counter button
  const button = page.getByRole("button", { name: /count is/i });
  await expect(button).toBeVisible();

  await button.click();
  await expect(button).toHaveText("count is 1");

  await button.click();
  await expect(button).toHaveText("count is 2");
});
