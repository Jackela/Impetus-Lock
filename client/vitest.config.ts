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
    coverage: {
      provider: "v8",
      // Glob patterns (leading `**/`) are required: vitest 5 appends `/**` to
      // non-glob patterns and treats them as directories, which would match
      // nothing and let the lines threshold pass vacuously.
      include: [
        "**/src/services/LockManager.ts",
        "**/src/components/Editor/TransactionFilter.ts",
        "**/src/services/ContentInjector.ts",
        "**/src/utils/prosemirror-helpers.ts",
        "**/src/utils/textRange.ts",
        "**/src/utils/editorMarkdown.ts",
      ],
      reporter: ["text", "json", "html"],
      thresholds: { lines: 80 },
    },
    // Vitest 5 requires Node >= 22.12 for the dev toolchain (CI runs Node 24).
    // The package `engines` field intentionally stays ">=20.19 <25" — the
    // runtime/build floor is unchanged; this note is document-only.
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
