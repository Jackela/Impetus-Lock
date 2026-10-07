import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const accountA = { id: "account-a", email: "a@example.com" };
const accountB = { id: "account-b", email: "b@example.com" };

it("waits for the server before authorizing a remote account session", async () => {
  const check = deferred<Response>();
  vi.spyOn(globalThis, "fetch").mockReturnValue(check.promise);
  const { result } = renderHook(() => useAuth(), { wrapper });

  expect(result.current.status).toBe("checking");
  expect(result.current.user).toBeNull();
  expect(result.current.remoteEnabled).toBe(false);
  expect(result.current.session).toBeNull();

  await act(async () => check.resolve(new Response(JSON.stringify(accountA))));

  expect(result.current.status).toBe("authenticated");
  expect(result.current.user).toEqual(accountA);
  expect(result.current.remoteEnabled).toBe(true);
  expect(result.current.session?.userId).toBe(accountA.id);
  expect(result.current.session?.isCurrent()).toBe(true);
});

it.each([401, 403, 500, "network"] as const)(
  "distinguishes rejected authentication from a failed session check (%s)",
  async (failure) => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    if (failure === "network") fetchSpy.mockRejectedValue(new Error("Network disconnected"));
    else fetchSpy.mockResolvedValue(new Response(null, { status: failure }));
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.status).toBe(failure === 401 ? "anonymous" : "check-error");
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.remoteEnabled).toBe(false);
    expect(result.current.session).toBeNull();
    if (failure !== 401) expect(result.current.error).toBeTruthy();
  }
);

it.each(["login", "register"] as const)(
  "%s keeps an anonymous form active and coalesces duplicate submissions until server confirmation",
  async (action) => {
    const submission = deferred<Response>();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockReturnValue(submission.promise);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("anonymous"));

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current[action](accountA.email, "test-password");
      second = result.current[action](accountA.email, "test-password");
    });

    expect(result.current.status).toBe("anonymous");
    expect(result.current.isLoading).toBe(true);
    expect(result.current.remoteEnabled).toBe(false);
    expect(
      fetchSpy.mock.calls.filter(([url]) => String(url).endsWith(`/auth/${action}`))
    ).toHaveLength(1);

    await act(async () => {
      submission.resolve(new Response(JSON.stringify({ user: accountA })));
      await Promise.all([first, second]);
    });

    expect(result.current.user).toEqual(accountA);
    expect(result.current.status).toBe("authenticated");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.session?.userId).toBe(accountA.id);
    expect(fetchSpy.mock.calls.filter(([url]) => String(url).endsWith("/auth/me"))).toHaveLength(1);
  }
);

it("snapshots current writing before synchronously pausing an expired remote session", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(accountA)));
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe("authenticated"));
  const session = result.current.session!;
  const generation = result.current.generation;
  const snapshot = vi.fn(() => {
    expect(session.isCurrent()).toBe(true);
    expect(session.signal.aborted).toBe(false);
  });
  const ignoredSnapshot = vi.fn();
  result.current.registerSnapshot(snapshot);
  const unsubscribe = result.current.registerSnapshot(ignoredSnapshot);
  unsubscribe();

  act(() => {
    session.onUnauthorized();
    expect(session.isCurrent()).toBe(false);
    expect(session.signal.aborted).toBe(true);
  });

  expect(snapshot).toHaveBeenCalledTimes(1);
  expect(ignoredSnapshot).not.toHaveBeenCalled();
  expect(result.current.status).toBe("expired");
  expect(result.current.user).toEqual(accountA);
  expect(result.current.isAuthenticated).toBe(false);
  expect(result.current.remoteEnabled).toBe(false);
  expect(result.current.session).toBeNull();
  expect(result.current.generation).toBeGreaterThan(generation);
});

