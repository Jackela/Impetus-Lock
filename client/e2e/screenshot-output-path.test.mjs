import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

// R21: inspect configuration only; never import or execute browser test bodies.
const captures = {
  "task-list-integration.spec.ts": [
    "ux-003-task-list-integration.png",
    "ux-003-task-list-hidden.png",
  ],
  "test-trigger-debug.spec.ts": ["trigger-debug.png"],
  "test-manual-trigger-click.spec.ts": ["manual-trigger-clicked.png"],
  "quick-check.spec.ts": ["phase5-quick-check.png"],
  "new-user-audit.spec.ts": [
    "01-first-load.png",
    "02-welcome-modal.png",
    "03-main-ui.png",
    "04-typing.png",
    "05-muse-mode.png",
    "06-after-stuck-button.png",
    "07-loki-mode.png",
    "08-help-reopened.png",
    "09-mobile-view.png",
  ],
};

test("routine evidence screenshots retain names and use testInfo.outputPath", () => {
  const violations = [];
  for (const [file, names] of Object.entries(captures)) {
    const source = ts.createSourceFile(
      file,
      readFileSync(new URL(file, import.meta.url), "utf8"),
      ts.ScriptTarget.Latest,
      true
    );
    const screenshots = [];
    const visit = (node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "screenshot"
      ) {
        screenshots.push(node);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    if (screenshots.length !== names.length) {
      violations.push(`${file}: expected ${names.length} retained screenshot calls`);
    }
    screenshots.forEach((call, index) => {
      const options = call.arguments[0];
      const properties = options && ts.isObjectLiteralExpression(options) ? options.properties : [];
      const property = (name) =>
        properties.find(
          (item) => ts.isPropertyAssignment(item) && item.name.getText(source) === name
        )?.initializer;
      const path = property("path");
      const fullPage = property("fullPage");
      const line = source.getLineAndCharacterOfPosition(call.getStart(source)).line + 1;
      const usesOutputPath =
        path &&
        ts.isCallExpression(path) &&
        path.expression.getText(source) === "testInfo.outputPath" &&
        path.arguments.length === 1 &&
        ts.isStringLiteralLike(path.arguments[0]) &&
        path.arguments[0].text === names[index];
      if (!usesOutputPath) {
        violations.push(
          `${file}:${line}: expected testInfo.outputPath("${names[index]}"), got ${path?.getText(source) ?? "no path"}`
        );
      }
      if (fullPage?.kind !== ts.SyntaxKind.TrueKeyword) {
        violations.push(`${file}:${line}: fullPage capture must remain enabled`);
      }
    });
  }
  assert.deepEqual(
    violations,
    [],
    "Runtime screenshots must stay outside tracked evidence directories"
  );
});
