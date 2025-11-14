#!/usr/bin/env node
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const host = process.env.PREVIEW_HOST || "127.0.0.1";
const port = process.env.PREVIEW_PORT || "4173";
const baseUrl = `http://${host}:${port}`;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: "inherit", shell: process.platform === "win32", ...options });
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
      const response = await fetch(url, { method: "HEAD" });
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

async function main() {
  await run("npm", ["run", "build"]);

  const preview = spawn(
    "npm",
    ["run", "preview", "--", "--host", host, "--port", port],
    { stdio: "inherit", shell: process.platform === "win32" }
  );

  const cleanExit = async (code) => {
    preview.kill("SIGTERM");
    process.exit(code);
  };

  preview.on("error", async (err) => {
    console.error("Preview server failed:", err);
    await cleanExit(1);
  });

  try {
    await waitForPreview(baseUrl);
    const env = {
      ...process.env,
      PLAYWRIGHT_BASE_URL: baseUrl,
      PLAYWRIGHT_SKIP_WEBSERVER: "1",
      VITE_API_URL: process.env.VITE_API_URL || "http://127.0.0.1:8000",
      CI: process.env.CI || "1",
    };
    await run("npx", ["playwright", "test"], { env });
    await cleanExit(0);
  } catch (error) {
    console.error(error);
    await cleanExit(1);
  }
}

main();