it("pauses remote work while logout waits and hides the account only after HTTP 204", async () => {
  const logoutResponse = deferred<Response>();
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify(accountA)))
    .mockReturnValue(logoutResponse.promise);
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe("authenticated"));
  const session = result.current.session!;
  const snapshot = vi.fn(() => expect(session.isCurrent()).toBe(true));
  result.current.registerSnapshot(snapshot);

  let first!: Promise<void>;
  let second!: Promise<void>;
  act(() => {
    first = result.current.logout();
    second = result.current.logout();
    expect(session.isCurrent()).toBe(false);
    expect(session.signal.aborted).toBe(true);
  });

  expect(result.current.status).toBe("logging-out");
  expect(result.current.user).toEqual(accountA);
  expect(result.current.remoteEnabled).toBe(false);
  expect(result.current.session).toBeNull();
  expect(snapshot).toHaveBeenCalledTimes(1);
  expect(fetchSpy.mock.calls.filter(([url]) => String(url).endsWith("/auth/logout"))).toHaveLength(
    1
  );

  await act(async () => {
    logoutResponse.resolve(new Response(null, { status: 204 }));
    await Promise.all([first, second]);
  });

  expect(result.current.status).toBe("anonymous");
  expect(result.current.user).toBeNull();
  expect(result.current.isLoading).toBe(false);
});

it.each([200, 401, 403, 500, "network"] as const)(
  "keeps logout unconfirmed for %s and resumes only after a server session recheck",
  async (failure) => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(accountA)));
    if (failure === "network") fetchSpy.mockRejectedValueOnce(new Error("Network disconnected"));
    else fetchSpy.mockResolvedValueOnce(new Response(null, { status: failure }));
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(accountA)));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("authenticated"));
    const session = result.current.session!;

    await act(async () => {
      await expect(result.current.logout()).rejects.toThrow();
    });

    expect(result.current.status).toBe("logout-unconfirmed");
    expect(result.current.user).toEqual(accountA);
    expect(result.current.remoteEnabled).toBe(false);
    expect(result.current.error).toBeTruthy();
    expect(session.isCurrent()).toBe(false);

    await act(async () => result.current.recheck());

    expect(result.current.status).toBe("authenticated");
    expect(result.current.user).toEqual(accountA);
    expect(result.current.session).not.toBe(session);
    expect(result.current.session?.isCurrent()).toBe(true);
    expect(result.current.error).toBeNull();
  }
);

it("hides a retained account only when recheck confirms HTTP 401", async () => {
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify(accountA)))
    .mockResolvedValueOnce(new Response(null, { status: 401 }));
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe("authenticated"));
  act(() => result.current.session!.onUnauthorized());

  expect(result.current.user).toEqual(accountA);
  await act(async () => result.current.recheck());

  expect(result.current.status).toBe("anonymous");
  expect(result.current.user).toBeNull();
  expect(result.current.session).toBeNull();
});

it.each([200, 401] as const)(
  "ignores a late initial session check after account B signs in (HTTP %s)",
  async (lateStatus) => {
    const check = deferred<Response>();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockReturnValueOnce(check.promise)
      .mockResolvedValueOnce(new Response(JSON.stringify({ user: accountB })));
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => result.current.login(accountB.email, "test-password"));
    expect(result.current.user).toEqual(accountB);
    const sessionB = result.current.session;

    await act(async () =>
      check.resolve(
        new Response(lateStatus === 200 ? JSON.stringify(accountA) : null, { status: lateStatus })
      )
    );

    expect(result.current.user).toEqual(accountB);
    expect(result.current.status).toBe("authenticated");
    expect(result.current.session).toBe(sessionB);
    expect(result.current.session?.isCurrent()).toBe(true);
    expect(fetchSpy.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  }
);

it("does not let account A's delayed logout clear account B's confirmed session", async () => {
  const logoutResponse = deferred<Response>();
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify(accountA)))
    .mockReturnValueOnce(logoutResponse.promise)
    .mockResolvedValueOnce(new Response(JSON.stringify({ user: accountB })));
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe("authenticated"));
  const sessionA = result.current.session!;
  let logout!: Promise<void>;
  act(() => {
    logout = result.current.logout();
  });
  await act(async () => result.current.login(accountB.email, "test-password"));
  const sessionB = result.current.session;

  await act(async () => {
    logoutResponse.resolve(new Response(null, { status: 204 }));
    await logout;
    sessionA.onUnauthorized();
  });

  expect(result.current.status).toBe("authenticated");
  expect(result.current.user).toEqual(accountB);
  expect(result.current.session).toBe(sessionB);
  expect(sessionB?.isCurrent()).toBe(true);
});

