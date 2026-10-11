import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Editor, editorViewCtx } from "@milkdown/core";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";
import { AppProviders } from "./AppProviders";
import { writeOwnedDraft } from "./services/draftStore";

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("resumes real A autosave with locks after a failed B selection is cancelled and storage recovers", async () => {
  localStorage.setItem("impetus-lock-welcome-dismissed", "true");
  const records = ["A", "B"].map((id) => ({
    id,
    title: id,
    content:
      id === "A"
        ? "# Task A\n\nProtected A <!-- lock:cancel_lock source:muse -->\n\nEditable A"
        : "# Task B",
    lock_ids: id === "A" ? ["cancel_lock"] : [],
    version: 1,
    created_at: "2026-10-07T00:00:00Z",
    updated_at: "2026-10-07T00:00:00Z",
    category: "WRITING",
    priority: "MEDIUM",
    due_date: null,
    word_count: 2,
  }));
  for (const [index, record] of records.entries())
    writeOwnedDraft("account-a", {
      draftId: record.id,
      taskId: record.id,
      content: record.content,
      lockIds: record.lock_ids,
      version: 1,
      versionKnown: true,
      dirty: false,
      updatedAt: index === 0 ? 2 : 1,
    });
  const saves: { content: string; lock_ids: string[]; version: number }[] = [];
  let readsA = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (input, init) => {
      const path = new URL(String(input), window.location.href).pathname;
      if (path === "/auth/me") return Response.json({ id: "account-a", email: "a@example.com" });
      if (path === "/tasks/")
        return Response.json({ tasks: records, total: 2, limit: 100, offset: 0 });
      const record = records.find((item) => path === `/tasks/${item.id}`);
      if (record) {
        if (init?.method === "PUT") {
          const body = JSON.parse(String(init.body));
          saves.push(body);
          Object.assign(record, body, { version: body.version + 1 });
        } else if (record.id === "A") readsA++;
        return Response.json(record);
      }
      return new Response(new ArrayBuffer(8));
    })
  );
  const { container } = render(
    <AppProviders>
      <App />
    </AppProviders>
  );
  await waitFor(() =>
    expect(container.querySelector(".ProseMirror")).toHaveTextContent("Editable A")
  );
  const retainedEditor = container.querySelector(".ProseMirror");
  const originalGet = Storage.prototype.getItem;
  const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (
    this: Storage,
    key
  ) {
    if (key === "impetus.draft.account-a.B")
      throw new DOMException("Controlled read failure", "SecurityError");
    return originalGet.call(this, key);
  });
  fireEvent.click(await screen.findByTestId("task-item-B"));
  await screen.findByRole("button", { name: "Retry draft recovery" });
  expect(container.querySelector(".ProseMirror")).toBe(retainedEditor);
  expect(screen.getByTestId("task-item-A")).toHaveAttribute("aria-current", "true");
  get.mockRestore();
  fireEvent.click(screen.getByTestId("task-item-A"));
  fireEvent.click(screen.getByRole("button", { name: "Retry draft recovery" }));
  await waitFor(() => expect(readsA).toBeGreaterThan(1));
  expect(container.querySelector(".ProseMirror")).toBe(retainedEditor);
  const editor = window.editorInstance;
  if (!editor) throw new Error("Actual editor unavailable");
  act(() =>
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      view.dispatch(view.state.tr.insertText("Continued ", 1));
    })
  );
  expect(container.querySelector(".ProseMirror")).toHaveTextContent("Continued Task A");
  await waitFor(() => expect(saves.length).toBeGreaterThan(0), { timeout: 3000 });
  expect(saves.at(-1)?.content).toContain("Continued Task A");
  expect(saves.at(-1)?.content).toContain("<!-- lock:cancel_lock source:muse -->");
  expect(saves.at(-1)?.lock_ids).toEqual(["cancel_lock"]);
});

