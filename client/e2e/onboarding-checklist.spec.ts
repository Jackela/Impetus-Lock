import { test, expect } from "@playwright/test";

/**
 * Ensures the BYOK onboarding checklist guides new users.
 */

test("BYOK onboarding checklist guides setup", async ({ page }) => {
  await page.goto("/");

  const checklist = page.locator(".onboarding-checklist");
  await expect(checklist).toBeVisible();

  const steps = checklist.locator("li");
  await expect(steps).toHaveCount(3);

  const firstStep = steps.nth(0).locator('input[type="checkbox"]');
  await firstStep.check();
  await expect(firstStep).toBeChecked();

  await expect(steps.nth(0)).toContainText("Launch dev stack");
  await expect(steps.nth(1)).toContainText("Open LLM Settings");
});
