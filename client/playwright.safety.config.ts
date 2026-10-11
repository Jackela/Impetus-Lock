import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";

const run = process.env.AUTH_E2E_RUN ?? "current";
const mode = process.env.AUTH_E2E_MODE ?? "preview";
const evidence = `../.scratch/authenticated-editor-safety-2026-10-11/browser-${run}`;
const baseURL = "http://127.0.0.1:3101";
const stockFirefoxExecutable = process.env.AUTH_E2E_FIREFOX_STOCK_EXECUTABLE;
if (
  stockFirefoxExecutable &&
  (process.platform !== "linux" ||
    !isAbsolute(stockFirefoxExecutable) ||
    !existsSync(stockFirefoxExecutable))
)
  throw new Error("Stock Firefox requires an existing absolute executable path on Linux");
const core =
  /real anonymous|real login|real autosave|expiry keeps|multi-tab|backend restart|unconfirmed creation|legacy storage read|task switch|unknown owned version/;
const firefoxCore =
  /real anonymous|real login|real autosave|expiry keeps|multi-tab shared|multi-tab same|multi-tab focus|unconfirmed creation|legacy storage read|task switch|unknown owned version/;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "authenticated-editor-safety.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 150_000,
  expect: { timeout: 12_000 },
  outputDir: `${evidence}-results`,
  reporter: [["list"], ["json", { outputFile: `${evidence}-results.json` }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    viewport: { width: 1280, height: 900 },
  },
  projects: [
    {
      name: "safe-chromium-auth",
      use: { ...devices["Desktop Chrome"], channel: "chromium" },
    },
    {
      name: "safe-firefox-auth",
      grep: firefoxCore,
      use: {
        ...devices["Desktop Firefox"],
        ...(stockFirefoxExecutable
          ? {
              channel: "moz-firefox",
              headless: false,
              launchOptions: {
                executablePath: stockFirefoxExecutable,
                firefoxUserPrefs: {
                  "focusmanager.testmode": false,
                  "layout.testing.top-level-always-active": false,
                },
              },
            }
          : {}),
      },
    },
    {
      name: "safe-webkit-auth",
      grep: core,
      use: {
        ...devices["Desktop Safari"],
        headless: process.env.AUTH_E2E_WEBKIT_XVFB !== "1",
      },
    },
  ],
  webServer:
    process.env.AUTH_E2E_EXTERNAL === "1"
      ? undefined
      : {
          command: `npm run ${mode === "dev" ? "dev" : "preview"} -- --host 127.0.0.1 --port 3101 --strictPort`,
          env: { VITE_API_URL: "http://127.0.0.1:8101" },
          url: baseURL,
          reuseExistingServer: false,
          timeout: 60_000,
        },
});
