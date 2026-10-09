import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
