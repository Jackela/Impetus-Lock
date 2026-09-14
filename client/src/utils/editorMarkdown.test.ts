import { describe, expect, it } from "vitest";
import { preserveLockMarkers, restoreLockMarkers } from "./editorMarkdown";

describe("persisted lock marker encoding", () => {
  it("escapes only lock comments for Milkdown parsing, including legacy markers", () => {
    expect(preserveLockMarkers("# Title\n<!-- ordinary -->\n<!-- lock:legacy_1 -->")).toBe(
      "# Title\n<!-- ordinary -->\n\\<!-- lock:legacy_1 -->"
    );
  });

  it("restores lock IDs and sources without unescaping ordinary Markdown", () => {
    expect(restoreLockMarkers("\\*literal\\* \\<!-- lock:lock\\_1 source:muse -->")).toBe(
      "\\*literal\\* <!-- lock:lock_1 source:muse -->"
    );
  });
});
