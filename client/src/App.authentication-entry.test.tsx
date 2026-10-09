import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { AppProviders } from "./AppProviders";
import { writeOwnedDraft } from "./services/draftStore";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("the actual authenticated editor entry", () => {
  it.each([true, false])(
    "retries a task storage failure while retaining a draft (remote task: %s)",
    async (hasRemoteTask) => {
      localStorage.setItem("impetus-lock-welcome-dismissed", "true");
      const records = ["A", "B"].map((id) => ({
        id,
        title: id,
        content: `Writing ${id}`,
        lock_ids: [],
        version: 1,
        created_at: "2026-10-07T00:00:00Z",
        updated_at: "2026-10-07T00:00:00Z",
        category: "WRITING",
        priority: "MEDIUM",
        due_date: null,
        word_count: 2,
      }));
      for (const [index, record] of records.entries()) {
        writeOwnedDraft("account-a", {
          draftId: record.id,
          taskId: index === 0 && !hasRemoteTask ? null : record.id,
          content: record.content,
          lockIds: [],
          version: 1,
          versionKnown: true,
          dirty: false,
          updatedAt: index === 0 ? 2 : 1,
        });
      }
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>(async (input) => {
          const path = new URL(String(input), window.location.href).pathname;
          if (path === "/auth/me")
            return Response.json({ id: "account-a", email: "a@example.com" });
          if (path === "/tasks/")
            return Response.json({ tasks: records, total: 2, limit: 100, offset: 0 });
          const task = records.find((record) => path === `/tasks/${record.id}`);
          return task ? Response.json(task) : new Response(new ArrayBuffer(8));
        })
      );
      const { container } = render(
        <AppProviders>
          <App />
        </AppProviders>
      );
      await waitFor(() =>
        expect(container.querySelector(".ProseMirror")).toHaveTextContent("Writing A")
      );
      const originalGet = Storage.prototype.getItem;
      const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (
        this: Storage,
        key
      ) {
        if (key === "impetus.draft.account-a.B")
          throw new DOMException("Controlled read failure", "SecurityError");
        return originalGet.call(this, key);
      });
      try {
        fireEvent.click(await screen.findByTestId("task-item-B"));
        await screen.findByRole("button", { name: "Retry draft recovery" });
        const retainedEditor = container.querySelector(".ProseMirror");
        fireEvent.click(screen.getByRole("button", { name: "Retry draft recovery" }));
        expect(container.querySelector(".ProseMirror")).toBe(retainedEditor);
        expect(retainedEditor).toHaveTextContent("Writing A");
        expect(screen.getByTestId("task-item-A")).toHaveAttribute(
          "aria-selected",
          String(hasRemoteTask)
        );
        expect(screen.getByTestId("task-item-B")).toHaveAttribute("aria-selected", "false");
      } finally {
        get.mockRestore();
      }
    }
  );

  it("never labels a server draft as saved when its locks cannot be restored", async () => {
    localStorage.setItem("impetus-lock-welcome-dismissed", "true");
    writeOwnedDraft("account-a", {
      draftId: "missing-server-lock",
      content: "Original",
      lockIds: [],
      taskId: "server-broken",
      version: 1,
      versionKnown: true,
      dirty: false,
      updatedAt: Date.now(),
    });
    const server = {
      id: "server-broken",
      title: "Broken lock",
      content: "Server original without a marker",
      lock_ids: ["missing-server-lock"],
      version: 2,
      created_at: "2026-10-07T00:00:00Z",
      updated_at: "2026-10-07T00:00:00Z",
      category: "WRITING",
      priority: "MEDIUM",
      due_date: null,
      word_count: 5,
    };
    const writes: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input, init) => {
        const path = new URL(String(input), window.location.href).pathname;
        if (path === "/auth/me") return Response.json({ id: "account-a", email: "a@example.com" });
        if (path === "/tasks/")
          return Response.json({ tasks: [server], total: 1, limit: 100, offset: 0 });
        if (init?.method === "POST" || init?.method === "PUT") writes.push(path);
        if (path === `/tasks/${server.id}`) return Response.json(server);
        return new Response(new ArrayBuffer(8));
      })
    );
    const { container } = render(
      <AppProviders>
        <App />
      </AppProviders>
    );
    expect(await screen.findByTestId("unrecovered-draft")).toHaveTextContent(server.content);
    expect(container.querySelector(".task-status")).toHaveTextContent("Save failed");
    expect(container.querySelector(".task-status")).not.toHaveTextContent(/^Saved$/);
    expect(writes).toEqual([]);
  });

  it("keeps malformed account lock metadata available as read-only original writing", async () => {
    localStorage.setItem("impetus-lock-welcome-dismissed", "true");
    const raw = JSON.stringify({
      draftId: "broken-locks",
      content: "Original locked writing",
      lockIds: "lost-array",
      taskId: "broken-task",
      version: 1,
      versionKnown: true,
      dirty: true,
      updatedAt: Date.now(),
    });
    localStorage.setItem("impetus.draft.account-a.broken-locks", raw);
    const writes: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input, init) => {
        const path = new URL(String(input), window.location.href).pathname;
        if (path === "/auth/me") return Response.json({ id: "account-a", email: "a@example.com" });
        if (path === "/tasks/")
          return Response.json({ tasks: [], total: 0, limit: 100, offset: 0 });
        if (init?.method === "POST" || init?.method === "PUT") writes.push(path);
        return new Response(new ArrayBuffer(8));
      })
    );
    const { container } = render(
      <AppProviders>
        <App />
      </AppProviders>
    );
    expect(await screen.findByText("Owned draft needs recovery")).toBeVisible();
    expect(screen.getByTestId("unrecovered-account-draft")).toHaveTextContent(
      "Original locked writing"
    );
    expect(screen.getByRole("button", { name: "Export original account draft" })).toBeVisible();
    expect(container.querySelector(".ProseMirror")).toBeNull();
    expect(localStorage.getItem("impetus.draft.account-a.broken-locks")).toBe(raw);
    expect(writes).toEqual([]);
  });

  it("adopts the server document and its locks after explicitly replacing a locked local conflict", async () => {
    localStorage.setItem("impetus-lock-welcome-dismissed", "true");
    const local = "Local writing\n\n> Protected local <!-- lock:local-lock -->";
    const server = {
      id: "conflict-task",
      title: "Conflict",
      content: "Server writing\n\n> Protected server <!-- lock:server-lock -->",
      lock_ids: ["server-lock"],
      version: 2,
      created_at: "2026-10-07T00:00:00Z",
      updated_at: "2026-10-07T00:00:00Z",
      category: "WRITING",
      priority: "MEDIUM",
      due_date: null,
      word_count: 4,
    };
    writeOwnedDraft("account-a", {
      draftId: "local-conflict",
      content: local,
      lockIds: ["local-lock"],
      taskId: server.id,
      version: 1,
      versionKnown: true,
      dirty: true,
      updatedAt: Date.now(),
    });
    const writes: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input, init) => {
        const path = new URL(String(input), window.location.href).pathname;
        if (path === "/auth/me") return Response.json({ id: "account-a", email: "a@example.com" });
        if (path === "/tasks/")
          return Response.json({ tasks: [server], total: 1, limit: 100, offset: 0 });
        if (path === `/tasks/${server.id}`) {
          if (init?.method === "PUT") writes.push(String(init.body));
          return Response.json(server);
        }
        return new Response(new ArrayBuffer(8));
      })
    );
    const { container } = render(
      <AppProviders>
        <App />
      </AppProviders>
    );
    expect(await screen.findByRole("button", { name: "Use server version" })).toBeVisible();
    await waitFor(() =>
      expect(container.querySelector(".ProseMirror")).toHaveTextContent("Protected local")
    );
    fireEvent.click(screen.getByRole("button", { name: "Use server version" }));
    await waitFor(() =>
      expect(container.querySelector(".ProseMirror")).toHaveTextContent("Protected server")
    );
    expect(container.querySelector(".ProseMirror")).not.toHaveTextContent("Protected local");
    await waitFor(() =>
      expect(container.querySelector('[data-lock-id="server-lock"]')).toBeInTheDocument()
    );
    expect(container.querySelector('[data-lock-id="local-lock"]')).not.toBeInTheDocument();
    expect(window.lockManager?.getAllLocks()).toEqual(["server-lock"]);
    expect(writes).toEqual([]);
    const backups = Object.entries(localStorage).filter(
      ([key, raw]) => key.startsWith("impetus.draft.account-a.") && raw.includes("recoveryOf")
    );
    expect(backups.some(([, raw]) => JSON.parse(raw).content === local)).toBe(true);
  });

  it("keeps protected work and the editor stopped while the server identity is pending", async () => {
    const protectedRequests: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) => {
        const path = new URL(String(input), window.location.href).pathname;
        if (path === "/auth/me") return new Promise<Response>(() => {});
        if (path.startsWith("/tasks") || path.startsWith("/impetus")) protectedRequests.push(path);
        if (path === "/tasks/")
          return Response.json({ tasks: [], total: 0, limit: 100, offset: 0 });
        return Response.json({
          id: "unexpected-task",
          content: "Unexpected",
          lock_ids: [],
          version: 0,
        });
      })
    );
    const { container } = render(
      <AppProviders>
        <App />
      </AppProviders>
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("Checking your session…")).toBeVisible();
    expect(container.querySelector(".ProseMirror")).toBeNull();
    expect(protectedRequests).toEqual([]);
  });

  it("offers explicit recovery for an unassigned draft without using its old task identity", async () => {
    localStorage.setItem("impetus-lock-welcome-dismissed", "true");
    localStorage.setItem("impetus.task.cache", "Unassigned original text");
    localStorage.setItem(
      "impetus.task.meta",
      JSON.stringify({ taskId: "untrusted-old-task", version: 9 })
    );
    const requests: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input, init) => {
        const path = new URL(String(input), window.location.href).pathname;
        requests.push(`${init?.method ?? "GET"} ${path}`);
        if (path === "/auth/me") return Response.json({ id: "account-a", email: "a@example.com" });
        if (path === "/tasks/")
          return Response.json({ tasks: [], total: 0, limit: 100, offset: 0 });
        if (path === "/tasks")
          return Response.json({
            id: "new-account-task",
            content: JSON.parse(String(init?.body)).content,
            lock_ids: [],
            version: 0,
          });
        return new Response(new ArrayBuffer(8));
      })
    );
    render(
      <AppProviders>
        <App />
      </AppProviders>
    );
    expect(await screen.findByText("Unassigned draft found")).toBeVisible();
    expect(screen.getByRole("button", { name: "Import as a new draft" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Export original draft" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Discard unassigned draft" })).toBeVisible();
    expect(requests).not.toContain("GET /tasks/untrusted-old-task");
    expect(localStorage.getItem("impetus.task.cache")).toBe("Unassigned original text");
  });
});