it("waits for the actual B editor before saving a restored dirty B snapshot", async () => {
  localStorage.setItem("impetus-lock-welcome-dismissed", "true");
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const make = Editor.make;
  let creations = 0;
  vi.spyOn(Editor, "make").mockImplementation(() => {
    const editor = make();
    const create = editor.create;
    if (++creations === 2)
      vi.spyOn(editor, "create").mockImplementation(async () => {
        const value = await create();
        await gate;
        return value;
      });
    return editor;
  });
  const records = ["A", "B"].map((id) => ({
    id,
    title: id,
    content: `# Server ${id}`,
    lock_ids: [] as string[],
    version: 1,
    created_at: "2026-10-07T00:00:00Z",
    updated_at: "2026-10-07T00:00:00Z",
    category: "WRITING",
    priority: "MEDIUM",
    due_date: null,
    word_count: 2,
  }));
  for (const [index, record] of records.entries())
    writeOwnedDraft("account-a", {
      draftId: record.id,
      taskId: record.id,
      content:
        record.id === "B"
          ? "# Latest B\n\nProtected B <!-- lock:ready_B source:muse -->"
          : record.content,
      lockIds: record.id === "B" ? ["ready_B"] : [],
      version: 1,
      versionKnown: true,
      dirty: record.id === "B",
      updatedAt: index === 0 ? 2 : 1,
    });
  const saves: { content: string; lock_ids: string[]; version: number }[] = [];
  let readsB = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (input, init) => {
      const path = new URL(String(input), window.location.href).pathname;
      if (path === "/auth/me") return Response.json({ id: "account-a", email: "a@example.com" });
      if (path === "/tasks/")
        return Response.json({ tasks: records, total: 2, limit: 100, offset: 0 });
      const record = records.find((item) => path === `/tasks/${item.id}`);
      if (record) {
        if (init?.method === "PUT") {
          const body = JSON.parse(String(init.body));
          saves.push(body);
          Object.assign(record, body, { version: body.version + 1 });
        } else if (record.id === "B") readsB++;
        return Response.json(record);
      }
      return new Response(new ArrayBuffer(8));
    })
  );
  const { container } = render(
    <AppProviders>
      <App />
    </AppProviders>
  );
  await waitFor(() =>
    expect(container.querySelector(".ProseMirror")).toHaveTextContent("Server A")
  );
  try {
    fireEvent.click(await screen.findByTestId("task-item-B"));
    await waitFor(() => {
      expect(readsB).toBe(1);
      expect(creations).toBe(2);
    });
    await act(async () => {});
    expect(saves).toEqual([]);
    await act(async () => release());
    await waitFor(() => expect(saves.length).toBe(1), { timeout: 3000 });
    expect(saves[0]?.content).toContain("Latest B");
    expect(saves[0]?.lock_ids).toEqual(["ready_B"]);
  } finally {
    release();
  }
});

it("enables legacy import after the actual delayed clean B editor is ready", async () => {
  localStorage.setItem("impetus-lock-welcome-dismissed", "true");
  localStorage.setItem("impetus.task.cache", "Unassigned writing");
  localStorage.setItem("impetus.task.meta", JSON.stringify({ lockIds: [] }));
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const make = Editor.make;
  let creations = 0;
  vi.spyOn(Editor, "make").mockImplementation(() => {
    const editor = make();
    const create = editor.create;
    if (++creations === 2)
      vi.spyOn(editor, "create").mockImplementation(async () => {
        const value = await create();
        await gate;
        return value;
      });
    return editor;
  });
  const records = ["A", "B"].map((id) => ({
    id,
    title: id,
    content: `# Server ${id}`,
    lock_ids: [] as string[],
    version: 1,
    created_at: "2026-10-07T00:00:00Z",
    updated_at: "2026-10-07T00:00:00Z",
    category: "WRITING",
    priority: "MEDIUM",
    due_date: null,
    word_count: 2,
  }));
  for (const [index, record] of records.entries())
    writeOwnedDraft("account-a", {
      draftId: record.id,
      taskId: record.id,
      content: record.content,
      lockIds: [],
      version: 1,
      versionKnown: true,
      dirty: false,
      updatedAt: index === 0 ? 2 : 1,
    });
  const saves: { content: string; lock_ids: string[]; version: number }[] = [];
  let readsB = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (input, init) => {
      const path = new URL(String(input), window.location.href).pathname;
      if (path === "/auth/me") return Response.json({ id: "account-a", email: "a@example.com" });
      if (path === "/tasks/")
        return Response.json({ tasks: records, total: 2, limit: 100, offset: 0 });
      const record = records.find((item) => path === `/tasks/${item.id}`);
      if (record) {
        if (init?.method === "PUT") {
          const body = JSON.parse(String(init.body));
          saves.push(body);
          Object.assign(record, body, { version: body.version + 1 });
        } else if (record.id === "B") readsB++;
        return Response.json(record);
      }
      return new Response(new ArrayBuffer(8));
    })
  );
  const { container } = render(
    <AppProviders>
      <App />
    </AppProviders>
  );
  await waitFor(() =>
    expect(container.querySelector(".ProseMirror")).toHaveTextContent("Server A")
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Import as a new draft" })).toBeEnabled()
  );
  try {
    fireEvent.click(await screen.findByTestId("task-item-B"));
    await waitFor(() => {
      expect(readsB).toBe(1);
      expect(creations).toBe(2);
    });
    await act(async () => {});
    expect(saves).toEqual([]);
    expect(screen.getByRole("button", { name: "Import as a new draft" })).toBeDisabled();
    await act(async () => release());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Import as a new draft" })).toBeEnabled()
    );
    expect(saves).toEqual([]);
  } finally {
    release();
  }
});
