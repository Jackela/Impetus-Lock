import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E Test Configuration for Impetus Lock
 *
 * Optimized for CI stability with:
 * - Increased timeouts for resource-constrained environments
 * - Global setup/teardown for consistent test environment
 * - Proper worker configuration for CI vs local
 * - Comprehensive reporters for debugging
 */

// Reporter configuration: list for CI, HTML for local development
const reporters = process.env.CI
  ? [
      ["list"], // Console output
      ["html", { open: "never" }], // HTML report
      ["json", { outputFile: "playwright-report/results.json" }], // JSON for CI artifacts
    ]
  : [["html", { open: "on-failure" }]];

// Base URL for tests - frontend dev server
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173";

// Whether to start the web server
// In CI, we want playwright to start the web server
// Set PLAYWRIGHT_SKIP_WEBSERVER=1 to skip web server startup
const shouldStartWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER !== "1";

export default defineConfig({
  testDir: "./e2e",

  // Parallel execution settings - single worker in CI for stability
  fullyParallel: !process.env.CI,
  workers: process.env.CI ? 1 : undefined,

  // Retry configuration
  retries: process.env.CI ? 2 : 1,

  // Timeout configuration
  timeout: 60000, // Global test timeout: 60s
  expect: {
    timeout: 10000, // Expect timeout: 10s
  },

  // Reporter configuration
  reporter: reporters,

  // Global setup and teardown
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",

  // Shared settings for all projects
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
    storageState: "./e2e/storage-state.json",
    actionTimeout: 15000,
    navigationTimeout: 30000,
    viewport: { width: 1280, height: 720 },
  },

  // Test projects
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: ["--disable-web-security", "--disable-features=IsolateOrigins,site-per-process"],
        },
      },
    },
  ],

  // Web server configuration - starts Vite dev server for frontend
  webServer: shouldStartWebServer
    ? {
        command: "npm run dev -- --host",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
        stderr: "pipe",
        stdout: "pipe",
      }
    : undefined,
});
