import { afterEach, describe, expect, it } from "vitest";
import {
  discardLegacyDraft,
  inspectOwnedDrafts,
  exportLegacyDraft,
  listOwnedDrafts,
  readLegacyDraft,
  readOwnedDraft,
  writeOwnedDraft,
} from "./draftStore";

describe("owned draft storage", () => {
  afterEach(() => localStorage.clear());

  it("retains separate task snapshots and never exposes another account", () => {
    const first = {
      draftId: "first",
      content: "A unsaved",
      lockIds: ["lock-a"],
      taskId: "A",
      version: 2,
      versionKnown: true,
      dirty: true,
      updatedAt: 1,
    };
    writeOwnedDraft("alice", first);
    writeOwnedDraft("alice", {
      ...first,
      draftId: "second",
      content: "B unsaved",
      taskId: "B",
      updatedAt: 2,
    });
    expect(readOwnedDraft("alice", "A")).toEqual(first);
    expect(listOwnedDrafts("alice")).toHaveLength(2);
    expect(readOwnedDraft("bob")).toBeNull();
  });

  it("preserves malformed legacy metadata verbatim until explicit discard", () => {
    localStorage.setItem("impetus.task.cache", "# Original <!-- lock:x -->");
    localStorage.setItem("impetus.task.meta", "{broken JSON");
    const legacy = readLegacyDraft();
    expect(legacy?.payload).toBeNull();
    expect(legacy?.error).toBeTruthy();
    expect(JSON.parse(exportLegacyDraft()!)).toEqual({
      contentRaw: "# Original <!-- lock:x -->",
      metaRaw: "{broken JSON",
    });
    expect(localStorage.getItem("impetus.task.meta")).toBe("{broken JSON");
    expect(readOwnedDraft("alice")).toBeNull();
    discardLegacyDraft();
    expect(readLegacyDraft()).toBeNull();
  });

  it("keeps account IDs with a shared prefix isolated", () => {
    writeOwnedDraft("alice.team", {
      draftId: "private",
      content: "private writing",
      lockIds: [],
      taskId: null,
      version: 0,
      versionKnown: false,
      dirty: true,
      updatedAt: 1,
    });
    expect(readOwnedDraft("alice")).toBeNull();
  });

  it("reports malformed owned lock metadata with its exact raw and recoverable body", () => {
    const raw =
      '{"draftId":"broken","content":"Retained <!-- lock:x -->","lockIds":"x","taskId":"A","version":7,"versionKnown":true,"dirty":true,"updatedAt":1}';
    localStorage.setItem("impetus.draft.alice.broken", raw);
    const inspected = inspectOwnedDrafts("alice");
    expect(inspected.drafts).toEqual([]);
    expect(inspected.issues).toEqual([
      {
        key: "impetus.draft.alice.broken",
        raw,
        content: "Retained <!-- lock:x -->",
        taskId: "A",
        error: expect.stringContaining("lock metadata"),
      },
    ]);
    expect(() => readOwnedDraft("alice")).toThrow("could not be restored");
    expect(localStorage.getItem("impetus.draft.alice.broken")).toBe(raw);
  });
});
