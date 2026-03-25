/**
 * Enhanced Playwright Test Fixtures
 *
 * Provides global test setup/teardown with:
 * - Automatic localStorage/sessionStorage cleanup
 * - Welcome modal suppression
 * - Database state management
 * - Test data cleanup helpers
 *
 * Constitutional Compliance:
 * - Article I (Simplicity): Clear, focused fixture definitions
 * - Article V (Documentation): Comprehensive JSDoc comments
 */

import { test as base, expect, type Page, type BrowserContext } from "@playwright/test";

// Storage keys for cleanup
const STORAGE_KEYS_TO_CLEAN = [
  "impetus-lock-welcome-dismissed",
  "impetus.llmConfig",
  "impetus.llmEncryptedKey",
  "impetus.editorState",
  "impetus.userPreferences",
];

/**
 * Extended test fixtures interface
 */
interface TestFixtures {
  /** Page with automatic cleanup and welcome modal suppression */
  page: Page;

  /** Authenticated page fixture (if auth is implemented) */
  authenticatedPage: Page;

  /** Database state manager */
  databaseState: DatabaseStateHelper;

  /** Test data cleanup helper */
  cleanup: CleanupHelper;

  /** Browser context with common settings */
  context: BrowserContext;
}

/**
 * Database state management helper
 */
interface DatabaseStateHelper {
  /** Reset database to clean state */
  reset: () => Promise<void>;

  /** Seed test data */
  seed: (data: TestDataSeed) => Promise<void>;

  /** Verify database state */
  verify: (check: StateCheck) => Promise<boolean>;
}

/**
 * Cleanup helper interface
 */
interface CleanupHelper {
  /** Register cleanup function to run after test */
  add: (cleanupFn: () => Promise<void> | void) => void;

  /** Run all registered cleanup functions */
  run: () => Promise<void>;

  /** Clear all storage (localStorage + sessionStorage) */
  clearStorage: (page: Page) => Promise<void>;
}

/**
 * Test data seed interface
 */
interface TestDataSeed {
  tasks?: Array<{
    id?: string;
    content: string;
    status?: string;
  }>;
  styles?: Array<{
    id?: string;
    name: string;
    content: string;
  }>;
  settings?: Record<string, unknown>;
}

/**
 * State check interface
 */
interface StateCheck {
  table: string;
  condition?: Record<string, unknown>;
  expectedCount?: number;
}

/**
 * Suppress welcome modal by setting localStorage before page load
 */
async function suppressWelcomeModal(page: Page): Promise<void> {
  await page.addInitScript((key: string) => {
    window.localStorage.setItem(key, "true");
  }, "impetus-lock-welcome-dismissed");
}

/**
 * Clear all test-related storage
 */
async function clearAllStorage(page: Page): Promise<void> {
  await page.evaluate((keys: string[]) => {
    keys.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
  }, STORAGE_KEYS_TO_CLEAN);

  // Also clear any other impetus-related items
  await page.evaluate(() => {
    const clearStorage = (storage: Storage) => {
      const keysToRemove: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith("impetus.")) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => storage.removeItem(key));
    };

    clearStorage(localStorage);
    clearStorage(sessionStorage);
  });
}

/**
 * Wait for app to be fully ready
 */
async function waitForAppReady(page: Page, timeout = 30000): Promise<void> {
  // Wait for React to hydrate
  await page.waitForSelector(".app", { timeout });

  // Wait for app header
  await page.waitForSelector(".app-header", { timeout: 10000 });

  // Wait for editor to be ready
  const editorReady = page.getByTestId("editor-ready");
  await expect(editorReady).toBeVisible({ timeout: 15000 });
}

/**
 * Create cleanup helper
 */
function createCleanupHelper(): CleanupHelper {
  const cleanupFunctions: Array<() => Promise<void> | void> = [];

  return {
    add(cleanupFn) {
      cleanupFunctions.push(cleanupFn);
    },

    async run() {
      // Run cleanup functions in reverse order (LIFO)
      for (const fn of cleanupFunctions.reverse()) {
        try {
          await fn();
        } catch (error) {
          console.error("Cleanup function failed:", error);
        }
      }
      cleanupFunctions.length = 0; // Clear array
    },

    async clearStorage(page) {
      await clearAllStorage(page);
    },
  };
}

/**
 * Create database state helper
 */
