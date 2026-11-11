/\*\*

- E2E Test Configuration Documentation
-
- This directory contains comprehensive E2E test setup for the Impetus Lock project.
-
- STRUCTURE:
- - fixtures.ts: Enhanced test fixtures with automatic cleanup and setup
- - global-setup.ts: Runs once before all tests to prepare environment
- - global-teardown.ts: Runs once after all tests to cleanup
- - helpers/: Helper functions for database, waiting, and interventions
- - \*.spec.ts: Test files
-
- CONFIGURATION:
- - playwright.config.ts: Main Playwright configuration
- - Timeout: 60s global, 10s expect
- - Workers: 1 in CI, auto in local (do not parallelize until per-worker data isolation exists)
- - Retries: 1 in CI and in local. The CI value was lowered from 2 to 1 on purpose: a
- third attempt hides genuinely flaky tests. Keep it at 1 so flakiness stays visible.
- - Reporters: CI = list + html + json + junit (playwright-report/junit.xml);
- local = html (opens on failure)
- - Web server: `vite --strictPort`. Playwright fails fast if the port is taken instead
- of letting Vite shift to the next free port (all baseURL/API-origin assumptions
- would then point at a server the tests never reach).
- - testIgnore includes `**/*.test.mjs` so Node test-runner guards
- (e.g. screenshot-output-path.test.mjs) are not imported as Playwright specs.
-
- USAGE:
-
- 1.  Run all tests:
- npm run test:e2e
-
- 2.  Run in CI mode:
- npm run test:e2e:ci
-
- 3.  Run with UI:
- npx playwright test --ui
-
- 4.  Run specific test:
- npx playwright test smoke.spec.ts
-
- 5.  Run with headed browser:
- npx playwright test --headed
-
- 6.  Debug mode:
- DEBUG=1 npx playwright test
-
- BEST PRACTICES:
-
- 1.  Use the enhanced fixtures:
- ```typescript

  ```

- import { test, expect } from "./fixtures";
-
- test("example", async ({ page, cleanup }) => {
-      // Page is already prepared with clean state
-      // Welcome modal is suppressed
-      // localStorage is cleared
- });
- ```

  ```

-
- 2.  Avoid waitForTimeout, use proper waiting:
- ```typescript

  ```

- // Bad:
- await page.waitForTimeout(1000);
-
- // Good:
- await page.waitForSelector('[data-testid="element"]', { state: 'visible' });
- await expect(page.locator('.element')).toBeVisible();
- ```

  ```

-
- 3.  Use database helpers for test data:
- ```typescript

  ```

- import { resetDatabase, seedTestData } from "./helpers/database";
-
- test.beforeEach(async ({ request }) => {
-      await resetDatabase(request);
-      await seedTestData(request, {
-        tasks: [{ content: "Test task" }]
-      });
- });
- ```

  ```

-
- 4.  Clean up after tests:
- ```typescript

  ```

- test.afterEach(async ({ page }) => {
-      await page.evaluate(() => localStorage.clear());
- });
- ```

  ```

-
- 5.  Add data-testid attributes for reliable selection:
- ```tsx

  ```

- <button data-testid="submit-button">Submit</button>
- ```

  ```

-
- ENVIRONMENT VARIABLES:
-
- - CI: Set to "true" or "1" for CI mode
- - PLAYWRIGHT_BASE_URL: Override base URL (default: http://localhost:5173)
- - PLAYWRIGHT_SKIP_WEBSERVER: Set to "1" to skip starting dev server
- - BACKEND_HEALTH_URL: Backend health endpoint (default: http://localhost:8000/health)
- - DEBUG: Set to "1" for verbose output
- - DEBUG_BACKEND: Set to "1" to see backend logs
- - PLAYWRIGHT_ARTIFACT_MAX_AGE_DAYS: Age threshold (days, default 7) for pruning
- stale `test-results/<test>/` directories. Current-run evidence is never deleted.

- FAILURE EVIDENCE (do not break this):

- - `client/test-results/<test-slug>/` holds `trace.zip`, `error-context.md`,
- screenshots and videos for failing tests.
- - global-teardown.ts only removes artifact directories older than
- PLAYWRIGHT_ARTIFACT_MAX_AGE_DAYS (default 7, by mtime). It must never delete the
- artifacts of the run that just finished — that is the only failure evidence CI has.
- - The teardown summary also lists the retained trace/error-context paths.
- - View a trace with: npx playwright show-trace test-results/<slug>/trace.zip

- KNOWN-BROKEN TESTS:

- - Tests for unimplemented features use `test.fixme(true, "T066 ...")` inside the test
- body, not `test.skip`. fixme surfaces them as known-broken instead of silently
- skipped, and the body does not execute while the guard is active.
- - Removing a fixme is only valid once the feature is actually implemented; never
- convert one into a passing assertion just to clear the report.
-
- TROUBLESHOOTING:
-
- 1.  Tests failing in CI but passing locally:
- - Check if timeouts need adjustment
- - Verify backend is running before tests
- - Check for race conditions
-
- 2.  Flaky tests:
- - Add proper waiting strategies
- - Use data-testid attributes
- - Do NOT raise retries. CI retries are capped at 1 so flaky specs stay visible;
- a spec that only passes on the retry must be fixed, not re-hidden.
-
- 3.  Backend not starting:
- - Check DATABASE_URL is set
- - Verify poetry is installed
- - Run backend manually: cd server && poetry run uvicorn server.api.main:app
-
- 4.  Frontend not loading:
- - Check VITE_API_URL is set correctly
- - Verify npm dependencies are installed
- - Try running manually: cd client && npm run dev
    \*/

// This file is for documentation purposes only
export {};
