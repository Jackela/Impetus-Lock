import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const testPool =
  (process.env.VITEST_POOL as "forks" | "threads" | "vmThreads" | undefined) ?? "forks";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
    include: ["tests/**/*.{test,spec}.{ts,tsx}", "src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules"],
    pool: testPool,
  },
});
