import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";
import { AppProviders } from "./AppProviders";
import { writeOwnedDraft } from "./services/draftStore";
import type { TaskRecord } from "./types/task";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.mocked(globalThis.fetch).mockReset();
});

function stubAccount() {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const path = new URL(String(input), window.location.href).pathname;
    if (path === "/auth/me") return Response.json({ id: "account-a", email: "a@example.com" });
    if (path === "/tasks/") return Response.json({ tasks: [], total: 0, limit: 100, offset: 0 });
    return new Response(new ArrayBuffer(8));
  });
}

it("keeps the open creation form and its input while the same account is checked again", async () => {
  localStorage.setItem("impetus-lock-welcome-dismissed", "true");
  // This scenario starts from saved writing; a fresh App legitimately creates
  // INITIAL_STORY when its real editor becomes ready.
  const existingTask: TaskRecord = {
    id: "focus-existing-task",
    title: "Existing saved writing",
    content: "Existing saved writing",
    lock_ids: [],
    version: 1,
    category: "WRITING",
    priority: "MEDIUM",
    due_date: null,
    word_count: 3,
    created_at: "2026-10-11T00:00:00Z",
    updated_at: "2026-10-11T00:00:00Z",
  };
  writeOwnedDraft("account-a", {
    draftId: "focus-existing-draft",
    content: existingTask.content,
    lockIds: existingTask.lock_ids,
    taskId: existingTask.id,
    version: existingTask.version,
    versionKnown: true,
    dirty: false,
    updatedAt: Date.now(),
  });
  let meCalls = 0;
  let taskReads = 0;
  let finish!: (value: Response) => void;
  const checking = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  const account = { id: "account-a", email: "a@example.com" };
  const http = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const path = new URL(String(input), window.location.href).pathname;
    if (path === "/auth/me") return ++meCalls === 1 ? Response.json(account) : checking;
    if (path === "/tasks/")
      return Response.json({ tasks: [existingTask], total: 1, limit: 100, offset: 0 });
    if (path === `/tasks/${existingTask.id}` && (init?.method ?? "GET") === "GET") {
      taskReads++;
      return Response.json(existingTask);
    }
    return new Response(new ArrayBuffer(8));
  });
  const { container } = render(
    <AppProviders>
      <App />
    </AppProviders>
  );
  await waitFor(() =>
    expect(container.querySelector(".ProseMirror")).toHaveTextContent(existingTask.content)
  );
  expect(taskReads).toBe(1);
  expect(http.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
  fireEvent.click(screen.getByTestId("new-task-button"));
  fireEvent.change(screen.getByRole("textbox", { name: "Task Title *" }), {
    target: { value: "Unique unsubmitted title" },
  });
  act(() => window.dispatchEvent(new Event("focus")));
  await waitFor(() => expect(meCalls).toBe(2));
  expect(screen.getByRole("dialog", { name: "Create New Task" })).toBeVisible();
  expect(screen.getByRole("textbox", { name: "Task Title *" })).toHaveValue(
    "Unique unsubmitted title"
  );
  expect(screen.getByRole("button", { name: "Create Task" })).toBeDisabled();
  expect(taskReads).toBe(1);
  expect(http.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
  await act(async () => finish(Response.json(account)));
  await waitFor(() => expect(taskReads).toBe(2));
  expect(screen.getByRole("textbox", { name: "Task Title *" })).toHaveValue(
    "Unique unsubmitted title"
  );
  expect(screen.getByRole("button", { name: "Create Task" })).toBeEnabled();
  expect(http.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
  expect(http.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(0);
});

it("offers a retry when the unassigned source could not be read and keeps incomplete export disabled", async () => {
  localStorage.setItem("impetus-lock-welcome-dismissed", "true");
  localStorage.setItem("impetus.task.cache", "Original unassigned writing");
  const originalRead = Storage.prototype.getItem;
  let failReading = true;
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key) {
    if (key === "impetus.task.cache" && failReading) throw new Error("Reading unavailable");
    return originalRead.call(this, key);
  });
  stubAccount();
  render(
    <AppProviders>
      <App />
    </AppProviders>
  );
  expect(
    await screen.findByRole("button", { name: "Retry reading unassigned draft" })
  ).toBeEnabled();
  expect(screen.getByRole("button", { name: "Export original draft" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Import as a new draft" })).toBeDisabled();
  failReading = false;
  fireEvent.click(screen.getByRole("button", { name: "Retry reading unassigned draft" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Export original draft" })).toBeEnabled()
  );
  expect(localStorage.getItem("impetus.task.cache")).toBe("Original unassigned writing");
});

it("checks an unconfirmed creation explicitly and keeps later writing when a matching server task is chosen", async () => {
  localStorage.setItem("impetus-lock-welcome-dismissed", "true");
  writeOwnedDraft("account-a", {
    draftId: "unconfirmed-creation",
    content: "Latest writing after the lost response",
    lockIds: [],
    taskId: null,
    version: 0,
    versionKnown: false,
    dirty: true,
    updatedAt: Date.now(),
    creationUncertain: true,
    creationAttempt: { content: "Attempted writing", lockIds: [] },
  });
  const candidate = {
    id: "created-task",
    title: "Candidate",
    content: "Attempted writing",
    lock_ids: [],
    version: 0,
    created_at: "2026-10-11T00:00:00Z",
    updated_at: "2026-10-11T00:00:00Z",
    category: "WRITING",
    priority: "MEDIUM",
    due_date: null,
    word_count: 2,
  };
  const writes: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const path = new URL(String(input), window.location.href).pathname;
    if (path === "/auth/me") return Response.json({ id: "account-a", email: "a@example.com" });
    if (path === "/tasks/")
      return Response.json({ tasks: [candidate], total: 1, limit: 100, offset: 0 });
    if (init?.method === "POST" || init?.method === "PUT") writes.push(path);
    if (path === "/tasks/created-task") return Response.json(candidate);
    return new Response(new ArrayBuffer(8));
  });
  const { container } = render(
    <AppProviders>
      <App />
    </AppProviders>
  );
  expect(
    await screen.findByRole("heading", { name: "Task creation is unconfirmed" })
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Check for the created task" }));
  const choose = await screen.findByRole("button", { name: "Use created task: Candidate" });
  fireEvent.click(choose);
  expect(
    await screen.findByRole("heading", { name: "Your local draft and server version differ" })
  ).toBeVisible();
  await waitFor(() =>
    expect(container.querySelector(".ProseMirror")).toHaveTextContent(
      "Latest writing after the lost response"
    )
  );
  expect(writes).toEqual([]);
  expect(
    Object.values(localStorage).some(
      (raw) =>
        raw.includes("unconfirmed-creation") &&
        raw.includes("Latest writing after the lost response")
    )
  ).toBe(true);
});
