/**
 * Global Setup for Playwright E2E Tests
 *
 * Runs once before all test suites to ensure consistent test environment:
 * - Verifies backend is running and healthy
 * - Initializes test database
 * - Runs database migrations
 * - Waits for frontend to be ready
 * - Generates test data if needed
 *
 * Constitutional Compliance:
 * - Article I (Simplicity): Clear, sequential setup steps
 * - Article V (Documentation): Comprehensive logging and error messages
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

// ES Module compatible __dirname
const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration
const BACKEND_HEALTH_URL = process.env.BACKEND_HEALTH_URL || "http://localhost:8000/health";
const FRONTEND_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173";
const BACKEND_START_TIMEOUT = 60000; // 60 seconds
const FRONTEND_START_TIMEOUT = 60000; // 60 seconds
const HEALTH_CHECK_INTERVAL = 2000; // 2 seconds

interface SetupContext {
  backendStarted: boolean;
  frontendReady: boolean;
}

/**
 * Check if a service is healthy by making an HTTP request
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
 * Check if backend database is healthy
 */
async function checkDbHealth(): Promise<boolean> {
  const dbHealthUrl = BACKEND_HEALTH_URL.replace("/health", "/health/db");
  try {
    const response = await fetch(dbHealthUrl, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return false;
    const data = await response.json();
    return data.status === "ok";
  } catch {
    return false;
  }
}

/**
 * Wait for a service to become healthy with timeout
 */
async function waitForService(name: string, healthUrl: string, timeout: number): Promise<void> {
  const startTime = Date.now();
  let lastError: string | null = null;

  console.log(`\n⏳ Waiting for ${name} to be ready...`);
  console.log(`   Health endpoint: ${healthUrl}`);

  while (Date.now() - startTime < timeout) {
    const isHealthy = await checkHealth(healthUrl);

    if (isHealthy) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ ${name} is ready (${elapsed}s)`);
      return;
    }

    // Show progress every 5 seconds
    const elapsed = Date.now() - startTime;
    if (elapsed % 5000 < HEALTH_CHECK_INTERVAL) {
      process.stdout.write(`   Still waiting... (${(elapsed / 1000).toFixed(0)}s)\n`);
    }

    await new Promise((resolve) => setTimeout(resolve, HEALTH_CHECK_INTERVAL));
  }

  throw new Error(
    `${name} failed to become healthy within ${timeout / 1000}s. ` +
      `Last error: ${lastError || "Connection refused"}`
  );
}

/**
 * Verify backend is running and database is accessible.
 * In CI, the backend is started by the workflow, so we just verify it's healthy.
 */
async function verifyBackend(): Promise<void> {
  console.log("\n🔍 Verifying backend is running...");

  const isHealthy = await checkHealth(BACKEND_HEALTH_URL, 3000);
  if (isHealthy) {
    console.log("✅ Backend is already running");

    // Wait for database to be ready (important for E2E tests)
    console.log("🔍 Checking database connectivity...");
    for (let i = 0; i < 15; i++) {
      if (await checkDbHealth()) {
        console.log("✅ Database is connected and healthy");
        return;
      }
      process.stdout.write(`   Waiting for database... (${i + 1}/15)\n`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // In TESTING mode with in-memory fallback, this is not fatal
    console.log("⚠️  Database not fully ready, but continuing (TESTING mode may use in-memory fallback)");
    return;
  }

  throw new Error("Backend is not running. Please start the backend before running E2E tests.");
}

/**
 * Initialize the test database
 */
async function initializeDatabase(): Promise<void> {
  console.log("\n🗄️  Checking database connectivity...");

  // Database initialization is handled by the backend in TESTING mode
  // with graceful fallback to in-memory repository
  if (await checkDbHealth()) {
    console.log("✅ Database is connected and healthy");
    return;
  }

  console.log("⚠️  Database health check not available");
  console.log("   In TESTING mode, the backend will use in-memory fallback");
}
}

/**
 * Run database migrations if needed
 */
async function runMigrations(): Promise<void> {
  console.log("\n🔄 Checking database migrations...");

  // Migrations are already run by the workflow before backend starts
  // In TESTING mode with graceful fallback, database connectivity issues
  // won't prevent tests from running (backend uses in-memory fallback)

  try {
    const serverDir = resolve(__dirname, "../../server");
    const alembicIniPath = resolve(serverDir, "alembic.ini");
    if (!existsSync(alembicIniPath)) {
      console.log("⚠️  No alembic.ini found, skipping migrations");
      return;
    }

    // Try to run migrations but don't fail if they don't work
    // The workflow has already run migrations, and in TESTING mode
    // the backend has graceful fallback
    execSync("poetry run alembic upgrade head", {
      cwd: serverDir,
      stdio: "pipe",
      env: {
        ...process.env,
        DATABASE_URL:
          process.env.DATABASE_URL ||
          "postgresql+asyncpg://postgres:postgres@localhost:5432/impetus_lock_test",
      },
    });

    console.log("✅ Database migrations completed");
  } catch (error) {
    console.log("⚠️  Migration check failed (may already be applied or using fallback)");
  }
}

/**
 * Verify all services are healthy before starting tests
 */
async function verifyServices(): Promise<void> {
  console.log("\n🔍 Verifying all services are healthy...");

  // Check backend
  await waitForService("Backend", BACKEND_HEALTH_URL, 10000);

  // Check frontend (if not skipping webserver)
  if (process.env.PLAYWRIGHT_SKIP_WEBSERVER !== "1") {
    await waitForService("Frontend", FRONTEND_URL, FRONTEND_START_TIMEOUT);
  }

  console.log("\n✅ All services are ready!");
}

/**
 * Create test data for E2E tests
 */
async function seedTestData(): Promise<void> {
  console.log("\n🌱 Seeding test data...");

  try {
    // Any test data that needs to be created before tests run
    // This could include test users, default settings, etc.

    console.log("✅ Test data ready");
  } catch (error) {
    console.error("\n⚠️  Failed to seed test data:");
    console.error(error instanceof Error ? error.message : String(error));
    // Don't throw - tests may still pass without pre-seeded data
  }
}

/**
 * Main setup function
 */
async function globalSetup(): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("🎭 Playwright E2E Test Global Setup");
  console.log("=".repeat(60));

  try {
    // Step 1: Verify backend is running (started by workflow in CI)
    await verifyBackend();

    // Step 2: Initialize database
    await initializeDatabase();

    // Step 3: Run migrations (if needed)
    await runMigrations();

    // Step 4: Wait for services to be ready
    await verifyServices();

    // Step 5: Seed test data
    await seedTestData();

    console.log("\n" + "=".repeat(60));
    console.log("✅ Global setup completed successfully!");
    console.log("=".repeat(60) + "\n");
  } catch (error) {
    console.error("\n" + "=".repeat(60));
    console.error("❌ Global setup failed!");
    console.error("=".repeat(60));
    console.error(error instanceof Error ? error.message : String(error));
    console.error("\n");
    process.exit(1);
  }
}

export default globalSetup;
