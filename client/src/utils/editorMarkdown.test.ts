import { Editor, remarkCtx } from "@milkdown/core";
import { commonmark } from "@milkdown/preset-commonmark";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { preserveLockMarkers, restoreLockMarkers } from "./editorMarkdown";

describe("persisted lock marker encoding", () => {
  let editor: Editor;
  let parser: typeof remarkCtx._defaultValue;
  beforeAll(async () => {
    editor = await Editor.make().use(commonmark).create();
    parser = editor.action((ctx) => ctx.get(remarkCtx));
  });
  afterAll(async () => {
    await editor.destroy();
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
