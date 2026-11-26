import { defineConfig, devices } from "@playwright/test";

const evidence = "./test-results/authenticated-editor/browser";
process.env.AUTH_E2E_GATE = "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 12_000 },
  outputDir: `${evidence}-results`,
  reporter: [["list"], ["json", { outputFile: `${evidence}-results.json` }]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    viewport: { width: 1280, height: 900 },
  },
  projects: [
    {
      name: "safe-chromium-auth",
      testMatch: ["authenticated-editor.spec.ts", "authenticated-editor-drafts.spec.ts"],
      use: { ...devices["Desktop Chrome"], channel: "chromium" },
    },
    {
      name: "safe-chromium-account-recovery",
      testMatch: "authenticated-editor-safety.spec.ts",
      grep: /multi-tab shared cookie rejects|unknown owned version keeps|unconfirmed creation preserves/,
      use: { ...devices["Desktop Chrome"], channel: "chromium" },
    },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 3000 --strictPort",
    env: { VITE_API_URL: "http://127.0.0.1:8001" },
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
