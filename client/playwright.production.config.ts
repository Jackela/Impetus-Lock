import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "production-proxy.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: "list",
  outputDir: "test-results/production-proxy/",
  use: {
    ...devices["Desktop Chrome"],
    channel: "chromium",
    baseURL: process.env.PRODUCTION_SMOKE_URL,
    trace: "retain-on-failure",
  },
});
