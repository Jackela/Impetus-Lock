import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import semver from "semver";

test("root and client package metadata accepts the supported Node 22, 24 and 26 ranges", () => {
  const boundaries = [
    ["20.19.0", false],
    ["22.22.0", false],
    ["22.22.1", true],
    ["22.99.0", true],
    ["23.0.0", false],
    ["24.0.0", true],
    ["24.99.0", true],
    ["25.0.0", false],
    ["26.0.0", true],
    ["26.99.0", true],
    ["27.0.0", false],
  ];

  for (const directory of ["../../", "../"]) {
    const manifest = JSON.parse(
      readFileSync(new URL(`${directory}package.json`, import.meta.url), "utf8")
    );
    const lock = JSON.parse(
      readFileSync(new URL(`${directory}package-lock.json`, import.meta.url), "utf8")
    );
    assert.equal(lock.packages[""].engines.node, manifest.engines.node, manifest.name);
    for (const [version, supported] of boundaries) {
      assert.equal(
        semver.satisfies(version, manifest.engines.node),
        supported,
        `${manifest.name}: ${version}`
      );
    }
  }
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
