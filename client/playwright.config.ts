import { defineConfig, devices } from "@playwright/test";

const reporters =
  process.env.CI === "true" || process.env.CI === "1"
    ? [
        ["list"],
        ["html", { open: "never" }],
      ]
    : "html";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173";
const shouldStartWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER !== "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: reporters,
  use: {
    baseURL,
    trace: "on-first-retry",
    storageState: "./e2e/storage-state.json",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: shouldStartWebServer
    ? {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
      }
    : undefined,
});
