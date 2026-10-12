import { defineConfig, devices } from "@playwright/test";

const preview = process.env.STORY_FRONTEND_MODE === "preview";
const evidence = `./test-results/story/${preview ? "preview" : "development"}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "muse-loki-story.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: `${evidence}/browser`,
  reporter: [["list"], ["json", { outputFile: `${evidence}/results.json` }]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: "normal-chromium-story", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: preview
      ? "npm run build && npm run preview -- --host 127.0.0.1 --port 3000 --strictPort"
      : "npm run dev -- --host 127.0.0.1 --port 3000 --strictPort",
    env: { VITE_API_URL: "http://127.0.0.1:8001" },
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
