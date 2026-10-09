import { Schema } from "@milkdown/prose/model";
import { EditorState, TextSelection, type Transaction } from "@milkdown/prose/state";
import { EditorView } from "@milkdown/prose/view";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteContentAtAnchor,
  deleteLastSentence,
  injectLockedBlock,
  rewriteLastSentenceWithLock,
  rewriteRangeWithLock,
} from "./ContentInjector";

// Match the existing file-local passthrough: exercise real exports even when
// editor tests install a partial ContentInjector mock in the vmThreads registry.
vi.mock("./ContentInjector", async (importOriginal) => await importOriginal());

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: {
      content: "text*",
      group: "block",
      attrs: { lockId: { default: null }, source: { default: null } },
      toDOM: () => ["p", 0],
    },
    blockquote: {
      content: "paragraph+",
      group: "block",
      attrs: { lockId: { default: null }, source: { default: null } },
      toDOM: () => ["blockquote", 0],
    },
    text: { group: "inline" },
  },
});
const noParagraphSchema = new Schema({
  nodes: {
    doc: { content: "line+" },
    line: { content: "text*", toDOM: () => ["div", 0] },
    text: {},
  },
});
const views: EditorView[] = [];
let now = 2_000_000_000_000;

function editor(text: string, editorSchema: Schema = schema, block = "paragraph") {
  const doc = editorSchema.node("doc", null, [
    editorSchema.node(block, null, text ? editorSchema.text(text) : undefined),
  ]);
  const state = EditorState.create({
    schema: editorSchema,
    doc,
    selection: TextSelection.atEnd(doc),
  });
  const transactions: Transaction[] = [];
  const view: EditorView = new EditorView(document.createElement("div"), {
    state,
    dispatchTransaction(tr) {
      transactions.push(tr);
      view.updateState(view.state.apply(tr));
    },
  });
  views.push(view);
  return { view, transactions };
}

function expectAction(transactions: Transaction[], action: string) {
  expect(transactions).toHaveLength(1);
  expect(transactions[0]?.getMeta("addToHistory")).toBe(false);
  expect(transactions[0]?.getMeta("aiAction")).toBe(true);
  expect(transactions[0]?.getMeta("actionType")).toBe(action);
}

beforeEach(() => {
  now += 10_000;
  vi.spyOn(Date, "now").mockImplementation(() => now);
});
afterEach(() => {
  for (const view of views.splice(0)) view.destroy();
  vi.restoreAllMocks();
});

