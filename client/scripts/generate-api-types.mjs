#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import openapiTS, { astToString, COMMENT_HEADER } from "openapi-typescript";
import prettier from "prettier";

// Reproducible offline generation: imports the app without starting its lifespan,
// disables dotenv/test routes, and never starts a server or calls a provider.
// The exact generator version is pinned in package.json and package-lock.json.
const clientDir = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const check = args.includes("--check");
const outputIndex = args.indexOf("--output");
const output =
  outputIndex === -1
    ? resolve(clientDir, "src/types/api.generated.ts")
    : resolve(clientDir, args[outputIndex + 1]);
const result = spawnSync(
  "poetry",
  [
    "run",
    "python",
    "-c",
    `import json, os
os.environ.pop("TESTING", None)
from server.api.main import app
print(json.dumps(app.openapi(), sort_keys=True))`,
  ],
  {
    cwd: resolve(clientDir, "../server"),
    env: { ...process.env, PYTHON_DOTENV_DISABLED: "1", ENV: "development", LOG_LEVEL: "ERROR" },
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  }
);
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(result.stderr || "OpenAPI export failed");
const schema = JSON.parse(result.stdout);
const schemas = schema.components.schemas;
// Preserve existing components["schemas"]["Anchor"] consumers using the actual
// response union. No API path, payload field or server schema is changed.
schemas.Anchor = structuredClone(schemas.InterventionResponse.properties.anchor);
const generated = await prettier.format(
  COMMENT_HEADER +
    "// Generator: openapi-typescript 7.13.0; source: offline FastAPI app.openapi().\n" +
    "// Regenerate: npm run api:generate; verify drift: npm run api:check.\n\n" +
    astToString(await openapiTS(schema, { defaultNonNullable: false })),
  { ...(await prettier.resolveConfig(output)), parser: "typescript" }
);

if (check) {
  let current;
  try {
    current = readFileSync(output, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (current !== generated) {
    console.error("API types have drifted. Run npm run api:generate.");
    process.exitCode = 1;
  } else {
    console.log("API types match the offline FastAPI schema (openapi-typescript 7.13.0).");
  }
} else {
  writeFileSync(output, generated);
  console.log(`Generated API types: ${output}`);
}
