import { Editor, parserCtx, remarkCtx } from "@milkdown/core";
import type { Node as ProseMirrorNode } from "@milkdown/prose/model";
import { commonmark } from "@milkdown/preset-commonmark";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { preserveLockMarkers, restoreLockMarkers, validateRecoveredLocks } from "./editorMarkdown";

describe("persisted lock marker encoding", () => {
  let editor: Editor;
  let parser: typeof remarkCtx._defaultValue;
  let parseDocument: (markdown: string) => ProseMirrorNode | null | undefined;
  beforeAll(async () => {
    editor = await Editor.make().use(commonmark).create();
    parser = editor.action((ctx) => ctx.get(remarkCtx));
    parseDocument = editor.action((ctx) => ctx.get(parserCtx));
  });
  afterAll(async () => {
    await editor.destroy();
  });

  it("recovers complete lock IDs from actual protected paragraphs when legacy metadata is incomplete", () => {
    const markdown =
      "Writer\n\n> Protected A <!-- lock:legacy_a -->\n\nProtected B <!-- lock:legacy_b source:loki -->";
    expect(validateRecoveredLocks(markdown, ["legacy_a"], parser, parseDocument)).toEqual([
      "legacy_a",
      "legacy_b",
    ]);
  });

  it.each([
    "Protected <!-- lock: -->",
    "Protected <!-- lock:broken",
    "Protected <!-- lock:broken source:unknown -->",
  ])("rejects damaged lock syntax without dropping the original marker: %s", (markdown) => {
    expect(() => validateRecoveredLocks(markdown, [], parser, parseDocument)).toThrow(/recovery/i);
  });

  it("does not accept a code literal as the protected position of a lost prose marker", () => {
    const markdown = "Literal `<!-- lock:shared_id -->`\n\nProtected <!-- lock:shared_id -->";
    const parserLosingProseMarker = (value: string) =>
      parseDocument(value.replace(/\\<!-- lock:shared_id -->/g, ""));
    expect(() =>
      validateRecoveredLocks(markdown, ["shared_id"], parser, parserLosingProseMarker)
    ).toThrow(/protected document position/i);
  });

  it("requires every prose marker to survive parsing even when lock IDs repeat", () => {
    const markdown =
      "Protected first <!-- lock:shared_id -->\n\nProtected second <!-- lock:shared_id -->";
    expect(validateRecoveredLocks(markdown, ["shared_id"], parser, parseDocument)).toEqual([
      "shared_id",
    ]);
    const parserLosingFirstMarker = (value: string) =>
      parseDocument(value.replace("\\<!-- lock:shared_id -->", ""));
    expect(() =>
      validateRecoveredLocks(markdown, ["shared_id"], parser, parserLosingFirstMarker)
    ).toThrow(/protected document position/i);
  });

  it("ignores inline, fenced, and indented code markers while rejecting metadata that claims them", () => {
    const markdown =
      "`<!-- lock:inline -->`\n\n```text\n<!-- lock:fenced -->\n```\n\n    <!-- lock:indented -->";
    expect(validateRecoveredLocks(markdown, [], parser, parseDocument)).toEqual([]);
    expect(() => validateRecoveredLocks(markdown, ["fenced"], parser, parseDocument)).toThrow(
      /protected document position/i
    );
  });

  it("rejects missing declared locks and failed document parsing", () => {
    expect(() => validateRecoveredLocks("Plain draft", ["missing"], parser, parseDocument)).toThrow(
      /protected document position/i
    );
    expect(() => validateRecoveredLocks("Plain draft", [], parser, () => null)).toThrow(
      /could not be parsed/i
    );
  });
  it("escapes only lock comments for Milkdown parsing, including legacy markers", () => {
    expect(preserveLockMarkers("# Title\n<!-- ordinary -->\n<!-- lock:legacy_1 -->", parser)).toBe(
      "# Title\n<!-- ordinary -->\n\\<!-- lock:legacy_1 -->"
    );
  });

  it("restores lock IDs and sources without unescaping ordinary Markdown", () => {
    expect(restoreLockMarkers("\\*literal\\* \\<!-- lock:lock\\_1 source:muse -->", parser)).toBe(
      "\\*literal\\* <!-- lock:lock_1 source:muse -->"
    );
  });
});
