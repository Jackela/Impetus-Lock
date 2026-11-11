/**
 * Global Teardown for Playwright E2E Tests
 *
 * Runs once after all test suites to clean up:
 * - Clean up test data from database
 * - Generate test reports
 * - Prune stale (older than 7 days) artifact directories
 * - Optional: Stop backend if we started it
 *
 * IMPORTANT: this teardown must never delete evidence produced by the current
 * run. `test-results/<test>/` holds the trace.zip / error-context.md /
 * screenshots that make a failure debuggable, and Playwright still needs them
 * when the teardown's summary is printed (and when CI uploads artifacts).
 *
 * Constitutional Compliance:
 * - Article I (Simplicity): Clear cleanup steps
 * - Article V (Documentation): Comprehensive logging
 */

import { existsSync, readdirSync, readFileSync, statSync, rmSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

// ES Module compatible __dirname
const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration
const BACKEND_HEALTH_URL = process.env.BACKEND_HEALTH_URL || "http://localhost:8000/health";
const REPORT_DIR = resolve(__dirname, "../playwright-report");
const ARTIFACT_ROOT_DIRS = ["test-results", "playwright-results"];

// Only artifact directories whose mtime is older than this are pruned.
// Override with PLAYWRIGHT_ARTIFACT_MAX_AGE_DAYS (default 7). Values below 1
// are clamped so current-run evidence can never be eligible for pruning.
const parsedMaxAgeDays = Number(process.env.PLAYWRIGHT_ARTIFACT_MAX_AGE_DAYS ?? "7");
const ARTIFACT_MAX_AGE_DAYS = Number.isFinite(parsedMaxAgeDays) ? Math.max(1, parsedMaxAgeDays) : 7;
const ARTIFACT_MAX_AGE_MS = ARTIFACT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

interface TestSummary {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}

/**
 * Clean up test data from database
 */
async function cleanupTestData(): Promise<void> {
  console.log("\n🧹 Cleaning up test data...");

  try {
    // Check if backend is still running
    const isHealthy = await checkHealth(BACKEND_HEALTH_URL, 3000);
    if (!isHealthy) {
      console.log("⚠️  Backend not available, skipping database cleanup");
      return;
    }

    // Clean up test data via API
    // This could include deleting test users, test tasks, etc.
    const cleanupEndpoints = [
      "/test/cleanup", // If you have a test cleanup endpoint
    ];

    for (const endpoint of cleanupEndpoints) {
      try {
        const url = BACKEND_HEALTH_URL.replace("/health", endpoint);
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (response.ok) {
          console.log(`   Cleaned up via ${endpoint}`);
        }
      } catch {
        // Endpoint may not exist, that's OK
      }
    }

    console.log("✅ Test data cleanup completed");
  } catch (error) {
    console.error("\n⚠️  Test data cleanup failed (non-critical):");
    console.error(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Check if a service is healthy
 */
async function checkHealth(url: string, timeout = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Generate test summary report
 */
async function generateTestReport(): Promise<void> {
  console.log("\n📊 Generating test report...");

  try {
    // Check if JSON results exist
    const resultsPath = resolve(REPORT_DIR, "results.json");
    if (!existsSync(resultsPath)) {
      console.log("   No JSON results found, skipping report generation");
      return;
    }

    // Read and parse results.
    // NOTE: a dynamic `import(resultsPath, { assert: { type: "json" } })` throws
    // ERR_IMPORT_ATTRIBUTE_MISSING on current Node (>=23 removed `assert` in
    // favour of `with`), which silently degraded this whole summary to a warning.
    // Plain read+parse is version-proof and keeps the summary working.
    const rawResults = readFileSync(resultsPath, "utf8");
    const results = JSON.parse(rawResults);
    const summary = extractSummary(results.default || results);

    // Print summary to console
    console.log("\n" + "=".repeat(60));
    console.log("📈 E2E Test Summary");
    console.log("=".repeat(60));
    console.log(`   Total Tests: ${summary.totalTests}`);
    console.log(`   ✅ Passed:   ${summary.passed}`);
    console.log(`   ❌ Failed:   ${summary.failed}`);
    console.log(`   ⏭️  Skipped:  ${summary.skipped}`);
    console.log(`   ⏱️  Duration: ${(summary.duration / 1000).toFixed(1)}s`);
    console.log("=".repeat(60));

    // Calculate success rate
    if (summary.totalTests > 0) {
      const successRate = ((summary.passed / summary.totalTests) * 100).toFixed(1);
      console.log(`   Success Rate: ${successRate}%`);
    }

    console.log("");
  } catch (error) {
    console.error("\n⚠️  Failed to generate test report:");
    console.error(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Extract summary from Playwright JSON results
 */
function extractSummary(results: any): TestSummary {
  const summary: TestSummary = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: 0,
  };

  try {
    if (results.suites) {
      for (const suite of results.suites) {
        if (suite.specs) {
          for (const spec of suite.specs) {
            summary.totalTests++;

            if (spec.tests && spec.tests[0]) {
              const status = spec.tests[0].results?.[0]?.status;
              switch (status) {
                case "passed":
                  summary.passed++;
                  break;
                case "failed":
                  summary.failed++;
                  break;
                case "skipped":
                  summary.skipped++;
                  break;
              }

              // Add duration
              const duration = spec.tests[0].results?.[0]?.duration;
              if (duration) {
                summary.duration += duration;
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Error parsing results:", error);
  }

  return summary;
}

/**
 * Prune stale test artifact directories.
 *
 * Evidence policy (P0): the artifacts of the run that just finished are NEVER
 * touched. Playwright writes `test-results/<test-slug>/{trace.zip,
 * error-context.md,*.png,*.webm}` for failures; deleting them here destroyed
 * the only failure evidence available in CI, so we only remove directories
 * whose mtime is older than ARTIFACT_MAX_AGE_MS (default 7 days).
 */
function cleanupArtifacts(): void {
  console.log(
    `\n🗑️  Pruning artifact directories older than ${ARTIFACT_MAX_AGE_DAYS} day(s) ` +
      "(current run's evidence is preserved)..."
  );

  try {
    const now = Date.now();
    let prunedDirs = 0;
    let keptDirs = 0;

    for (const dirName of ARTIFACT_ROOT_DIRS) {
      const dirPath = resolve(__dirname, "../", dirName);
      if (!existsSync(dirPath)) continue;

      for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
        // `test-results/<slug>/` are the per-test directories that hold evidence.
        // Loose files at the root are left alone: they are cheap and may belong
        // to the run in progress.
        if (!entry.isDirectory()) {
          keptDirs++;
          continue;
        }

        const entryPath = resolve(dirPath, entry.name);
        try {
          const stats = statSync(entryPath);
          if (now - stats.mtimeMs > ARTIFACT_MAX_AGE_MS) {
            rmSync(entryPath, { recursive: true, force: true });
            prunedDirs++;
          } else {
            keptDirs++;
          }
        } catch {
          // Ignore errors for individual directories (permissions, races)
          keptDirs++;
        }
      }
    }

    if (prunedDirs > 0) {
      console.log(`   Pruned ${prunedDirs} stale artifact director(ies), kept ${keptDirs}`);
    } else {
      console.log(`   No stale artifacts to prune (kept ${keptDirs} recent director(ies))`);
    }
  } catch (error) {
    console.error("\n⚠️  Artifact pruning failed (non-critical):");
    console.error(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Recursively collect files whose name matches one of `fileNames`.
 *
 * Playwright nests evidence one level down (`test-results/<slug>/trace.zip`),
 * so the old flat `readdirSync` never found anything and the summary silently
 * reported "no traces" for failing runs.
 */
function collectArtifactFiles(
  dirPath: string,
  fileNames: readonly string[],
  depth = 2,
  acc: string[] = []
): string[] {
  if (depth < 0 || !existsSync(dirPath)) return acc;

  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = resolve(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectArtifactFiles(entryPath, fileNames, depth - 1, acc);
    } else if (fileNames.includes(entry.name)) {
      acc.push(entryPath);
    }
  }

  return acc;
}

/**
 * Stop backend if we started it (optional)
 */
async function stopBackendIfNeeded(): Promise<void> {
  // Only stop backend if we explicitly started it and flag is set
  if (process.env.PLAYWRIGHT_STOP_BACKEND_ON_TEARDOWN === "1") {
    console.log("\n🛑 Stopping backend...");
    // Implementation would go here if needed
    console.log("   (Backend stop not implemented - manual stop required)");
  }
}

/**
 * Print final summary and tips
 */
function printFinalSummary(): void {
  console.log("\n" + "=".repeat(60));
  console.log("🎭 E2E Test Run Complete");
  console.log("=".repeat(60));

  // Check if HTML report exists
  const htmlReportPath = resolve(REPORT_DIR, "index.html");
  if (existsSync(htmlReportPath)) {
    console.log("\n📋 View detailed report:");
    console.log(`   file://${htmlReportPath}`);
  }

  // Check if trace / error-context files exist. Evidence lives one level down
  // (`test-results/<test-slug>/trace.zip`) and is only removed once it is stale,
  // so report it instead of deleting it.
  const traceDir = resolve(__dirname, "../test-results");
  const traces = collectArtifactFiles(traceDir, ["trace.zip", "error-context.md"]);
  if (traces.length > 0) {
    console.log("\n🔍 Evidence retained for failing tests:");
    traces.slice(0, 10).forEach((trace) => {
      console.log(`   - ${trace.replace(resolve(__dirname, "../") + "/", "")}`);
    });
    if (traces.length > 10) {
      console.log(`   ... and ${traces.length - 10} more`);
    }
    console.log("\n   View trace: npx playwright show-trace <trace-file>");
  }

  console.log("\n💡 Tips:");
  console.log("   - Run with DEBUG=1 for verbose output");
  console.log("   - Run with DEBUG_BACKEND=1 to see backend logs");
  console.log("   - Run single test: npx playwright test --grep 'test name'");
  console.log("   - Run with UI: npx playwright test --ui");
  console.log("=".repeat(60) + "\n");
}

/**
 * Main teardown function
 */
async function globalTeardown(): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("🎭 Playwright E2E Test Global Teardown");
  console.log("=".repeat(60));

  try {
    // Step 1: Clean up test data
    await cleanupTestData();

    // Step 2: Generate test report
    await generateTestReport();

    // Step 3: Prune ONLY stale artifacts (this run's traces/screenshots/
    // error-context files must survive so failures stay debuggable)
    cleanupArtifacts();

    // Step 4: Stop backend if needed
    await stopBackendIfNeeded();

    // Step 5: Print final summary (after pruning, so it reports surviving evidence)
    printFinalSummary();

    console.log("\n✅ Global teardown completed successfully!\n");
  } catch (error) {
    console.error("\n⚠️  Global teardown encountered issues (non-critical):");
    console.error(error instanceof Error ? error.message : String(error));
    console.log("");
    // Don't exit with error - tests already ran
  }
}

export default globalTeardown;
