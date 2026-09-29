import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { expect, test } from "vitest";

const criticalFiles = [
  "src/services/LockManager.ts",
  "src/components/Editor/TransactionFilter.ts",
  "src/services/ContentInjector.ts",
  "src/utils/prosemirror-helpers.ts",
  "src/utils/textRange.ts",
  "src/utils/editorMarkdown.ts",
];
const injectorFile = "src/services/ContentInjector.ts";
type Scenario = "undercovered" | "missing" | "unexecuted" | "exact-threshold" | "all-pass";
type Summary = Record<string, { lines: { pct: number } }>;

function runFixture(scenario: Scenario) {
  const clientDir = process.cwd();
  const fixtureDir = mkdtempSync(join(clientDir, ".r20-coverage-"));
  try {
    // Eight exercised statements and two optional unexecuted statements make
    // the exact-threshold fixture measure 80%, independently of the gate.
    const source = `export function operation() {
  let value = 0;
  value += 1;
  value += 1;
  value += 1;
  value += 1;
  value += 1;
  value += 1;
  return value;
}
`;
    const unused = `export function unused() {
  let value = 1;
  return value;
}
`;
    const imports: string[] = [];
    const checks: string[] = [];
    for (const [index, file] of criticalFiles.entries()) {
      if (file === injectorFile && scenario === "missing") continue;
      const path = join(fixtureDir, file);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, source + (scenario === "exact-threshold" ? unused : ""));
      if (file === injectorFile && scenario === "unexecuted") continue;
      imports.push(`import { operation as operation${index} } from "./${file}";`);
      checks.push(
        file === injectorFile && scenario === "undercovered"
          ? `expect(typeof operation${index}).toBe("function");`
          : `expect(operation${index}()).toBe(6);`
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
      { cwd: clientDir, encoding: "utf8", timeout: 45000 }
    );
    const output = result.stdout + result.stderr;
    console.info(output);
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(output).toMatch(/\b1 passed\b/);
    const summary: Summary = JSON.parse(
      readFileSync(join(fixtureDir, "coverage/coverage-summary.json"), "utf8")
    );
    return { status: result.status, summary, output };
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
}

function fileLines(summary: Summary, file: string) {
  return Object.entries(summary).find(([path]) => path.endsWith(`/${file}`))?.[1].lines.pct;
}

test("coverage gate rejects one undercovered critical file even when total lines exceed 80%", () => {
  const { status, summary } = runFixture("undercovered");
  for (const file of criticalFiles) expect(fileLines(summary, file)).toBeDefined();
  expect(summary.total?.lines.pct).toBeGreaterThanOrEqual(80);
  expect(fileLines(summary, injectorFile)).toBeLessThan(80);
  expect(status, "an undercovered critical file must fail the coverage gate").toBe(1);
}, 60000);

test("coverage gate rejects a missing expected critical file in the resolved fixture root", () => {
  const { status, summary, output } = runFixture("missing");
  expect(summary.total?.lines.pct).toBe(100);
  expect(fileLines(summary, injectorFile)).toBeUndefined();
  expect(status, "a missing expected file must fail the production gate").toBe(1);
  expect(output).toContain("Missing critical coverage: src/services/ContentInjector.ts");
}, 60000);

test("coverage gate rejects an expected file that no test imports or executes", () => {
  const { status, summary } = runFixture("unexecuted");
  expect(summary.total?.lines.pct).toBeGreaterThanOrEqual(80);
  expect(fileLines(summary, injectorFile)).toBe(0);
  expect(status).toBe(1);
}, 60000);

test("coverage gate accepts every critical file at exactly 80% lines", () => {
  const { status, summary } = runFixture("exact-threshold");
  for (const file of criticalFiles) expect(fileLines(summary, file)).toBe(80);
  expect(status).toBe(0);
}, 60000);

test("coverage gate accepts all six fully covered critical files", () => {
  const { status, summary } = runFixture("all-pass");
  for (const file of criticalFiles) expect(fileLines(summary, file)).toBe(100);
  expect(status).toBe(0);
}, 60000);