function createDatabaseStateHelper(): DatabaseStateHelper {
  const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";

  return {
    async reset() {
      try {
        const response = await fetch(`${backendUrl}/test/reset-db`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok && response.status !== 404) {
          console.warn(`Database reset returned ${response.status}`);
        }
      } catch (error) {
        // Reset endpoint may not exist, that's OK
        console.warn("Database reset not available:", error);
      }
    },

    async seed(data: TestDataSeed) {
      try {
        if (data.tasks) {
          for (const task of data.tasks) {
            await fetch(`${backendUrl}/api/tasks`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(task),
            });
          }
        }

        if (data.styles) {
          for (const style of data.styles) {
            await fetch(`${backendUrl}/api/styles`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(style),
            });
          }
        }
      } catch (error) {
        console.warn("Database seeding not available:", error);
      }
    },

    async verify(check: StateCheck): Promise<boolean> {
      try {
        const params = new URLSearchParams();
        if (check.condition) {
          params.append("condition", JSON.stringify(check.condition));
        }

        const response = await fetch(`${backendUrl}/test/verify-db?${params}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(check),
        });

        if (response.ok) {
          const result = await response.json();
          return result.valid === true;
        }
        return false;
      } catch {
        return false;
      }
    },
  };
}

/**
 * Extended test fixture with enhanced capabilities
 */
/* eslint-disable react-hooks/rules-of-hooks -- Playwright fixtures use 'use' callback, not React hooks */
export const test = base.extend<TestFixtures>({
  /**
   * Enhanced page fixture with automatic cleanup and welcome modal suppression
   */
  page: async ({ page }, use) => {
    // Suppress welcome modal before any navigation
    await suppressWelcomeModal(page);

    // Navigate to app
    await page.goto("/");

    // Clear storage to ensure clean state
    await clearAllStorage(page);

    // Reload after clearing storage
    await page.reload();

    // Wait for app to be ready
    await waitForAppReady(page).catch((error) => {
      console.warn("App failed to become ready:", error);
    });

    // Use the prepared page
    await use(page);

    // Cleanup after test
    await clearAllStorage(page);
  },

  /**
   * Authenticated page fixture
   * Use this when tests require authentication
   */
  authenticatedPage: async ({ browser }, use) => {
    // Create new context with auth state if available
    const context = await browser.newContext({
      storageState: "./e2e/storage-state.json",
    });

    const page = await context.newPage();

    // Suppress welcome modal
    await suppressWelcomeModal(page);

    // Navigate and prepare
    await page.goto("/");
    await clearAllStorage(page);
    await page.reload();
    await waitForAppReady(page).catch(() => {
      // App may not require auth
    });

    await use(page);

    // Cleanup
    await clearAllStorage(page);
    await context.close();
  },

  /**
   * Database state helper for managing test data
   */
  databaseState: async ({}, use) => {
    const helper = createDatabaseStateHelper();
    await use(helper);
  },

  /**
   * Cleanup helper for test-specific cleanup
   */
  cleanup: async ({}, use) => {
    const helper = createCleanupHelper();
    await use(helper);
    // Run cleanup after test
    await helper.run();
  },

  /**
   * Enhanced browser context with common settings
   */
  context: async ({ context }, use) => {
    // Grant permissions for clipboard, notifications, etc.
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await use(context);
  },
});
/* eslint-enable react-hooks/rules-of-hooks */

/**
 * Re-export expect from Playwright
 */
export { expect };

/**
 * Helper function to run test with retries and better error messages
 */
export async function retryableTest(
  testFn: () => Promise<void>,
  options: { retries?: number; delayMs?: number } = {}
): Promise<void> {
  const { retries = 3, delayMs = 1000 } = options;
  let lastError: Error | undefined;

  for (let i = 0; i < retries; i++) {
    try {
      await testFn();
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

/**
 * Helper to wait for element with better error messages
 */
export async function waitForElement(
  page: Page,
  selector: string,
  options: { timeout?: number; state?: "visible" | "hidden" | "attached" | "detached" } = {}
): Promise<void> {
  const { timeout = 10000, state = "visible" } = options;

  try {
    await page.waitForSelector(selector, { state, timeout });
  } catch (error) {
    throw new Error(
      `Element "${selector}" did not become ${state} within ${timeout}ms. ` +
        `Current URL: ${page.url()}. ` +
        `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
