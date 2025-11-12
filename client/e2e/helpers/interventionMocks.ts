import type { Page } from "@playwright/test";

const API_ENDPOINT = "**/api/v1/impetus/generate-intervention";

interface InterventionMockOptions {
  delayMs?: number;
}

export async function mockInterventionSuccess(page: Page, options: InterventionMockOptions = {}) {
  await page.route(API_ENDPOINT, async (route) => {
    if (options.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        action: "provoke",
        content: "Keep up the momentum!",
        lock_id: "lock_playwright",
        anchor: { type: "pos", from: 0 },
        action_id: "act_playwright",
        issued_at: new Date().toISOString(),
        source: "muse",
      }),
    });
  });
}

export async function mockInterventionFailure(page: Page, status = 500) {
  await page.route(API_ENDPOINT, async (route) => {
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Internal server error",
        message: "Mocked failure",
      }),
    });
  });
}
