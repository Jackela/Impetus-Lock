import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import type { Reporter } from "vitest/node";

const criticalFiles = [
  "src/services/LockManager.ts",
  "src/components/Editor/TransactionFilter.ts",
  "src/services/ContentInjector.ts",
  "src/utils/prosemirror-helpers.ts",
  "src/utils/textRange.ts",
  "src/utils/editorMarkdown.ts",
];

// Native perFile thresholds cover unexecuted files, but cannot reject a file
// absent from the report. Resolve the fixed inventory against Vitest's actual
// root (including isolated fixtures), rather than this config file's location.
let coverageRoot: string;
const criticalInventory: Reporter = {
  onInit(vitest) {
    coverageRoot = vitest.config.root;
  },
  onCoverage(coverage) {
    if (
      !coverage ||
      typeof coverage !== "object" ||
      !("files" in coverage) ||
      typeof coverage.files !== "function"
    ) {
      throw new Error("Critical coverage report is unavailable");
    }
    const reportedFiles: string[] = coverage.files();
    for (const file of criticalFiles) {
      if (!reportedFiles.some((reported) => resolve(reported) === resolve(coverageRoot, file))) {
        console.error(`Missing critical coverage: ${file}`);
        process.exitCode = 1;
      }
    }
  },
};

const testPool =
  (process.env.VITEST_POOL as "forks" | "threads" | "vmThreads" | undefined) ?? "forks";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    reporters: ["default", criticalInventory],
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
    include: ["tests/**/*.{test,spec}.{ts,tsx}", "src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules"],
    coverage: {
      provider: "v8",
      // Glob patterns (leading `**/`) are required: vitest 5 appends `/**` to
      // non-glob patterns and treats them as directories, which would match
      // nothing and let the lines threshold pass vacuously.
      include: criticalFiles.map((file) => `**/${file}`),
      reporter: ["text", "json", "html"],
      thresholds: { lines: 80, perFile: true },
    },
    // The supported Vitest/jsdom runtime intersection is declared in package
    // `engines` as ^22.13.0 || ^24.0.0. CI and Docker build stages run Node 24.
    //
    // Vitest 4 removed `poolOptions.{threads,forks}.single`; per-file
    // isolation in the standard pools replaces it (the old single-worker
    // mode's shared registry let file-scoped vi.mock instances bleed across
    // test files). Vitest 5 additionally ships the mock-isolation fix
    // (PR #10267) for the cross-file vi.mock leak (vitest#9957) that
    // motivated the vitest 4.0.18 freeze.
    pool: testPool,
  },
});