it("pauses account A before a login can change the server cookie and ignores its late 401", async () => {
  const loginResponse = deferred<Response>();
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify(accountA)))
    .mockReturnValueOnce(loginResponse.promise);
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe("authenticated"));
  const sessionA = result.current.session!;
  const snapshot = vi.fn(() => expect(result.current.user).toEqual(accountA));
  result.current.registerSnapshot(snapshot);
  let login!: Promise<void>;

  act(() => {
    login = result.current.login(accountB.email, "test-password");
    expect(sessionA.isCurrent()).toBe(false);
    expect(sessionA.signal.aborted).toBe(true);
  });

  expect(result.current.user).toEqual(accountA);
  expect(result.current.status).toBe("checking");
  expect(result.current.session).toBeNull();
  expect(snapshot).toHaveBeenCalled();

  await act(async () => {
    loginResponse.resolve(new Response(JSON.stringify({ user: accountB })));
    await login;
    sessionA.onUnauthorized();
  });

  expect(result.current.user).toEqual(accountB);
  expect(result.current.status).toBe("authenticated");
  expect(result.current.session?.isCurrent()).toBe(true);
});

it("snapshots local edits made while account A is expired before displaying account B", async () => {
  const loginResponse = deferred<Response>();
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify(accountA)))
    .mockReturnValueOnce(loginResponse.promise);
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe("authenticated"));
  let content = "before expiry";
  const snapshots: string[] = [];
  result.current.registerSnapshot(() => {
    snapshots.push(content);
  });
  act(() => result.current.session!.onUnauthorized());
  content = "local edit while expired";
  let login!: Promise<void>;
  act(() => {
    login = result.current.login(accountB.email, "test-password");
  });
  content = "latest local edit while login waits";

  await act(async () => {
    loginResponse.resolve(new Response(JSON.stringify({ user: accountB })));
    await login;
  });

  expect(snapshots.at(-1)).toBe("latest local edit while login waits");
  expect(result.current.user).toEqual(accountB);
});

it("invalidates an authorized account session when its provider is removed", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(accountA)));
  const { result, unmount } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe("authenticated"));
  const session = result.current.session!;

  unmount();

  expect(session.signal.aborted).toBe(true);
  expect(session.isCurrent()).toBe(false);
});

it("blocks logout when a local snapshot fails and invalidates a previously pending recheck", async () => {
  const check = deferred<Response>();
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify(accountA)))
    .mockReturnValueOnce(check.promise);
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe("authenticated"));
  let failSnapshot = false;
  result.current.registerSnapshot(() => {
    if (failSnapshot) throw new Error("Storage unavailable");
  });
  const secondSnapshot = vi.fn();
  result.current.registerSnapshot(secondSnapshot);
  let recheck!: Promise<void>;
  act(() => {
    recheck = result.current.recheck();
  });
  failSnapshot = true;

  await act(async () => {
    await expect(result.current.logout()).rejects.toThrow("local draft");
  });

  expect(result.current.status).toBe("logout-unconfirmed");
  expect(result.current.user).toEqual(accountA);
  expect(result.current.error).toContain("local draft");
  expect(result.current.remoteEnabled).toBe(false);
  expect(secondSnapshot).toHaveBeenCalledTimes(2);
  expect(fetchSpy.mock.calls.filter(([url]) => String(url).endsWith("/auth/logout"))).toHaveLength(
    0
  );

  await act(async () => {
    check.resolve(new Response(null, { status: 401 }));
    await recheck;
  });

  expect(result.current.status).toBe("logout-unconfirmed");
  expect(result.current.user).toEqual(accountA);
});

it("still pauses a protected 401 when a local snapshot fails", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(accountA)));
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe("authenticated"));
  const session = result.current.session!;
  result.current.registerSnapshot(() => {
    throw new Error("Storage unavailable");
  });

  act(() => {
    expect(() => session.onUnauthorized()).not.toThrow();
  });

  expect(session.isCurrent()).toBe(false);
  expect(session.signal.aborted).toBe(true);
  expect(result.current.status).toBe("expired");
  expect(result.current.user).toEqual(accountA);
  expect(result.current.error).toContain("local draft");
});

