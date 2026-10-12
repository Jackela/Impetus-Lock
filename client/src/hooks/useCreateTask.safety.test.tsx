import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { inspectOwnedDrafts, writeDraftSelection } from "../services/draftStore";
import { useCreateTask } from "./useCreateTask";
import { CreateTaskModal } from "../components/CreateTaskModal/CreateTaskModal";

const account = { id: "modal-alice", email: "modal-alice@example.com" };
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: 3, retryDelay: 0 } } });
  return (
    <AuthProvider>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </AuthProvider>
  );
}

describe("task creation through the public hook, account and storage boundaries", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it.each(["network", "server", "incomplete response"])(
    "retains the complete captured-account attempt before POST ($s) and blocks ordinary repeats after a lost response, including refresh",
    async (failure) => {
      const dispatchedSnapshots: unknown[] = [];
      const http = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        if (String(input).endsWith("/auth/me")) return response(account);
        if (init?.method === "POST") {
          dispatchedSnapshots.push(inspectOwnedDrafts(account.id).drafts);
          if (failure === "server") return response({ detail: "After commit" }, 503);
          if (failure === "incomplete response") return response({ id: "committed" }, 201);
          throw new TypeError("Response lost after commit");
        }
        throw new Error("Unexpected request");
      });
      const first = renderHook(() => ({ auth: useAuth(), create: useCreateTask() }), { wrapper });
      await waitFor(() => expect(first.result.current.auth.status).toBe("authenticated"));
      await act(async () => {
        await expect(
          first.result.current.create.mutateAsync({
            content: "original full body",
            lockIds: ["kept-lock"],
          })
        ).rejects.toMatchObject({ code: "create_outcome_unknown" });
      });
      expect(dispatchedSnapshots).toEqual([
        [
          expect.objectContaining({
            content: "original full body",
            lockIds: ["kept-lock"],
            taskId: null,
            creationUncertain: true,
            creationAttempt: { content: "original full body", lockIds: ["kept-lock"] },
          }),
        ],
      ]);
      expect(first.result.current.create.creationUncertain).toBe(true);
      await act(async () => {
        await expect(
          first.result.current.create.mutateAsync({ content: "ordinary second click" })
        ).rejects.toMatchObject({ code: "create_outcome_unknown" });
      });
      expect(http.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
      first.unmount();
      const refreshed = renderHook(() => ({ auth: useAuth(), create: useCreateTask() }), {
        wrapper,
      });
      await waitFor(() => expect(refreshed.result.current.auth.status).toBe("authenticated"));
      expect(refreshed.result.current.create.creationUncertain).toBe(true);
      expect(refreshed.result.current.create.pendingAttempt).toMatchObject({
        content: "original full body",
        lockIds: ["kept-lock"],
      });
      await act(async () => {
        await expect(
          refreshed.result.current.create.mutateAsync({ content: "after refresh" })
        ).rejects.toMatchObject({ code: "create_outcome_unknown" });
      });
      expect(http.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    }
  );

  it("rechecks all pages, offers candidates without adopting them, and keeps the editor selection intact", async () => {
    const records = Array.from({ length: 101 }, (_, i) => ({
      id: `remote-${i}`,
      title: `remote ${i}`,
      content: i === 100 ? "attempt body" : `other body ${i}`,
      lock_ids: i === 100 ? ["attempt-lock"] : [],
      version: 3,
      category: "WRITING",
      priority: "MEDIUM",
      due_date: null,
      word_count: 2,
      created_at: "2026-10-11T00:00:00Z",
      updated_at: "2026-10-11T00:00:00Z",
    }));
    const http = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (String(input).endsWith("/auth/me")) return response(account);
      if (init?.method === "POST") throw new TypeError("Lost acknowledgement");
      const url = new URL(String(input));
      if (url.pathname.endsWith("/remote-100")) return response(records[100]);
      const offset = Number(url.searchParams.get("offset"));
      return response({
        tasks: records.slice(offset, offset + 100),
        total: 101,
        limit: 100,
        offset,
      });
    });
    writeDraftSelection(account.id, "existing-editor-draft");
    const hook = renderHook(() => ({ auth: useAuth(), create: useCreateTask() }), { wrapper });
    await waitFor(() => expect(hook.result.current.auth.status).toBe("authenticated"));
    await act(async () => {
      await hook.result.current.create
        .mutateAsync({ content: "attempt body", lockIds: ["attempt-lock"] })
        .catch(() => undefined);
    });
    let candidates: unknown[] = [];
    await act(async () => {
      candidates = await hook.result.current.create.checkCreation();
    });
    expect(candidates).toEqual([records[100]]);
    expect(hook.result.current.create.creationUncertain).toBe(true);
    expect(inspectOwnedDrafts(account.id).drafts[0]?.taskId).toBeNull();
    const pages = http.mock.calls.filter(
      ([input]) => new URL(String(input)).pathname === "/tasks/"
    );
    expect(pages.map(([input]) => new URL(String(input)).searchParams.get("offset"))).toEqual([
      "0",
      "100",
    ]);
    let adopted: unknown;
    await act(async () => {
      adopted = await hook.result.current.create.adoptCreation("remote-100");
    });
    expect(adopted).toEqual(records[100]);
    expect(hook.result.current.create.creationUncertain).toBe(false);
    expect(inspectOwnedDrafts(account.id).drafts).toContainEqual(
      expect.objectContaining({
        content: "attempt body",
        lockIds: ["attempt-lock"],
        taskId: "remote-100",
        creationAttempt: { content: "attempt body", lockIds: ["attempt-lock"] },
      })
    );
    expect(sessionStorage.getItem(`impetus.selection.${account.id}.editor`)).toBe(
      "existing-editor-draft"
    );
    expect(http.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });

  it("shows the preserved modal attempt, prevents a second click after unknown creation, and requires explicit candidate selection", async () => {
    const committed = {
      id: "committed-modal",
      title: "Preserved task title",
      content: "Preserved task title",
      lock_ids: [],
      version: 0,
      category: "WRITING",
      priority: "MEDIUM",
      due_date: null,
      word_count: 3,
      created_at: "2026-10-11T00:00:00Z",
      updated_at: "2026-10-11T00:00:00Z",
    };
    const http = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (String(input).endsWith("/auth/me")) return response(account);
      if (init?.method === "POST") throw new TypeError("Committed but response lost");
      if (String(input).endsWith("/tasks/committed-modal")) return response(committed);
      return response({ tasks: [committed], total: 1, limit: 100, offset: 0 });
    });
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    const first = render(<CreateTaskModal open onClose={onClose} onSuccess={onSuccess} />, {
      wrapper,
    });
    await waitFor(() =>
      expect(http).toHaveBeenCalledWith(expect.stringContaining("/auth/me"), expect.anything())
    );
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Task Title *" }), {
      target: { value: "Preserved task title" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Task" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be confirmed");
    expect(screen.getByRole("button", { name: "Create Task" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Create Task" }));
    expect(http.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    expect(screen.getByLabelText("Attempted task content")).toHaveTextContent(
      "Preserved task title"
    );
    first.unmount();
    render(<CreateTaskModal open onClose={onClose} onSuccess={onSuccess} />, { wrapper });
    expect(await screen.findByLabelText("Attempted task content")).toHaveTextContent(
      "Preserved task title"
    );
    fireEvent.click(screen.getByRole("button", { name: "Recheck creation" }));
    expect(await screen.findByRole("button", { name: "Use task committed-modal" })).toBeEnabled();
    expect(onClose).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Use task committed-modal" }));
    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith({
        id: "committed-modal",
        title: "Preserved task title",
      })
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(http.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });

  it("sends no POST when browser storage cannot retain the body and locks, then retries the preserved form after recovery", async () => {
    const http = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) =>
        String(input).endsWith("/auth/me")
          ? response(account)
          : response(
              { id: "created", content: "kept memory", lock_ids: ["memory-lock"], version: 0 },
              201
            )
      );
    const hook = renderHook(() => ({ auth: useAuth(), create: useCreateTask() }), { wrapper });
    await waitFor(() => expect(hook.result.current.auth.status).toBe("authenticated"));
    const storage = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage full", "QuotaExceededError");
    });
    await act(async () => {
      await expect(
        hook.result.current.create.mutateAsync({ content: "kept memory", lockIds: ["memory-lock"] })
      ).rejects.toThrow("No creation request was sent");
    });
    expect(http.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
    expect(hook.result.current.create.creationUncertain).toBe(false);
    storage.mockRestore();
    await act(async () => {
      await hook.result.current.create.mutateAsync({
        content: "kept memory",
        lockIds: ["memory-lock"],
      });
    });
    expect(http.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    expect(inspectOwnedDrafts(account.id).drafts).toContainEqual(
      expect.objectContaining({
        content: "kept memory",
        lockIds: ["memory-lock"],
        taskId: "created",
      })
    );
  });

  it("blocks creation after a failed recovery read and lets the writer retry without changing the editor selection", async () => {
    const http = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) =>
        String(input).endsWith("/auth/me")
          ? response(account)
          : response({ id: "created", content: "body", lock_ids: [], version: 0 }, 201)
      );
    const read = vi.spyOn(Storage.prototype, "key").mockImplementation(() => {
      throw new DOMException("Storage unavailable", "SecurityError");
    });
    localStorage.setItem("retained-browser-data", "untouched");
    const hook = renderHook(() => ({ auth: useAuth(), create: useCreateTask() }), { wrapper });
    await waitFor(() => expect(hook.result.current.auth.status).toBe("authenticated"));
    expect(hook.result.current.create.recoveryReadFailed).toBe(true);
    await act(async () => {
      await expect(hook.result.current.create.mutateAsync({ content: "body" })).rejects.toThrow(
        "Retry recovery"
      );
    });
    expect(http.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
    read.mockRestore();
    act(() => hook.result.current.create.retryRecovery());
    expect(hook.result.current.create.recoveryReadFailed).toBe(false);
    expect(localStorage.getItem("retained-browser-data")).toBe("untouched");
    await act(async () => {
      await hook.result.current.create.mutateAsync({ content: "body" });
    });
    expect(http.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });

  it("keeps an empty recheck uncertain and creates a separate explicit copy without losing the earlier attempt", async () => {
    let posts = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (String(input).endsWith("/auth/me")) return response(account);
      if (init?.method === "POST") {
        posts += 1;
        if (posts === 1) throw new TypeError("Lost after commit");
        return response(
          { id: "explicit-copy", content: "different copy", lock_ids: ["copy-lock"], version: 0 },
          201
        );
      }
      return response({ tasks: [], total: 0, limit: 100, offset: 0 });
    });
    const hook = renderHook(() => ({ auth: useAuth(), create: useCreateTask() }), { wrapper });
    await waitFor(() => expect(hook.result.current.auth.status).toBe("authenticated"));
    await act(async () => {
      await hook.result.current.create
        .mutateAsync({ content: "uncertain source", lockIds: ["source-lock"] })
        .catch(() => undefined);
    });
    let candidates: unknown[] = ["unexpected"];
    await act(async () => {
      candidates = await hook.result.current.create.checkCreation();
    });
    expect(candidates).toEqual([]);
    expect(hook.result.current.create.creationUncertain).toBe(true);
    await act(async () => {
      await expect(
        hook.result.current.create.mutateAsync({ content: "accidental repeat" })
      ).rejects.toMatchObject({ code: "create_outcome_unknown" });
    });
    expect(posts).toBe(1);
    await act(async () => {
      await hook.result.current.create.mutateAsync({
        content: "different copy",
        lockIds: ["copy-lock"],
        allowDuplicate: true,
      });
    });
    const drafts = inspectOwnedDrafts(account.id).drafts;
    expect(drafts).toHaveLength(2);
    expect(new Set(drafts.map((draft) => draft.draftId)).size).toBe(2);
    expect(drafts).toContainEqual(
      expect.objectContaining({
        content: "uncertain source",
        lockIds: ["source-lock"],
        taskId: null,
        creationUncertain: true,
      })
    );
    expect(drafts).toContainEqual(
      expect.objectContaining({
        content: "different copy",
        lockIds: ["copy-lock"],
        taskId: "explicit-copy",
        creationUncertain: false,
      })
    );
    expect(posts).toBe(2);
    expect(hook.result.current.create.pendingAttempt).toMatchObject({
      content: "uncertain source",
      creationUncertain: true,
    });
    await act(async () => {
      await expect(
        hook.result.current.create.mutateAsync({ content: "uncertain source" })
      ).rejects.toMatchObject({ code: "create_outcome_unknown" });
    });
    expect(posts).toBe(2);
  });

  it("retains distinct attempt bodies when independent writers dispatch at the same time", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).endsWith("/auth/me")) return response(account);
      throw new TypeError("Responses lost");
    });
    const first = renderHook(() => ({ auth: useAuth(), create: useCreateTask() }), { wrapper });
    const second = renderHook(() => ({ auth: useAuth(), create: useCreateTask() }), { wrapper });
    await waitFor(() => expect(first.result.current.auth.status).toBe("authenticated"));
    await waitFor(() => expect(second.result.current.auth.status).toBe("authenticated"));
    await act(async () => {
      await Promise.all([
        first.result.current.create
          .mutateAsync({ content: "first tab", lockIds: ["first-lock"] })
          .catch(() => undefined),
        second.result.current.create
          .mutateAsync({ content: "second tab", lockIds: ["second-lock"] })
          .catch(() => undefined),
      ]);
    });
    const drafts = inspectOwnedDrafts(account.id).drafts;
    expect(drafts).toHaveLength(2);
    expect(new Set(drafts.map((draft) => draft.draftId)).size).toBe(2);
    expect(drafts).toContainEqual(
      expect.objectContaining({
        content: "first tab",
        lockIds: ["first-lock"],
        creationUncertain: true,
      })
    );
    expect(drafts).toContainEqual(
      expect.objectContaining({
        content: "second tab",
        lockIds: ["second-lock"],
        creationUncertain: true,
      })
    );
  });

  it("keeps a late account A outcome out of B while retaining A's complete unconfirmed attempt", async () => {
    const accountB = { id: "modal-bob", email: "modal-bob@example.com" };
    let finish!: (value: Response) => void;
    const delayed = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    const http = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).endsWith("/auth/me")) return response(account);
      if (String(input).endsWith("/auth/login")) return response({ user: accountB });
      return delayed;
    });
    const hook = renderHook(() => ({ auth: useAuth(), create: useCreateTask() }), { wrapper });
    await waitFor(() => expect(hook.result.current.auth.status).toBe("authenticated"));
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const onSettled = vi.fn();
    let request!: Promise<unknown>;
    act(() => {
      request = hook.result.current.create
        .mutateAsync(
          { content: "A unique body", lockIds: ["A-lock"] },
          { onSuccess, onError, onSettled }
        )
        .catch((error: unknown) => error);
    });
    await waitFor(() =>
      expect(http.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1)
    );
    await act(async () => {
      await hook.result.current.auth.login(accountB.email, "test-password");
    });
    await act(async () => {
      finish(response({ detail: "Committed but failed acknowledgement" }, 503));
    });
    expect(await request).toMatchObject({ code: "create_outcome_unknown" });
    expect(hook.result.current.auth.user).toEqual(accountB);
    expect(hook.result.current.create.error).toBeNull();
    expect(hook.result.current.create.creationUncertain).toBe(false);
    expect(hook.result.current.create.pendingAttempts).toEqual([]);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(onSettled).not.toHaveBeenCalled();
    expect(inspectOwnedDrafts(account.id).drafts).toContainEqual(
      expect.objectContaining({
        content: "A unique body",
        lockIds: ["A-lock"],
        taskId: null,
        creationUncertain: true,
      })
    );
    expect(inspectOwnedDrafts(accountB.id).drafts).toEqual([]);
  });

  it("does not offer a partially read or changed collection and rejects a candidate that changed after recheck", async () => {
    const task = {
      id: "matching",
      content: "original body",
      lock_ids: ["original-lock"],
      version: 0,
    };
    const records = [
      task,
      ...Array.from({ length: 100 }, (_, i) => ({
        ...task,
        id: `unrelated-${i}`,
        content: `unrelated ${i}`,
      })),
    ];
    let failSecond = true;
    let changedTask = false;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (String(input).endsWith("/auth/me")) return response(account);
      if (init?.method === "POST") throw new TypeError("Acknowledgement lost");
      const url = new URL(String(input));
      if (url.pathname.endsWith("/matching"))
        return response(changedTask ? { ...task, lock_ids: ["changed-lock"] } : task);
      const offset = Number(url.searchParams.get("offset"));
      if (offset === 100 && failSecond) return response({ detail: "Page failed" }, 503);
      return response({
        tasks: records.slice(offset, offset + 100),
        total: 101,
        limit: 100,
        offset,
      });
    });
    const hook = renderHook(() => ({ auth: useAuth(), create: useCreateTask() }), { wrapper });
    await waitFor(() => expect(hook.result.current.auth.status).toBe("authenticated"));
    await act(async () => {
      await hook.result.current.create
        .mutateAsync({ content: "original body", lockIds: ["original-lock"] })
        .catch(() => undefined);
    });
    await act(async () => {
      await expect(hook.result.current.create.checkCreation()).rejects.toThrow(
        "Failed to fetch tasks"
      );
    });
    await act(async () => {
      await expect(hook.result.current.create.adoptCreation("matching")).rejects.toThrow(
        "Recheck creation"
      );
    });
    expect(hook.result.current.create.creationUncertain).toBe(true);
    failSecond = false;
    await act(async () => {
      await hook.result.current.create.checkCreation();
    });
    changedTask = true;
    await act(async () => {
      await expect(hook.result.current.create.adoptCreation("matching")).rejects.toThrow(
        "selected task changed"
      );
    });
    expect(hook.result.current.create.creationUncertain).toBe(true);
    expect(inspectOwnedDrafts(account.id).drafts[0]).toMatchObject({
      content: "original body",
      lockIds: ["original-lock"],
      taskId: null,
      creationUncertain: true,
    });
  });

  it.each(["ordinary", "separate"])(
    "keeps the %s unsubmitted modal title during a same-account focus check and pauses remote actions",
    async (mode) => {
      let checks = 0;
      let finishCheck!: (value: Response) => void;
      const checked = new Promise<Response>((resolve) => {
        finishCheck = resolve;
      });
      const http = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        if (String(input).endsWith("/auth/me")) {
          checks += 1;
          return checks === 1 ? response(account) : checked;
        }
        throw new TypeError("Original attempted creation lost acknowledgement");
      });
      function ModalProbe() {
        const auth = useAuth();
        return (
          <>
            <p data-testid="modal-session">{auth.status}</p>
            <CreateTaskModal open onClose={() => undefined} />
          </>
        );
      }
      render(<ModalProbe />, { wrapper });
      await waitFor(() =>
        expect(screen.getByTestId("modal-session")).toHaveTextContent("authenticated")
      );
      const title = screen.getByRole("textbox", { name: "Task Title *" });
      if (mode === "separate") {
        fireEvent.change(title, { target: { value: "original attempted title" } });
        fireEvent.click(screen.getByRole("button", { name: "Create Task" }));
        await screen.findByText("Unconfirmed task creation");
        fireEvent.click(screen.getByRole("button", { name: "Create another task" }));
      }
      fireEvent.change(title, { target: { value: "unique newer title never dispatched" } });
      fireEvent(window, new Event("focus"));
      await waitFor(() =>
        expect(screen.getByTestId("modal-session")).toHaveTextContent("checking")
      );
      expect(title).toHaveValue("unique newer title never dispatched");
      expect(title).toBeEnabled();
      expect(
        screen.getByRole("button", {
          name: mode === "separate" ? "Create another task anyway" : "Create Task",
        })
      ).toBeDisabled();
      expect(inspectOwnedDrafts(account.id).drafts).toContainEqual(
        expect.objectContaining({
          content: "unique newer title never dispatched",
          taskId: null,
          dirty: true,
          recoveryOf: "create-task-modal-form",
        })
      );
      await act(async () => {
        finishCheck(response(account));
      });
      await waitFor(() =>
        expect(screen.getByTestId("modal-session")).toHaveTextContent("authenticated")
      );
      expect(title).toHaveValue("unique newer title never dispatched");
      expect(
        screen.getByRole("button", {
          name: mode === "separate" ? "Create another task anyway" : "Create Task",
        })
      ).toBeEnabled();
      expect(http.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(
        mode === "separate" ? 1 : 0
      );
    }
  );

  it("preserves account A's unsent modal input before switching and offers it only through explicit recovery when A returns", async () => {
    const bob = { id: "modal-bob", email: "modal-bob@example.com" };
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (String(input).endsWith("/auth/me")) return response(account);
      const data = JSON.parse(String(init?.body));
      return response({ user: data.email === bob.email ? bob : account });
    });
    function ModalProbe() {
      const auth = useAuth();
      return (
        <>
          <p data-testid="modal-owner">{auth.user?.id}</p>
          <button onClick={() => void auth.login(bob.email, "test-password")}>Switch to Bob</button>
          <button onClick={() => void auth.login(account.email, "test-password")}>
            Return to Alice
          </button>
          <CreateTaskModal open onClose={() => undefined} />
        </>
      );
    }
    render(<ModalProbe />, { wrapper });
    await waitFor(() => expect(screen.getByTestId("modal-owner")).toHaveTextContent(account.id));
    fireEvent.change(screen.getByRole("textbox", { name: "Task Title *" }), {
      target: { value: "Alice's unique unsent input" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Switch to Bob" }));
    await waitFor(() => expect(screen.getByTestId("modal-owner")).toHaveTextContent(bob.id));
    expect(screen.getByRole("textbox", { name: "Task Title *" })).toHaveValue("");
    expect(screen.queryByText("Alice's unique unsent input")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Restore unsubmitted title" })
    ).not.toBeInTheDocument();
    expect(inspectOwnedDrafts(account.id).drafts).toContainEqual(
      expect.objectContaining({
        content: "Alice's unique unsent input",
        taskId: null,
        dirty: true,
        recoveryOf: "create-task-modal-form",
      })
    );
    expect(inspectOwnedDrafts(bob.id).drafts).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Return to Alice" }));
    await waitFor(() => expect(screen.getByTestId("modal-owner")).toHaveTextContent(account.id));
    expect(screen.getByRole("textbox", { name: "Task Title *" })).toHaveValue("");
    fireEvent.click(await screen.findByRole("button", { name: "Restore unsubmitted title" }));
    expect(screen.getByRole("textbox", { name: "Task Title *" })).toHaveValue(
      "Alice's unique unsent input"
    );
  });

  it("keeps the only unsent modal input when preservation fails and refuses to replace its account", async () => {
    const bob = { id: "modal-bob", email: "modal-bob@example.com" };
    const http = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) =>
        String(input).endsWith("/auth/me") ? response(account) : response({ user: bob })
      );
    function ModalProbe() {
      const auth = useAuth();
      return (
        <>
          <p data-testid="modal-owner">
            {auth.user?.id} {auth.status}
          </p>
          <button
            onClick={() => void auth.login(bob.email, "test-password").catch(() => undefined)}
          >
            Switch to Bob
          </button>
          <CreateTaskModal open onClose={() => undefined} />
        </>
      );
    }
    render(<ModalProbe />, { wrapper });
    await waitFor(() =>
      expect(screen.getByTestId("modal-owner")).toHaveTextContent("authenticated")
    );
    const title = screen.getByRole("textbox", { name: "Task Title *" });
    fireEvent.change(title, { target: { value: "only unsent memory input" } });
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage full", "QuotaExceededError");
    });
    fireEvent.click(screen.getByRole("button", { name: "Switch to Bob" }));
    await waitFor(() =>
      expect(screen.getByTestId("modal-owner")).toHaveTextContent(`${account.id} check-error`)
    );
    expect(title).toHaveValue("only unsent memory input");
    expect(title).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "unsubmitted task title could not be saved"
    );
    expect(screen.getByRole("button", { name: "Create Task" })).toBeDisabled();
    expect(http.mock.calls.filter(([input]) => String(input).endsWith("/auth/login"))).toHaveLength(
      0
    );
    expect(http.mock.calls.filter(([input]) => String(input).endsWith("/tasks"))).toHaveLength(0);
    write.mockRestore();
    fireEvent.click(screen.getByRole("button", { name: "Switch to Bob" }));
    await waitFor(() =>
      expect(screen.getByTestId("modal-owner")).toHaveTextContent(`${bob.id} authenticated`)
    );
    expect(screen.getByRole("textbox", { name: "Task Title *" })).toHaveValue("");
    expect(inspectOwnedDrafts(account.id).drafts).toContainEqual(
      expect.objectContaining({
        content: "only unsent memory input",
        lockIds: [],
        recoveryOf: "create-task-modal-form",
      })
    );
  });

  it.each(["missing version", "negative version", "different id"])(
    "keeps the complete uncertain source when candidate adoption returns %s",
    async (failure) => {
      const complete = {
        id: "matching-original",
        content: "original full candidate body",
        lock_ids: ["original-lock"],
        version: 3,
      };
      const http = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        if (String(input).endsWith("/auth/me")) return response(account);
        if (init?.method === "POST") throw new TypeError("Creation acknowledgement lost");
        if (String(input).endsWith("/tasks/matching-original")) {
          if (failure === "missing version") {
            return response({
              id: complete.id,
              content: complete.content,
              lock_ids: complete.lock_ids,
            });
          }
          return response(
            failure === "different id"
              ? { ...complete, id: "different-task" }
              : { ...complete, version: -1 }
          );
        }
        return response({ tasks: [complete], total: 1, limit: 100, offset: 0 });
      });
      const hook = renderHook(() => ({ auth: useAuth(), create: useCreateTask() }), { wrapper });
      await waitFor(() => expect(hook.result.current.auth.status).toBe("authenticated"));
      await act(async () => {
        await hook.result.current.create
          .mutateAsync({ content: complete.content, lockIds: complete.lock_ids })
          .catch(() => undefined);
      });
      await act(async () => {
        await hook.result.current.create.checkCreation();
      });
      const preserved = inspectOwnedDrafts(account.id).drafts;
      await act(async () => {
        await expect(hook.result.current.create.adoptCreation(complete.id)).rejects.toMatchObject({
          code: "invalid_task_response",
        });
      });
      expect(hook.result.current.create.creationUncertain).toBe(true);
      expect(inspectOwnedDrafts(account.id).drafts).toEqual(preserved);
      expect(inspectOwnedDrafts(account.id).issues).toEqual([]);
      expect(preserved).toEqual([
        expect.objectContaining({
          content: complete.content,
          lockIds: complete.lock_ids,
          taskId: null,
          creationUncertain: true,
        }),
      ]);
      expect(http.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    }
  );
});
