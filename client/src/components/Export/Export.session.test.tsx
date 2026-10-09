import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../../contexts/AuthContext";
import { Export } from "./Export";

const accountA = { id: "export-account-a", email: "export-a@example.com" };
const accountB = { id: "export-account-b", email: "export-b@example.com" };
const tasks = {
  tasks: [
    {
      id: "task-a",
      title: "Account A writing",
      content: "Account A private text",
      lock_ids: ["lock-a"],
      version: 2,
      created_at: "2026-10-07T00:00:00Z",
      updated_at: "2026-10-07T00:00:00Z",
    },
  ],
  total: 1,
  limit: 100,
  offset: 0,
};
const stats = {
  total_tasks: 1,
  total_muse_interventions: 2,
  total_loki_interventions: 3,
  total_locks_created: 1,
  writing_minutes: 10,
  last_activity_at: null,
};
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}
function AccountControls() {
  const auth = useAuth();
  return (
    <>
      <output aria-label="Account state">
        {auth.status}:{auth.user?.id ?? "none"}
      </output>
      <button onClick={() => auth.session?.onUnauthorized()}>Pause account</button>
      <button
        onClick={() => {
          void auth.login(accountB.email, "test-password").catch(() => undefined);
        }}
      >
        Sign in as B
      </button>
    </>
  );
}
function AccountExport({ removable = false }: { removable?: boolean }) {
  const [shown, setShown] = useState(true);
  return (
    <AuthProvider>
      <AccountControls />
      {removable && <button onClick={() => setShown(false)}>Remove export panel</button>}
      {shown && <Export />}
    </AuthProvider>
  );
}
const createObjectURL = vi.fn<(blob: Blob | MediaSource) => string>(() => "blob:account-export");
const revokeObjectURL = vi.fn();
beforeEach(() => {
  class ExportURL extends URL {
    static override createObjectURL = createObjectURL;
    static override revokeObjectURL = revokeObjectURL;
  }
  vi.stubGlobal("URL", ExportURL);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

it("disables account export during identity checking and when anonymous without protected requests", async () => {
  const check = deferred<Response>();
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockReturnValue(check.promise);
  render(<AccountExport />);

  expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Export" }));
  expect(fetchSpy.mock.calls.filter(([url]) => !String(url).includes("/auth/"))).toHaveLength(0);
  await act(async () => check.resolve(new Response(null, { status: 401 })));
  expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Export" }));
  expect(fetchSpy.mock.calls.filter(([url]) => !String(url).includes("/auth/"))).toHaveLength(0);
  expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
});

it("downloads the current account's JSON using its captured session for both requests", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    const path = new URL(String(url)).pathname;
    return response(path === "/auth/me" ? accountA : path === "/stats/" ? stats : tasks);
  });
  render(<AccountExport />);
  await waitFor(() =>
    expect(screen.getByLabelText("Account state")).toHaveTextContent(
      "authenticated:export-account-a"
    )
  );
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "json" } });
  fireEvent.click(screen.getByRole("button", { name: "Export" }));
  await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1));

  const protectedRequests = fetchSpy.mock.calls.filter(([url]) => !String(url).includes("/auth/"));
  expect(protectedRequests).toHaveLength(2);
  for (const [, options] of protectedRequests) {
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(options?.credentials).toBe("include");
  }
  const blob = createObjectURL.mock.calls[0]?.[0];
  expect(blob).toBeInstanceOf(Blob);
  if (!(blob instanceof Blob)) throw new Error("Expected a downloaded Blob");
  const data = JSON.parse(await readBlob(blob));
  expect(data.tasks.tasks[0].content).toBe("Account A private text");
  expect(data.tasks.tasks[0].lock_ids).toEqual(["lock-a"]);
  expect(data.stats.writing_minutes).toBe(10);
  expect(vi.mocked(HTMLAnchorElement.prototype.click).mock.contexts[0]).toMatchObject({
    download: expect.stringMatching(/\.json$/),
  });
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:account-export");
});

it("does not download a delayed export after its panel is removed while the account stays valid", async () => {
  const body = deferred<unknown>();
  const taskResponse = response(null);
  vi.spyOn(taskResponse, "json").mockReturnValue(body.promise);
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    const path = new URL(String(url)).pathname;
    return path === "/auth/me"
      ? response(accountA)
      : path === "/stats/"
        ? response(stats)
        : taskResponse;
  });
  render(<AccountExport removable />);
  await waitFor(() =>
    expect(screen.getByLabelText("Account state")).toHaveTextContent(
      "authenticated:export-account-a"
    )
  );
  fireEvent.click(screen.getByRole("button", { name: "Export" }));
  await waitFor(() =>
    expect(fetchSpy.mock.calls.filter(([url]) => !String(url).includes("/auth/"))).toHaveLength(2)
  );
  const protectedRequests = fetchSpy.mock.calls.filter(([url]) => !String(url).includes("/auth/"));

  fireEvent.click(screen.getByRole("button", { name: "Remove export panel" }));
  await act(async () => body.resolve(tasks));

  expect(screen.getByLabelText("Account state")).toHaveTextContent(
    "authenticated:export-account-a"
  );
  expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  expect(createObjectURL).not.toHaveBeenCalled();
  for (const [, options] of protectedRequests) expect(options?.signal?.aborted).toBe(true);
});

