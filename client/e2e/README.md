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
- - Workers: 1 in CI, auto in local
- - Retries: 2 in CI, 1 in local
- - Reporters: list, html, json
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
- - Increase retries in CI
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
