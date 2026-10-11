import { afterEach, describe, expect, it, vi } from "vitest";
import { createTask, fetchTask, TaskAPIError } from "./taskClient";
import type { RemoteSession } from "./remoteSession";

afterEach(() => vi.unstubAllGlobals());

describe("task requests in a paused session", () => {
  it.each([
    { id: "requested", content: "preserved body", lock_ids: [] },
    { id: "requested", content: "preserved body", lock_ids: [], version: -1 },
    { id: "different-task", content: "preserved body", lock_ids: [], version: 0 },
  ])("does not confirm an incomplete or different task read: $id $version", async (body) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(body))
    );
    await expect(fetchTask("requested")).rejects.toMatchObject({ code: "invalid_task_response" });
  });
  it("retains an unknown creation when a success body arrives after the account changes", async () => {
    let current = true;
    let finishBody!: (value: unknown) => void;
    const session: RemoteSession = {
      userId: "account-a",
      generation: 1,
      signal: new AbortController().signal,
      isCurrent: () => current,
      onUnauthorized: vi.fn(),
    };
    const response = new Response("{}", { status: 201 });
    const readBody = vi
      .spyOn(response, "json")
      .mockImplementation(() => new Promise((resolve) => (finishBody = resolve)));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response)
    );
    const pending = createTask({ content: "A draft", lockIds: ["A-lock"] }, { session });
    await vi.waitFor(() => expect(readBody).toHaveBeenCalled());
    current = false;
    finishBody({ id: "committed-a-task", content: "A draft", lock_ids: ["A-lock"] });
    await expect(pending).rejects.toMatchObject({ code: "create_outcome_unknown" });
  });
  it("reports an unknown creation outcome when the connection drops after dispatch", async () => {
    const http = vi.fn<typeof fetch>(async () => {
      throw new TypeError("Connection lost after the server may have committed");
    });
    vi.stubGlobal("fetch", http);
    await expect(
      createTask({ content: "Only local copy", lockIds: ["preserved-lock"] })
    ).rejects.toMatchObject({
      name: "TaskCreationUnknownError",
      code: "create_outcome_unknown",
    });
    expect(http).toHaveBeenCalledOnce();
  });

  it.each([
    ["server failure", () => new Response("failure after possible commit", { status: 500 })],
    ["unreadable success", () => new Response("partial JSON", { status: 201 })],
    ["empty success object", () => Response.json({}, { status: 201 })],
    [
      "missing version",
      () => Response.json({ id: "created", content: "body", lock_ids: [] }, { status: 201 }),
    ],
    [
      "invalid lock metadata",
      () =>
        Response.json(
          { id: "created", content: "body", lock_ids: null, version: 0 },
          { status: 201 }
        ),
    ],
    [
      "invalid version",
      () =>
        Response.json(
          { id: "created", content: "body", lock_ids: [], version: -1 },
          { status: 201 }
        ),
    ],
  ] as const)("preserves an unknown create outcome for %s", async (_label, response) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response())
    );
    await expect(createTask({ content: "Preserve this draft" })).rejects.toMatchObject({
      name: "TaskCreationUnknownError",
      code: "create_outcome_unknown",
    });
  });

  it("keeps a late dispatched create uncertain after its account is replaced", async () => {
    let current = true;
    let finish!: (response: Response) => void;
    const session: RemoteSession = {
      userId: "account-a",
      generation: 1,
      signal: new AbortController().signal,
      isCurrent: () => current,
      onUnauthorized: vi.fn(),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((resolve) => (finish = resolve)))
    );
    const pending = createTask({ content: "A original", lockIds: ["A-lock"] }, { session });
    current = false;
    finish(
      Response.json(
        { id: "committed-a-task", content: "A original", lock_ids: ["A-lock"] },
        { status: 201 }
      )
    );
    await expect(pending).rejects.toMatchObject({ code: "create_outcome_unknown" });
  });

  it.each([401, 403, 422, 429])("retains an explicit create rejection (%i)", async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ detail: "rejected" }, { status }))
    );
    await expect(createTask({ content: "Not committed" })).rejects.toMatchObject({
      name: "TaskAPIError",
      status,
    });
  });

  it("preserves a normal task version conflict without pausing the account", async () => {
    const mismatch = vi.fn();
    const session: RemoteSession = {
      userId: "account-a",
      generation: 1,
      signal: new AbortController().signal,
      isCurrent: () => true,
      onUnauthorized: vi.fn(),
      onAccountMismatch: mismatch,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ detail: "Version mismatch" }, { status: 409 }))
    );
    await expect(fetchTask("task-a", { session })).rejects.toBeInstanceOf(TaskAPIError);
    expect(mismatch).not.toHaveBeenCalled();
  });
  it("sends the captured account with protected writes when the browser cookie changes", async () => {
    document.cookie = "csrf_token=account-b-csrf; path=/";
    const http = vi.fn<typeof fetch>(async () =>
      Response.json({
        id: "created-task",
        content: "A private draft",
        lock_ids: ["A-lock"],
        version: 0,
      })
    );
    vi.stubGlobal("fetch", http);
    const session: RemoteSession = {
      userId: "account-a",
      generation: 1,
      signal: new AbortController().signal,
      isCurrent: () => true,
      onUnauthorized: vi.fn(),
    };
    await createTask({ content: "A private draft", lockIds: ["A-lock"] }, { session });
    const headers = new Headers(http.mock.calls[0]?.[1]?.headers);
    expect(headers.get("X-Expected-User-ID")).toBe("account-a");
    expect(headers.get("X-CSRF-Token")).toBe("account-b-csrf");
    document.cookie = "csrf_token=; max-age=0; path=/";
  });

  it("does not send a protected task request while remote work is paused", async () => {
    const http = vi.fn<typeof fetch>(async () =>
      Response.json({ id: "other-task", content: "remote content", lock_ids: [], version: 1 })
    );
    vi.stubGlobal("fetch", http);
    await expect(fetchTask("other-task", { session: null })).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(http).not.toHaveBeenCalled();
  });

  it("pauses only the captured account on a mismatch without treating it as a version conflict", async () => {
    const mismatch = vi.fn();
    const unauthorized = vi.fn();
    const session: RemoteSession = {
      userId: "account-a",
      generation: 1,
      signal: new AbortController().signal,
      isCurrent: () => true,
      onUnauthorized: unauthorized,
      onAccountMismatch: mismatch,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ code: "account_mismatch" }, { status: 409 }))
    );
    await expect(createTask({ content: "A private draft" }, { session })).rejects.toMatchObject({
      name: "RemoteAccountMismatchError",
      code: "account_mismatch",
    });
    expect(mismatch).toHaveBeenCalledOnce();
    expect(unauthorized).not.toHaveBeenCalled();
  });

  it("does not create a task after the captured account has been replaced", async () => {
    const http = vi.fn<typeof fetch>(async () => Response.json({ id: "wrong-account-task" }));
    vi.stubGlobal("fetch", http);
    const session: RemoteSession = {
      userId: "account-a",
      generation: 1,
      signal: new AbortController().signal,
      isCurrent: () => false,
      onUnauthorized: vi.fn(),
    };
    await expect(createTask({ content: "A private draft" }, { session })).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(http).not.toHaveBeenCalled();
  });

  it.each([401, 403])(
    "distinguishes a protected %i response before parsing a body",
    async (status) => {
      const expired = vi.fn();
      const session: RemoteSession = {
        userId: "account-a",
        generation: 1,
        signal: new AbortController().signal,
        isCurrent: () => true,
        onUnauthorized: expired,
      };
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("failure", { status }))
      );
      await expect(fetchTask("owned-task", { session })).rejects.toBeInstanceOf(TaskAPIError);
      expect(expired).toHaveBeenCalledTimes(status === 401 ? 1 : 0);
    }
  );

  it("rejects an old response rather than returning it to the next account", async () => {
    let current = true;
    let finish!: (response: Response) => void;
    const session: RemoteSession = {
      userId: "account-a",
      generation: 1,
      signal: new AbortController().signal,
      isCurrent: () => current,
      onUnauthorized: vi.fn(),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          })
      )
    );
    const request = fetchTask("owned-task", { session });
    current = false;
    finish(Response.json({ id: "owned-task", content: "A content", version: 1, lock_ids: [] }));
    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });
});
