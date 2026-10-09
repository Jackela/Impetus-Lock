import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import semver from "semver";

test("client package and lock support Node 22.13+ and 24.x while excluding other majors", () => {
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
  // R17's approved runtime contract: ^22.13.0 || ^24.0.0.
  const boundaries = [
    ["20.19.0", false],
    ["22.12.0", false],
    ["22.13.0", true],
    ["22.99.0", true],
    ["23.0.0", false],
    ["24.0.0", true],
    ["24.99.0", true],
    ["25.0.0", false],
  ];
  const declarations = [
    ["package.json", manifest.engines.node],
    ["package-lock.json", lock.packages[""].engines.node],
  ];

  assert.deepEqual(
    declarations.map(([file, range]) => ({
      file,
      versions: boundaries.map(([version]) => [version, semver.satisfies(version, range)]),
    })),
    declarations.map(([file]) => ({ file, versions: boundaries })),
    "Both public engine declarations must accept only the approved Node 22/24 boundaries"
  );
});

test("CI browser script honors the workflow API host used by the login cookie", () => {
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const workspace = mkdtempSync(join(tmpdir(), "impetus-e2e-host-"));
  try {
    const bin = join(workspace, "bin");
    mkdirSync(bin);
    writeFileSync(join(bin, "npx"), '#!/bin/sh\nprintf "API_HOST=%s\\n" "$VITE_API_URL"\n', {
      mode: 0o755,
    });
    writeFileSync(
      join(workspace, "package.json"),
      JSON.stringify({ scripts: { "test:e2e:ci": manifest.scripts["test:e2e:ci"] } })
    );
    const result = spawnSync("npm", ["run", "test:e2e:ci"], {
      cwd: workspace,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        VITE_API_URL: "http://localhost:8000",
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /API_HOST=http:\/\/localhost:8000/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
