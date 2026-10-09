import { afterEach, describe, expect, it, vi } from "vitest";
import { createTask, fetchTask, TaskAPIError } from "./taskClient";
import type { RemoteSession } from "./remoteSession";

afterEach(() => vi.unstubAllGlobals());

describe("task requests in a paused session", () => {
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
