import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import ts from "typescript";

test("generated components expose task metadata and required intervention response fields", () => {
  const fixture = fileURLToPath(new URL("./api-types.fixture.ts", import.meta.url));
  const source = `
    import type { components } from "../src/types/api.generated";
    type Task = components["schemas"]["TaskResponse"];
    declare const task: Task;
    const title: string = task.title;
    const category: string = task.category;
    const priority: string = task.priority;
    const dueDate: string | null = task.due_date;
    const wordCount: number = task.word_count;
    const create: components["schemas"]["TaskCreateRequest"] = { content: "A task" };
    declare const response: components["schemas"]["InterventionResponse"];
    const anchor: components["schemas"]["Anchor"] = response.anchor;
    const source: "muse" | "loki" = response.source;
    const issuedAt: string = response.issued_at;
    type RequiredFields = "anchor" | "source" | "issued_at";
    type AssertNever<T extends never> = T;
    type MissingRequiredFields = AssertNever<Exclude<RequiredFields,
      { [K in keyof typeof response]-?: {} extends Pick<typeof response, K>
          ? never : K }[keyof typeof response]>>;
  `;
  const options = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (file, languageVersion, ...args) =>
    file === fixture
      ? ts.createSourceFile(file, source, languageVersion, true)
      : getSourceFile(file, languageVersion, ...args);
  const program = ts.createProgram([fixture], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(
    diagnostics.length,
    0,
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (file) => file,
      getCurrentDirectory: () => process.cwd(),
      getNewLine: () => "\n",
    })
  );
});

test("offline schema check is deterministic and rejects drift without rewriting files", () => {
  const clientDir = fileURLToPath(new URL("../", import.meta.url));
  const scratch = fileURLToPath(new URL("../../.scratch/", import.meta.url));
  mkdirSync(scratch, { recursive: true });
  const tempDir = mkdtempSync(join(scratch, "r11-api-types-"));
  const output = join(tempDir, "api.generated.ts");
  const run = (...args) =>
    spawnSync(process.execPath, ["scripts/generate-api-types.mjs", ...args], {
      cwd: clientDir,
      encoding: "utf8",
      // The export must exclude test-only routes even in a test environment.
      env: { ...process.env, TESTING: "true" },
    });
  const assertSuccess = (result) => assert.equal(result.status, 0, result.stdout + result.stderr);
  try {
    assertSuccess(run("--check"));
    assertSuccess(run("--output", output));
    const generated = readFileSync(output, "utf8");
    assert.equal(generated, readFileSync(join(clientDir, "src/types/api.generated.ts"), "utf8"));
    assertSuccess(run("--check", "--output", output));
    const stale = generated.replace("issued_at: string;", "issued_at?: string;");
    assert.notEqual(stale, generated);
    writeFileSync(output, stale);
    const drift = run("--check", "--output", output);
    assert.equal(drift.status, 1, drift.stdout + drift.stderr);
    assert.match(drift.stderr, /API types have drifted/);
    assert.equal(readFileSync(output, "utf8"), stale);
    rmSync(output);
    const missing = run("--check", "--output", output);
    assert.equal(missing.status, 1, missing.stdout + missing.stderr);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
