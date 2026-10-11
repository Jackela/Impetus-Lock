import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { editorViewCtx, type Editor } from "@milkdown/core";
import { TextSelection } from "@milkdown/prose/state";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EditorCore } from "./EditorCore";

// jsdom has no physical text rectangles; formatting assertions use the real document.
beforeEach(() => {
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: () => [new DOMRect(0, 0, 10, 10)],
  });
  Object.defineProperty(Range.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => new DOMRect(0, 0, 10, 10),
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(Range.prototype, "getClientRects");
  Reflect.deleteProperty(Range.prototype, "getBoundingClientRect");
});

it("gives the actual editable surface an accessible writing name", async () => {
  const ready = vi.fn<(editor: Editor) => void>();
  render(<EditorCore initialContent="Writer text" onReady={ready} />);
  await waitFor(() => expect(ready).toHaveBeenCalledOnce());
  expect(screen.getByRole("textbox", { name: "Writing editor" })).toHaveAttribute(
    "aria-multiline",
    "true"
  );
});

it.each([
  [false, "Enter"],
  [false, "Space"],
  [false, "assistive click"],
  [false, "pointer"],
  [true, "Enter"],
  [true, "Space"],
  [true, "assistive click"],
  [true, "pointer"],
] as const)(
  "formats the real %s mobile editor selection exactly once using %s",
  async (mobile, input) => {
    const match = vi.mocked(window.matchMedia).getMockImplementation()!;
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      ...match(query),
      matches: query === "(max-width: 767px)" ? mobile : match(query).matches,
    }));
    const ready = vi.fn<(editor: Editor) => void>();
    const changed = vi.fn();
    render(<EditorCore initialContent="Writer text" onReady={ready} onChange={changed} />);
    await waitFor(() => expect(ready).toHaveBeenCalledOnce());
    const view = ready.mock.calls[0]![0].action((ctx) => ctx.get(editorViewCtx));
    await act(async () => Promise.resolve());
    act(() =>
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 7)))
    );
    const button = await screen.findByRole("button", { name: "Bold" });
    const user = userEvent.setup();
    changed.mockClear();
    if (input === "Enter" || input === "Space") {
      button.focus();
      await user.keyboard(input === "Enter" ? "{Enter}" : " ");
    } else if (input === "pointer") await user.click(button);
    else fireEvent.click(button, { detail: 0 });
    expect(view.state.doc.firstChild?.firstChild?.marks.map((mark) => mark.type.name)).toEqual([
      "strong",
    ]);
    expect(changed).toHaveBeenCalledOnce();
    expect(changed.mock.calls[0]?.[0]).toContain("**Writer** text");
    expect(button).toHaveAttribute("aria-pressed", "true");
  }
);
