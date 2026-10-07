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
