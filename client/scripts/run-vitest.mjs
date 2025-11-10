#!/usr/bin/env node

import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
process.env.ROLLUP_SKIP_NODE_JS_NATIVE = process.env.ROLLUP_SKIP_NODE_JS_NATIVE || "1";

const args = process.argv.slice(2);
const vitestArgs = args.length > 0 ? args : ["run"];

const child = spawn("vitest", vitestArgs, {
  stdio: "inherit",
  shell: isWindows,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
