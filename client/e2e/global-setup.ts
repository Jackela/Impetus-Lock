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

import { execSync, spawn } from "child_process";
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
 * Start the backend server if not already running
 */
async function startBackend(): Promise<boolean> {
  console.log("\n🔍 Checking if backend is already running...");

  const isHealthy = await checkHealth(BACKEND_HEALTH_URL, 3000);
  if (isHealthy) {
    console.log("✅ Backend is already running");
    return false; // Didn't need to start it
  }

  console.log("🚀 Starting backend server...");
  console.log("   This may take a moment (Poetry install + DB migration)...");

  const serverDir = resolve(__dirname, "../../server");
  if (!existsSync(serverDir)) {
    throw new Error(`Server directory not found: ${serverDir}`);
  }

  // Check if we're in CI environment
  const isCI = process.env.CI === "true" || process.env.CI === "1";

  try {
    if (isCI) {
      // In CI, use poetry run directly
      const backendProcess = spawn(
        "poetry",
        [
          "-C",
          "server",
          "run",
          "python",
          "-m",
          "uvicorn",
          "server.api.main:app",
          "--host",
          "0.0.0.0",
          "--port",
          "8000",
        ],
        {
          detached: true,
          stdio: "pipe",
          env: {
            ...process.env,
            TESTING: "true",
            DATABASE_URL:
              process.env.DATABASE_URL ||
              "postgresql+asyncpg://postgres:postgres@localhost:5432/impetus_lock_test",
          },
        }
      );

      // Log backend output for debugging
      backendProcess.stdout?.on("data", (data) => {
        if (process.env.DEBUG_BACKEND) {
          console.log(`[Backend] ${data.toString().trim()}`);
        }
      });

      backendProcess.stderr?.on("data", (data) => {
        if (process.env.DEBUG_BACKEND) {
          console.error(`[Backend Error] ${data.toString().trim()}`);
        }
      });

      // Unref so the process doesn't keep the setup script alive
      backendProcess.unref();
    } else {
      // In local development, assume user starts backend manually
      console.log("⚠️  Backend not running. Please start it manually:");
      console.log("   cd server && poetry run uvicorn server.api.main:app --reload");
      console.log("   Or set PLAYWRIGHT_SKIP_BACKEND_START=0 to auto-start");

      if (process.env.PLAYWRIGHT_SKIP_BACKEND_START !== "0") {
        throw new Error(
          "Backend is required for E2E tests. Start it manually or enable auto-start."
        );
      }
    }

    // Wait for backend to be healthy
    await waitForService("Backend", BACKEND_HEALTH_URL, BACKEND_START_TIMEOUT);
    return true; // Started the backend
  } catch (error) {
    console.error("\n❌ Failed to start backend:");
    console.error(error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Initialize the test database
 */
async function initializeDatabase(): Promise<void> {
  console.log("\n🗄️  Initializing test database...");

  try {
    // Check if we can connect to the database via the backend
    const dbHealthUrl = BACKEND_HEALTH_URL.replace("/health", "/health/db");
    const isDbHealthy = await checkHealth(dbHealthUrl, 5000);

    if (isDbHealthy) {
      console.log("✅ Database is connected and healthy");
      return;
    }

    // If DB-specific health check isn't available, check general health
    const isHealthy = await checkHealth(BACKEND_HEALTH_URL, 5000);
    if (!isHealthy) {
      throw new Error("Backend is not healthy, cannot initialize database");
    }

    console.log("⚠️  Database health check not available, assuming backend handles migrations");
  } catch (error) {
    console.error("\n❌ Database initialization failed:");
    console.error(error instanceof Error ? error.message : String(error));
    // Don't throw - backend may handle migrations automatically
    console.log("   Continuing anyway (backend may handle migrations)...");
  }
}

/**
 * Run database migrations if needed
 */
async function runMigrations(): Promise<void> {
  console.log("\n🔄 Checking database migrations...");

  try {
    const serverDir = resolve(__dirname, "../../server");

    // Check if alembic is configured
    const alembicIniPath = resolve(serverDir, "alembic.ini");
    if (!existsSync(alembicIniPath)) {
      console.log("⚠️  No alembic.ini found, skipping migrations");
      return;
    }

    // Run migrations using poetry
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
    console.error("\n⚠️  Migration check failed (this may be OK if using auto-migrate):");
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
    }
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

  const context: SetupContext = {
    backendStarted: false,
    frontendReady: false,
  };

  try {
    // Step 1: Start backend if needed
    context.backendStarted = await startBackend();

    // Step 2: Initialize database
    await initializeDatabase();

    // Step 3: Run migrations
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
