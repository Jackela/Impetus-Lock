import { afterEach, describe, expect, it } from "vitest";
import {
  getLegacyMarkdown,
  setLegacyMarkdown,
  deleteLegacyWithoutUndo,
} from "../fixtures/legacyEditorBoundary";

const originalEditor = Object.getOwnPropertyDescriptor(window, "__editor__");

function installFacade(value: unknown) {
  Object.defineProperty(window, "__editor__", { configurable: true, value });
}

afterEach(() => {
  if (originalEditor) Object.defineProperty(window, "__editor__", originalEditor);
  else Reflect.deleteProperty(window, "__editor__");
});

const operations = [
  { method: "getMarkdown", run: () => getLegacyMarkdown() },
  { method: "setMarkdown", run: () => setLegacyMarkdown("new text") },
  { method: "deleteWithoutUndo", run: () => deleteLegacyWithoutUndo({ from: 30, to: 50 }) },
];

describe("legacy browser editor boundary", () => {
  it.each(operations)("$method reports an absent runtime facade", ({ run }) => {
    Reflect.deleteProperty(window, "__editor__");
    expect(run).toThrow("Legacy E2E requires window.__editor__; no editor facade is installed");
  });

  it.each(operations)("$method rejects a malformed facade", ({ run }) => {
    installFacade(null);
    expect(run).toThrow("Legacy E2E window.__editor__ must be an object");
    installFacade("editor");
    expect(run).toThrow("Legacy E2E window.__editor__ must be an object");
  });

  it.each(operations)("$method reports a missing or non-callable method", ({ method, run }) => {
    installFacade({});
    expect(run).toThrow(`Legacy E2E window.__editor__.${method} must be a function`);
    installFacade({ [method]: "not a function" });
    expect(run).toThrow(`Legacy E2E window.__editor__.${method} must be a function`);
  });

  it.each([undefined, null, 42, {}, Promise.resolve("text")])(
    "rejects a getMarkdown result that is not a string: %s",
    (result) => {
      installFacade({ getMarkdown: () => result });
      expect(getLegacyMarkdown).toThrow(
        "Legacy E2E window.__editor__.getMarkdown must return a string"
      );
    }
  );

  it.each([false, "ok", Promise.resolve()])(
    "does not impose an unused setMarkdown return contract: %s",
    (result) => {
      installFacade({ setMarkdown: () => result });
      expect(() => setLegacyMarkdown("new text")).not.toThrow();
    }
  );

  it.each([undefined, 1, "true", Promise.resolve(true)])(
    "does not impose an unused deleteWithoutUndo return contract: %s",
    (result) => {
      installFacade({ deleteWithoutUndo: () => result });
      expect(() => deleteLegacyWithoutUndo({ from: 30, to: 50 })).not.toThrow();
    }
  );

  it("reads and writes valid Markdown while retaining the facade receiver", () => {
    const facade = {
      markdown: "original text",
      getMarkdown() {
        return this.markdown;
      },
      setMarkdown(markdown: string) {
        this.markdown = markdown;
      },
    };
    installFacade(facade);
    expect(getLegacyMarkdown()).toBe("original text");
    expect(setLegacyMarkdown("new text")).toBeUndefined();
    expect(getLegacyMarkdown()).toBe("new text");
    expect(setLegacyMarkdown("")).toBeUndefined();
    expect(getLegacyMarkdown()).toBe("");
  });

  it.each([true, false])("forwards the exact delete range when the facade returns %s", (result) => {
    const facade = {
      range: { from: -1, to: -1 },
      deleteWithoutUndo(range: { from: number; to: number }) {
        this.range = range;
        return result;
      },
    };
    installFacade(facade);
    expect(deleteLegacyWithoutUndo({ from: 30, to: 50 })).toBeUndefined();
    expect(facade.range).toEqual({ from: 30, to: 50 });
  });

  it("preserves an installed method's error", () => {
    installFacade({
      getMarkdown() {
        throw new Error("editor failed to read");
      },
    });
    expect(getLegacyMarkdown).toThrow("editor failed to read");
  });
});