describe("ContentInjector with a real ProseMirror document and view", () => {
  it("deletes only the requested text in one non-undoable AI transaction", () => {
    const { view, transactions } = editor("Keep. Remove. Tail.");
    deleteContentAtAnchor(view, { type: "range", from: 7, to: 14 });
    expect(view.state.doc.textContent).toBe("Keep.  Tail.");
    expectAction(transactions, "delete");
  });

  it.each([
    { from: -1, to: 5 },
    { from: 1, to: 999 },
    { from: 5, to: 5 },
    { from: 6, to: 5 },
  ])("rejects invalid delete range $from to $to without dispatch", (range) => {
    const { view, transactions } = editor("Writer content.");
    const original = view.state.doc;
    deleteContentAtAnchor(view, { type: "range", ...range });
    expect(view.state.doc.eq(original)).toBe(true);
    expect(transactions).toHaveLength(0);
  });

  it("throttles deletes before 1500ms and permits a delete at the boundary", () => {
    const { view, transactions } = editor("abcdef");
    deleteContentAtAnchor(view, { type: "range", from: 1, to: 2 });
    now += 1499;
    deleteContentAtAnchor(view, { type: "range", from: 1, to: 2 });
    expect(view.state.doc.textContent).toBe("bcdef");
    expect(transactions).toHaveLength(1);
    now += 1;
    deleteContentAtAnchor(view, { type: "range", from: 1, to: 2 });
    expect(view.state.doc.textContent).toBe("cdef");
    expect(transactions).toHaveLength(2);
  });

  it("an invalid delete also consumes the throttle interval", () => {
    const { view, transactions } = editor("abcdef");
    deleteContentAtAnchor(view, { type: "range", from: -1, to: 2 });
    now += 1499;
    deleteContentAtAnchor(view, { type: "range", from: 1, to: 2 });
    expect(view.state.doc.textContent).toBe("abcdef");
    expect(transactions).toHaveLength(0);
    now += 1;
    deleteContentAtAnchor(view, { type: "range", from: 1, to: 2 });
    expect(view.state.doc.textContent).toBe("bcdef");
    expectAction(transactions, "delete");
  });

  it("deletes the last sentence before the cursor and preserves surrounding text", () => {
    const { view, transactions } = editor("Opening stays. Remove this sentence. Trailing stays.");
    view.updateState(
      view.state.apply(view.state.tr.setSelection(TextSelection.create(view.state.doc, 37)))
    );
    deleteLastSentence(view);
    expect(view.state.doc.textContent).toBe("Opening stays.  Trailing stays.");
    expectAction(transactions, "delete");
  });

  it("does not dispatch a sentence delete or rewrite on an empty document", () => {
    const emptySchema = new Schema({
      nodes: schema.spec.nodes.update("doc", { content: "block*" }),
    });
    const transactions: Transaction[] = [];
    const view: EditorView = new EditorView(document.createElement("div"), {
      state: EditorState.create({ schema: emptySchema }),
      dispatchTransaction(tr) {
        transactions.push(tr);
        view.updateState(view.state.apply(tr));
      },
    });
    views.push(view);
    const original = view.state.doc;
    deleteLastSentence(view);
    rewriteLastSentenceWithLock(view, "Replacement", "empty");
    expect(view.state.doc.eq(original)).toBe(true);
    expect(transactions).toHaveLength(0);
  });

  it("rewrites an exact range atomically, sanitizing markers and preserving lock attributes", () => {
    const { view, transactions } = editor("Keep. Replace me. Tail.");
    rewriteRangeWithLock({
      view,
      content: "New <!-- obsolete --> text   ",
      lockId: "rewrite-lock",
      source: "loki",
      anchor: { type: "range", from: 7, to: 18 },
    });
    expect(view.state.doc.textContent).toBe(
      "Keep. New  text <!-- lock:rewrite-lock source:loki --> Tail."
    );
    expect(view.state.doc.child(1).attrs).toMatchObject({ lockId: "rewrite-lock", source: "loki" });
    expectAction(transactions, "rewrite");
  });

  it("uses the last sentence heuristic when a rewrite has no anchor", () => {
    const { view, transactions } = editor("Opening stays.   Replace this final sentence.");
    rewriteRangeWithLock({ view, content: "New ending", lockId: "fallback-lock", source: "muse" });
    expect(view.state.doc.textContent).toBe(
      "Opening stays.   New ending <!-- lock:fallback-lock source:muse -->"
    );
    expect(view.state.doc.child(1).attrs).toMatchObject({
      lockId: "fallback-lock",
      source: "muse",
    });
    expectAction(transactions, "rewrite");
  });

  it("rewrites an unpunctuated fragment using the heuristic fallback", () => {
    const { view, transactions } = editor("An unfinished sentence without punctuation");
    rewriteLastSentenceWithLock(view, "New ending", "fragment-lock");
    expect(view.state.doc.textContent).toBe("New ending <!-- lock:fragment-lock -->");
    expect(view.state.doc.child(1).attrs).toMatchObject({ lockId: "fragment-lock", source: null });
    expectAction(transactions, "rewrite");
  });

  it.each([
    { from: -1, to: 5 },
    { from: 1, to: 999 },
    { from: 5, to: 5 },
    { from: 6, to: 5 },
  ])("rejects invalid rewrite range $from to $to without falling back", (range) => {
    const { view, transactions } = editor("Writer content.");
    const original = view.state.doc;
    rewriteRangeWithLock({
      view,
      content: "Replacement",
      lockId: "invalid",
      anchor: { type: "range", ...range },
    });
    expect(view.state.doc.eq(original)).toBe(true);
    expect(transactions).toHaveLength(0);
  });

  it("safely skips explicit and heuristic rewrites when the schema has no paragraph", () => {
    const { view, transactions } = editor(
      "A sufficiently long sentence.",
      noParagraphSchema,
      "line"
    );
    const original = view.state.doc;
    expect(() => {
      rewriteRangeWithLock({
        view,
        content: "New",
        lockId: "no-paragraph",
        anchor: { type: "range", from: 1, to: 5 },
      });
      rewriteLastSentenceWithLock(view, "New", "no-paragraph");
      injectLockedBlock(view, "New", "no-paragraph", { type: "pos", from: 0 });
    }).not.toThrow();
    expect(view.state.doc.eq(original)).toBe(true);
    expect(transactions).toHaveLength(0);
  });

  it("inserts a locked block at a range anchor without deleting the original text", () => {
    const { view, transactions } = editor("Writer content.");
    injectLockedBlock(
      view,
      "Constraint <!-- old -->",
      "provoke-lock",
      { type: "range", from: 0, to: 5 },
      "muse"
    );
    expect(view.state.doc.firstChild?.type.name).toBe("blockquote");
    expect(view.state.doc.firstChild?.attrs).toMatchObject({
      lockId: "provoke-lock",
      source: "muse",
    });
    expect(view.state.doc.textContent).toBe(
      "Constraint <!-- lock:provoke-lock source:muse -->Writer content."
    );
    expectAction(transactions, "provoke");
  });

  it.each(["lock_id", "invalid-position"] as const)(
    "inserts at the cursor for %s anchors",
    (kind) => {
      const { view, transactions } = editor("Writer content.");
      injectLockedBlock(
        view,
        "Constraint",
        "cursor-lock",
        kind === "lock_id"
          ? { type: "lock_id", ref_lock_id: "existing" }
          : { type: "pos", from: 999 }
      );
      expect(view.state.doc.textContent).toBe(
        "Writer content.Constraint <!-- lock:cursor-lock -->"
      );
      expectAction(transactions, "provoke");
    }
  );
});
