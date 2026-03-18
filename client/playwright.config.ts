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

// Base URL for tests
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173";

// Whether to start the web server (set SKIP_WEBSERVER=1 to use existing server)
const shouldStartWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER !== "1";

// Backend health check URL
const backendHealthURL = process.env.BACKEND_HEALTH_URL || "http://localhost:8000/health";

export default defineConfig({
  testDir: "./e2e",

  // Parallel execution settings
  fullyParallel: !process.env.CI, // Disable parallel in CI for stability
  workers: process.env.CI ? 1 : undefined, // Single worker in CI

  // Retry configuration: more retries in CI for flaky environments
  retries: process.env.CI ? 2 : 1,

  // Fail fast in CI to save resources
  forbidOnly: !!process.env.CI,
  maxFailures: process.env.CI ? 5 : undefined,

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
    trace: "on-first-retry", // Capture traces on first retry for debugging
    screenshot: "only-on-failure", // Screenshots on failure
    video: "on-first-retry", // Video on first retry
    storageState: "./e2e/storage-state.json",
    actionTimeout: 15000, // Action timeout: 15s
    navigationTimeout: 30000, // Navigation timeout: 30s
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

  // Web server configuration
  webServer: shouldStartWebServer
    ? {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120000, // 2 minutes to start
        stderr: "pipe",
        stdout: "pipe",
      }
    : undefined,
});