it.each(["me", "login", "register"] as const)(
  "requires a valid server user ID before accepting a successful %s response",
  async (action) => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    if (action !== "me") fetchSpy.mockResolvedValueOnce(new Response(null, { status: 401 }));
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(action === "me" ? {} : { user: { email: accountA.email } }))
    );
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    if (action !== "me") {
      await act(async () => {
        await expect(result.current[action](accountA.email, "test-password")).rejects.toThrow();
      });
    }

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.remoteEnabled).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.error).toContain("account");
  }
);

it.each(["login", "register"] as const)(
  "keeps a paused account and explains an empty HTTP 403 %s failure",
  async (action) => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(accountA)))
      .mockResolvedValueOnce(new Response(null, { status: 403 }));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("authenticated"));
    act(() => result.current.session!.onUnauthorized());

    await act(async () => {
      await expect(result.current[action](accountA.email, "test-password")).rejects.toThrow(
        "HTTP 403"
      );
    });

    expect(result.current.status).toBe("expired");
    expect(result.current.user).toEqual(accountA);
    expect(result.current.remoteEnabled).toBe(false);
    expect(result.current.error).toContain("HTTP 403");
  }
);

it.each(["login", "register"] as const)(
  "ignores a superseded %s success or failure after another account is confirmed",
  async (action) => {
    const oldSubmission = deferred<Response>();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockReturnValueOnce(oldSubmission.promise)
      .mockResolvedValueOnce(new Response(JSON.stringify({ user: accountB })));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("anonymous"));
    let ignoredSubmission!: Promise<void>;
    let ignoredResult!: Promise<void>;
    act(() => {
      ignoredSubmission = result.current[action](accountA.email, "test-password");
      ignoredResult = ignoredSubmission.catch(() => undefined);
    });
    await act(async () =>
      result.current[action === "login" ? "register" : "login"](accountB.email, "test-password")
    );
    const sessionB = result.current.session;

    await act(async () => {
      if (action === "login")
        oldSubmission.resolve(new Response(JSON.stringify({ user: accountA })));
      else oldSubmission.reject(new Error("Old request disconnected"));
      await ignoredResult;
      await expect(ignoredSubmission).rejects.toThrow("superseded");
    });

    expect(result.current.user).toEqual(accountB);
    expect(result.current.status).toBe("authenticated");
    expect(result.current.session).toBe(sessionB);
    expect(result.current.error).toBeNull();
  }
);

afterEach(() => {
  document.cookie = "csrf_token=; max-age=0; path=/";
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

it("uses cookie credentials and current CSRF for auth actions without enabling UI", async () => {
  const user = { id: "r04-user", email: "r04@example.com" };
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (url) =>
      String(url).endsWith("/auth/logout")
        ? new Response(null, { status: 204 })
        : new Response(JSON.stringify({ ...user, user }))
    );
  const { result } = renderHook(() => useAuth(), {
    wrapper: ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>,
  });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(fetchSpy.mock.calls[0]?.[1]?.credentials).toBe("include");
  expect(new Headers(fetchSpy.mock.calls[0]?.[1]?.headers).has("X-CSRF-Token")).toBe(false);

  document.cookie = "csrf_token=r04-auth-csrf; path=/";
  for (const action of [result.current.login, result.current.register]) {
    await act(async () => action("r04@example.com", "test-password"));
    const options = fetchSpy.mock.lastCall?.[1];
    expect(options?.credentials).toBe("include");
    expect(new Headers(options?.headers).get("X-CSRF-Token")).toBe("r04-auth-csrf");
    expect(new Headers(options?.headers).get("Content-Type")).toBe("application/json");
    expect(options?.body).toBe(
      JSON.stringify({ email: "r04@example.com", password: "test-password" })
    );
  }
  document.cookie = "csrf_token=r04-logout-csrf; path=/";
  await act(async () => result.current.logout());
  const options = fetchSpy.mock.lastCall?.[1];
  expect(String(fetchSpy.mock.lastCall?.[0])).toContain("/auth/logout");
  expect(options?.credentials).toBe("include");
  expect(new Headers(options?.headers).get("X-CSRF-Token")).toBe("r04-logout-csrf");
  expect(result.current.isAuthenticated).toBe(false);
});
