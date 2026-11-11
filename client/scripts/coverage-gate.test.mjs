#!/usr/bin/env node
/**
 * Coverage-gate contract tests.
 *
 * These used to live in `tests/coverage-gate.test.ts` and therefore ran inside
 * the Vitest suite, where each case spawned a *complete* Vitest + coverage run
 * (8-15s per case, five cases). The gate itself is plain Node tooling, so the
 * contract is exercised with `node:test` instead: same fixtures, same
 * assertions, zero overlap with the unit-test pool.
 *
 * Run with: npm run test:coverage-gate
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { stripVTControlCharacters } from "node:util";

const criticalFiles = [
  "src/services/LockManager.ts",
  "src/components/Editor/TransactionFilter.ts",
  "src/services/ContentInjector.ts",
  "src/utils/prosemirror-helpers.ts",
  "src/utils/textRange.ts",
  "src/utils/editorMarkdown.ts",
];
const injectorFile = "src/services/ContentInjector.ts";

/**
 * Build a throwaway *client-like* project, run the real production config
 * against it and report the gate's verdict.
 *
 * @param {"undercovered" | "missing" | "unexecuted" | "exact-threshold" | "all-pass"} scenario
 *   Which critical-file inventory the fixture presents to the gate.
 * @returns {{status: number | null, summary: Record<string, {lines: {pct: number}}>, output: string}}
 *   The child process exit status, the generated json-summary and its output.
 */
function runFixture(scenario) {
  const clientDir = process.cwd();
  const fixtureDir = mkdtempSync(join(clientDir, ".r20-coverage-"));
  try {
    // Eight exercised statements spread over three functions, plus two optional
    // unexecuted statements in a fourth function. That makes the
    // exact-threshold fixture measure exactly 80% lines per critical file while
    // keeping the tree-wide function ratio at 75% — the production config's
    // tree thresholds are inherited unchanged, so the fixture has to satisfy
    // every dimension of the real gate, not just the per-file line floor.
    const source = `export function operation() {
  let value = 0;
  value += 1;
  return value;
}

export function operation2() {
  let value = 0;
  value += 1;
  return value;
}

export function operation3() {
  let value = 0;
  return value;
}
`;
    const unused = `export function unused() {
  let value = 1;
  return value;
}
`;
    const imports = [];
    const checks = [];
    for (const [index, file] of criticalFiles.entries()) {
      if (file === injectorFile && scenario === "missing") continue;
      const path = join(fixtureDir, file);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, source + (scenario === "exact-threshold" ? unused : ""));
      if (file === injectorFile && scenario === "unexecuted") continue;
      imports.push(
        `import { operation as operation${index}, operation2 as operation2_${index}, operation3 as operation3_${index} } from "./${file}";`
      );
      checks.push(
        file === injectorFile && scenario === "undercovered"
          ? `expect(typeof operation${index}).toBe("function"); expect(typeof operation2_${index}).toBe("function"); expect(typeof operation3_${index}).toBe("function");`
          : `expect(operation${index}()).toBe(1); expect(operation2_${index}()).toBe(1); expect(operation3_${index}()).toBe(0);`
      );
    }
    writeFileSync(
      join(fixtureDir, "coverage.fixture.test.ts"),
      `${imports.join("\n")}\ntest("exercise critical files", () => { ${checks.join("\n")} });\n`
    );
    // Inherit the production inventory reporter, includes and thresholds.
    // Its onInit must use this fixture root, rather than the real client root.
    writeFileSync(
      join(fixtureDir, "vitest.config.ts"),
      `import base from ${JSON.stringify(join(clientDir, "vitest.config.ts"))};
export default {
  ...base,
  root: ${JSON.stringify(fixtureDir)},
  cacheDir: ${JSON.stringify(join(fixtureDir, ".vite"))},
  plugins: [],
  test: {
    ...base.test,
    environment: "node", setupFiles: [], maxWorkers: 1,
    include: ["coverage.fixture.test.ts"],
    coverage: {
      ...base.test.coverage,
      reporter: ["text", "json-summary"],
      reportsDirectory: ${JSON.stringify(join(fixtureDir, "coverage"))}
    }
  }
};\n`
    );
    const result = spawnSync(
      process.execPath,
      [
        join(clientDir, "scripts/run-vitest.mjs"),
        "run",
        "--config",
        join(fixtureDir, "vitest.config.ts"),
        "--coverage",
      ],
      { cwd: clientDir, encoding: "utf8", timeout: 60000 }
    );
    const output = stripVTControlCharacters(result.stdout + result.stderr);
    if (result.error || result.signal || !/\b1 passed\b/.test(output)) {
      // Surface the fixture run whenever it did not complete normally.
      console.error(output);
    }
    assert.equal(result.error, undefined, "the fixture Vitest run must not fail to spawn");
    assert.equal(result.signal, null, "the fixture Vitest run must not be killed");
    assert.match(output, /\b1 passed\b/, "the fixture test must run and pass");
    const summary = JSON.parse(
      readFileSync(join(fixtureDir, "coverage/coverage-summary.json"), "utf8")
    );
    return { status: result.status, summary, output };
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
}

/**
 * Look up a single file's line coverage in the json-summary report.
 *
 * @param {Record<string, {lines: {pct: number}}>} summary - Parsed json-summary.
 * @param {string} file - Client-relative file path.
 * @returns {number | undefined} The line percentage, or `undefined` when absent.
 */
function fileLines(summary, file) {
  return Object.entries(summary).find(([path]) => path.endsWith(`/${file}`))?.[1].lines.pct;
}

test("coverage gate rejects one undercovered critical file even when total lines exceed 80%", () => {
  const { status, summary, output } = runFixture("undercovered");
  for (const file of criticalFiles) assert.notEqual(fileLines(summary, file), undefined);
  assert.ok(summary.total.lines.pct >= 80, "the fixture total must exceed the per-file floor");
  assert.ok(
    fileLines(summary, injectorFile) < 80,
    "the injector fixture must stay below the per-file floor"
  );
  assert.ok(
    output.includes(injectorFile),
    "the per-file critical threshold must be what rejects the injector"
  );
  assert.equal(status, 1, "an undercovered critical file must fail the coverage gate");
});

test("coverage gate rejects a missing expected critical file in the resolved fixture root", () => {
  const { status, summary, output } = runFixture("missing");
  assert.equal(summary.total.lines.pct, 100);
  assert.equal(fileLines(summary, injectorFile), undefined);
  assert.equal(status, 1, "a missing expected file must fail the production gate");
  assert.ok(
    output.includes("Missing critical coverage: src/services/ContentInjector.ts"),
    "the gate must name the missing critical file"
  );
});

test("coverage gate rejects an expected file that no test imports or executes", () => {
  const { status, summary } = runFixture("unexecuted");
  assert.ok(summary.total.lines.pct >= 80);
  assert.equal(fileLines(summary, injectorFile), 0);
  assert.equal(status, 1);
});

test("coverage gate accepts every critical file at exactly 80% lines", () => {
  const { status, summary } = runFixture("exact-threshold");
  for (const file of criticalFiles) assert.equal(fileLines(summary, file), 80);
  assert.equal(status, 0);
});

test("coverage gate accepts all six fully covered critical files", () => {
  const { status, summary } = runFixture("all-pass");
  for (const file of criticalFiles) assert.equal(fileLines(summary, file), 100);
  assert.equal(status, 0);
});
