import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { AppProviders } from "./AppProviders";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("the actual authenticated editor entry", () => {
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
