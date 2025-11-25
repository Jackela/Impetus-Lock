#!/usr/bin/env node
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { createServer } from "node:net";

const host = process.env.PREVIEW_HOST || "127.0.0.1";
const port = process.env.PREVIEW_PORT || "4173";
const baseUrl = `http://${host}:${port}`;
const PREVIEW_READY_TIMEOUT_MS = Number(process.env.PREVIEW_READY_TIMEOUT_MS || 60000);
const PREVIEW_E2E_TIMEOUT_MS = Number(process.env.PREVIEW_E2E_TIMEOUT_MS || 600000);

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      ...options,
    });
    proc.on("exit", (code) => {
      if (code === 0) {
        resolve(undefined);
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
      }
    });
    proc.on("error", reject);
  });
}

async function waitForPreview(url, attempts = 40, interval = 500) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const controller = new AbortController();
      const abortTimeout = setTimeout(() => controller.abort(), 2000);
      const response = await fetch(url, { method: "HEAD", signal: controller.signal });
      clearTimeout(abortTimeout);
      if (response.ok) {
        return;
      }
    } catch {
      // ignore until preview is ready
    }
    await delay(interval);
  }
  throw new Error(`Timed out waiting for preview server at ${url}`);
}

async function assertPortFree(hostname, portNumber) {
  await new Promise((resolve, reject) => {
    const server = createServer()
      .once("error", reject)
      .once("listening", () => {
        server.close(resolve);
      })
      .listen(portNumber, hostname);
  }).catch((error) => {
    if (error && error.code === "EADDRINUSE") {
      throw new Error(
        `Port ${portNumber} is already in use on ${hostname}. Stop the process holding it or set PREVIEW_PORT.`
      );
    }
    throw error;
  });
}

async function main() {
  const testArgs = process.argv.slice(2);
  console.log("[preview-e2e] Building client bundle...");
  await run("npm", ["run", "build"]);
  console.log("[preview-e2e] Build completed.");

  await assertPortFree(host, port);

  console.log(`[preview-e2e] Starting preview server on ${baseUrl} ...`);
  const previewArgs = ["run", "preview", "--", "--host", host, "--port", port, "--strictPort"];
  const preview = spawn("npm", previewArgs, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  const killPreview = () => {
    if (!preview.killed) {
      preview.kill("SIGTERM");
    }
  };

  const cleanExit = async (code) => {
    killPreview();
    process.exit(code);
  };

  const overallTimeout = setTimeout(() => {
    console.error(
      `[preview-e2e] Timed out after ${Math.round(PREVIEW_E2E_TIMEOUT_MS / 1000)}s. Check preview server logs.`
    );
    void cleanExit(1);
  }, PREVIEW_E2E_TIMEOUT_MS);

  preview.on("error", async (err) => {
    console.error("Preview server failed:", err);
    await cleanExit(1);
  });
  preview.on("exit", async (code) => {
    if (code !== 0) {
      console.error(`[preview-e2e] Preview server exited early with code ${code}`);
      await cleanExit(code);
    }
  });

  try {
    console.log("[preview-e2e] Waiting for preview server to become available...");
    const maxAttempts = Math.ceil(PREVIEW_READY_TIMEOUT_MS / 500);
    await waitForPreview(baseUrl, maxAttempts, 500);
    console.log(
      "[preview-e2e] Preview server is ready. Running Playwright against production bundle..."
    );
    const env = {
      ...process.env,
      PLAYWRIGHT_BASE_URL: baseUrl,
      PLAYWRIGHT_SKIP_WEBSERVER: "1",
      VITE_API_URL: process.env.VITE_API_URL || "http://127.0.0.1:8000",
      CI: process.env.CI || "1",
    };
    const playwrightArgs = ["playwright", "test", ...testArgs];
    await run("npx", playwrightArgs, { env });
    console.log("[preview-e2e] Playwright run completed.");
    clearTimeout(overallTimeout);
    await cleanExit(0);
  } catch (error) {
    console.error(error);
    await cleanExit(1);
  }
}

main();