it("keeps account A's delayed export out of B and lets B export its own data", async () => {
  const oldBody = deferred<unknown>();
  const oldResponse = response(null);
  vi.spyOn(oldResponse, "json").mockReturnValue(oldBody.promise);
  let signedInAsB = false;
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    const path = new URL(String(url)).pathname;
    if (path === "/auth/me") return response(accountA);
    if (path === "/auth/login") {
      signedInAsB = true;
      return response({ user: accountB });
    }
    if (path === "/stats/") return response(stats);
    return signedInAsB
      ? response({
          ...tasks,
          tasks: [
            {
              ...tasks.tasks[0],
              id: "task-b",
              title: "Account B writing",
              content: "Account B private text",
              lock_ids: ["lock-b"],
            },
          ],
        })
      : oldResponse;
  });
  render(<AccountExport />);
  await waitFor(() =>
    expect(screen.getByLabelText("Account state")).toHaveTextContent(
      "authenticated:export-account-a"
    )
  );
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "json" } });
  fireEvent.click(screen.getByRole("button", { name: "Export" }));
  await waitFor(() =>
    expect(fetchSpy.mock.calls.filter(([url]) => !String(url).includes("/auth/"))).toHaveLength(2)
  );
  fireEvent.click(screen.getByRole("button", { name: "Sign in as B" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Account state")).toHaveTextContent(
      "authenticated:export-account-b"
    )
  );

  expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Export" }));
  await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1));
  await act(async () => oldBody.resolve(tasks));

  expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  expect(createObjectURL).toHaveBeenCalledTimes(1);
  const blob = createObjectURL.mock.calls[0]?.[0];
  if (!(blob instanceof Blob)) throw new Error("Expected B's downloaded Blob");
  const content = await readBlob(blob);
  expect(content).toContain("Account B private text");
  expect(content).not.toContain("Account A private text");
  expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();
});

it.each([
  ["/tasks/", 403],
  ["/stats/", 403],
  ["/tasks/", "network"],
  ["/stats/", "network"],
] as const)(
  "shows %s %s failure without expiring the account or downloading",
  async (failurePath, failure) => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const path = new URL(String(url)).pathname;
      if (path === "/auth/me") return response(accountA);
      if (path === failurePath) {
        if (failure === "network") throw new Error("Network disconnected");
        return response({ detail: "Forbidden" }, failure);
      }
      return response(path === "/stats/" ? stats : tasks);
    });
    render(<AccountExport />);
    await waitFor(() =>
      expect(screen.getByLabelText("Account state")).toHaveTextContent(
        "authenticated:export-account-a"
      )
    );
    fireEvent.click(screen.getByRole("button", { name: "Export" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(failure === "network" ? "Network disconnected" : "HTTP 403");
    expect(screen.getByLabelText("Account state")).toHaveTextContent(
      "authenticated:export-account-a"
    );
    expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(
      fetchSpy.mock.calls.filter(([url]) => new URL(String(url)).pathname === failurePath)
    ).toHaveLength(1);
  }
);

it.each(["/tasks/", "/stats/"] as const)(
  "pauses account export on %s HTTP 401 and refuses further requests",
  async (failurePath) => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const path = new URL(String(url)).pathname;
      if (path === "/auth/me") return response(accountA);
      if (path === failurePath) return response({ detail: "Session expired" }, 401);
      return response(path === "/stats/" ? stats : tasks);
    });
    render(<AccountExport />);
    await waitFor(() =>
      expect(screen.getByLabelText("Account state")).toHaveTextContent(
        "authenticated:export-account-a"
      )
    );
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Account state")).toHaveTextContent("expired:export-account-a")
    );
    const protectedCount = fetchSpy.mock.calls.filter(
      ([url]) => !String(url).includes("/auth/")
    ).length;

    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Export" }));

    expect(fetchSpy.mock.calls.filter(([url]) => !String(url).includes("/auth/"))).toHaveLength(
      protectedCount
    );
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  }
);

it("retains standalone Markdown export without an authentication provider", async () => {
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (url) =>
      response(new URL(String(url)).pathname === "/stats/" ? stats : tasks)
    );
  render(<Export />);
  fireEvent.click(screen.getByRole("button", { name: "Export" }));
  await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1));

  const blob = createObjectURL.mock.calls[0]?.[0];
  if (!(blob instanceof Blob)) throw new Error("Expected a Markdown Blob");
  const content = await readBlob(blob);
  expect(content).toContain("### Account A writing");
  expect(content).toContain("Account A private text");
  expect(content).toContain("- Writing Minutes: 10");
  expect(vi.mocked(HTMLAnchorElement.prototype.click).mock.contexts[0]).toMatchObject({
    download: expect.stringMatching(/\.md$/),
  });
  expect(fetchSpy.mock.calls.some(([url]) => String(url).includes("/auth/"))).toBe(false);
});
