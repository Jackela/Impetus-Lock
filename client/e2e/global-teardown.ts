/**
 * Global Teardown for Playwright E2E Tests
 *
 * Runs once after all test suites to clean up:
 * - Clean up test data from database
 * - Generate test reports
 * - Clean up temporary files
 * - Optional: Stop backend if we started it
 *
 * Constitutional Compliance:
 * - Article I (Simplicity): Clear cleanup steps
 * - Article V (Documentation): Comprehensive logging
 */

import { existsSync, readdirSync, statSync, unlinkSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

// ES Module compatible __dirname
const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration
const BACKEND_HEALTH_URL = process.env.BACKEND_HEALTH_URL || "http://localhost:8000/health";
const REPORT_DIR = resolve(__dirname, "../playwright-report");
const TEMP_DIRS = ["test-results", "playwright-results"];

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

    // Read and parse results
    const results = await import(resultsPath, { assert: { type: "json" } });
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
 * Clean up old test artifacts
 */
function cleanupArtifacts(): void {
  console.log("\n🗑️  Cleaning up test artifacts...");

  try {
    let cleanedCount = 0;

    // Clean up temporary directories
    for (const dirName of TEMP_DIRS) {
      const dirPath = resolve(__dirname, "../", dirName);
      if (existsSync(dirPath)) {
        const files = readdirSync(dirPath);
        for (const file of files) {
          const filePath = resolve(dirPath, file);
          try {
            const stats = statSync(filePath);
            if (stats.isDirectory()) {
              // Keep directory, just clean old files inside
              const subFiles = readdirSync(filePath);
              for (const subFile of subFiles) {
                const subFilePath = resolve(filePath, subFile);
                try {
                  unlinkSync(subFilePath);
                  cleanedCount++;
                } catch {
                  // Ignore errors for individual files
                }
              }
            }
          } catch {
            // Ignore errors
          }
        }
      }
    }

    if (cleanedCount > 0) {
      console.log(`   Cleaned up ${cleanedCount} old artifact files`);
    } else {
      console.log("   No artifacts to clean up");
    }
  } catch (error) {
    console.error("\n⚠️  Artifact cleanup failed (non-critical):");
    console.error(error instanceof Error ? error.message : String(error));
  }
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

  // Check if trace files exist
  const traceDir = resolve(__dirname, "../test-results");
  if (existsSync(traceDir)) {
    const traces = readdirSync(traceDir).filter((f) => f.endsWith(".zip"));
    if (traces.length > 0) {
      console.log("\n🔍 Trace files available for failed tests:");
      traces.forEach((trace) => {
        console.log(`   - ${trace}`);
      });
      console.log("\n   View trace: npx playwright show-trace <trace-file>");
    }
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

    // Step 3: Clean up artifacts
    cleanupArtifacts();

    // Step 4: Stop backend if needed
    await stopBackendIfNeeded();

    // Step 5: Print final summary
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
