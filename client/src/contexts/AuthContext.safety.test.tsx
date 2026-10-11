import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;
const account = { id: "account-a", email: "a@example.com" };

afterEach(() => {
  localStorage.removeItem("impetus.auth.pending");
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

it("preserves the latest body and locks written while the server confirms sign out", async () => {
  let confirm!: (response: Response) => void;
  const response = new Promise<Response>((resolve) => {
    confirm = resolve;
  });
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify(account)))
    .mockReturnValueOnce(response);
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe("authenticated"));
  let current = { content: "Before sign out", locks: ["lock-before"] };
  let retained: typeof current | null = null;
  result.current.registerSnapshot(() => {
    retained = { content: current.content, locks: [...current.locks] };
  });
  let signingOut!: Promise<void>;
  act(() => {
    signingOut = result.current.logout();
  });
  expect(result.current.user).toEqual(account);
  current = { content: "Latest writing while sign out waits", locks: ["lock-before", "lock-new"] };
  await act(async () => {
    confirm(new Response(null, { status: 204 }));
    await signingOut;
  });
  expect(retained).toEqual({
    content: "Latest writing while sign out waits",
    locks: ["lock-before", "lock-new"],
  });
  expect(result.current.user).toBeNull();
  expect(result.current.status).toBe("anonymous");
});

it("keeps the only memory draft when final preservation fails after the server has signed out", async () => {
  let confirm!: (response: Response) => void;
  const response = new Promise<Response>((resolve) => {
    confirm = resolve;
  });
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify(account)))
    .mockReturnValueOnce(response);
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe("authenticated"));
  let content = "Initially recoverable";
  let rejectStorage = false;
  result.current.registerSnapshot(() => {
    if (rejectStorage) throw new Error("Storage full");
  });
  let signingOut!: Promise<void>;
  act(() => {
    signingOut = result.current.logout();
  });
  content = "The only latest memory draft";
  rejectStorage = true;
  await act(async () => {
    confirm(new Response(null, { status: 204 }));
    await expect(signingOut).rejects.toThrow("signed out");
  });
  expect(result.current.user).toEqual(account);
  expect(result.current.status).toBe("signed-out-local-error");
  expect(result.current.remoteEnabled).toBe(false);
  expect(result.current.error).toContain("Keep this page open");
  expect(content).toBe("The only latest memory draft");
});

it("does not remove local writing when a delayed session check confirms 401 and storage now fails", async () => {
  let confirm!: (response: Response) => void;
  const response = new Promise<Response>((resolve) => {
    confirm = resolve;
  });
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify(account)))
    .mockReturnValueOnce(response);
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe("authenticated"));
  let rejectStorage = false;
  result.current.registerSnapshot(() => {
    if (rejectStorage) throw new Error("Storage unavailable");
  });
  let checking!: Promise<void>;
  act(() => {
    checking = result.current.recheck();
  });
  rejectStorage = true;
  await act(async () => {
    confirm(new Response(null, { status: 401 }));
    await checking;
  });
  expect(result.current.user).toEqual(account);
  expect(result.current.remoteEnabled).toBe(false);
  expect(result.current.status).toBe("signed-out-local-error");
  expect(result.current.error).toContain("Keep this page open");
});

it("does not send an authentication write when this browser cannot coordinate other tabs", async () => {
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify(account)))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe("authenticated"));
  vi.spyOn(navigator, "locks", "get").mockReturnValue(undefined as unknown as LockManager);
  await act(async () => {
    await expect(result.current.logout()).rejects.toThrow("browser");
  });
  expect(fetchSpy.mock.calls.filter(([url]) => String(url).endsWith("/auth/logout"))).toHaveLength(
    0
  );
  expect(result.current.user).toEqual(account);
  expect(result.current.remoteEnabled).toBe(false);
  expect(result.current.error).toContain("private window");
});

it("does not overwrite cookies after an abandoned authentication response remains unconfirmed", async () => {
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ user: account })));
  localStorage.setItem("impetus.auth.pending", JSON.stringify({ id: "closed-page-request" }));
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe("anonymous"));
  await act(async () => {
    await expect(result.current.login(account.email, "test-password")).rejects.toThrow(
      "could not be confirmed"
    );
  });
  expect(fetchSpy.mock.calls.filter(([url]) => String(url).endsWith("/auth/login"))).toHaveLength(
    0
  );
  expect(localStorage.getItem("impetus.auth.pending")).toContain("closed-page-request");
  expect(result.current.remoteEnabled).toBe(false);
});

it("sends sign out with the retained account even after its remote session is paused", async () => {
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify(account)))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe("authenticated"));
  await act(async () => result.current.logout());
  const [, init] = fetchSpy.mock.calls.find(([url]) => String(url).endsWith("/auth/logout"))!;
  expect(new Headers(init?.headers).get("X-Expected-User-ID")).toBe(account.id);
  expect(result.current.status).toBe("anonymous");
});

it("preserves this account's latest draft and pauses when shared cookies belong to another account", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(account)));
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe("authenticated"));
  let retained: { content: string; locks: string[] } | null = null;
  result.current.registerSnapshot(() => {
    retained = { content: "Account A latest writing", locks: ["lock-a"] };
  });
  const session = result.current.session!;
  act(() => session.onAccountMismatch?.());
  expect(result.current.status).toBe("check-error");
  expect(result.current.remoteEnabled).toBe(false);
  expect(result.current.user).toEqual(account);
  expect(session.signal.aborted).toBe(true);
  expect(retained).toEqual({ content: "Account A latest writing", locks: ["lock-a"] });
  expect(result.current.error).toContain("another account");
});

it("pauses and preserves writing when another tab starts changing the shared session", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(account)));
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe("authenticated"));
  let retained = "";
  result.current.registerSnapshot(() => {
    retained = "Latest writing before the other tab changes cookies";
  });
  act(() => {
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "impetus.auth.pending",
        newValue: JSON.stringify({ id: "other-request", source: "other-tab" }),
      })
    );
  });
  expect(result.current.remoteEnabled).toBe(false);
  expect(result.current.user).toEqual(account);
  expect(retained).toBe("Latest writing before the other tab changes cookies");
  expect(result.current.error).toContain("another tab");
});

it("preserves the previous account before checking the server when this tab regains focus", async () => {
  const nextAccount = { id: "account-b", email: "b@example.com" };
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify(account)))
    .mockResolvedValueOnce(new Response(JSON.stringify(nextAccount)));
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe("authenticated"));
  let retained = "";
  result.current.registerSnapshot(() => {
    retained = "Previous account writing before focus check";
  });
  act(() => window.dispatchEvent(new Event("focus")));
  await waitFor(() => expect(result.current.user).toEqual(nextAccount));
  expect(retained).toBe("Previous account writing before focus check");
  expect(result.current.session?.userId).toBe(nextAccount.id);
});

it("retains writing and does not dispatch sign out if the authentication checkpoint cannot be written", async () => {
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify(account)));
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe("authenticated"));
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Storage full");
  });
  await act(async () => {
    await expect(result.current.logout()).rejects.toThrow("Keep this page open");
  });
  expect(fetchSpy.mock.calls.filter(([url]) => String(url).endsWith("/auth/logout"))).toHaveLength(
    0
  );
  expect(result.current.user).toEqual(account);
  expect(result.current.remoteEnabled).toBe(false);
});

it("settles a dispatched cookie response before a superseding login and reads the latest CSRF cookie", async () => {
  let confirmFirst!: (response: Response) => void;
  const firstResponse = new Promise<Response>((resolve) => {
    confirmFirst = resolve;
  });
  const accountB = { id: "account-b", email: "b@example.com" };
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockReturnValueOnce(firstResponse)
    .mockResolvedValueOnce(new Response(JSON.stringify({ user: accountB })));
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe("anonymous"));
  let first!: Promise<void>;
  let ignored!: Promise<void>;
  act(() => {
    first = result.current.login(account.email, "test-password");
    ignored = first.catch(() => {});
  });
  await waitFor(() => expect(fetchSpy.mock.calls).toHaveLength(2));
  let second!: Promise<void>;
  act(() => {
    second = result.current.register(accountB.email, "test-password");
  });
  expect(fetchSpy.mock.calls).toHaveLength(2);
  expect(fetchSpy.mock.calls[1]?.[1]?.signal).toBeUndefined();
  document.cookie = "csrf_token=late-first-response; path=/";
  await act(async () => {
    confirmFirst(new Response(JSON.stringify({ user: account })));
    await ignored;
    await expect(first).rejects.toThrow("superseded");
    await second;
  });
  expect(new Headers(fetchSpy.mock.calls[2]?.[1]?.headers).get("X-CSRF-Token")).toBe(
    "late-first-response"
  );
  expect(result.current.user).toEqual(accountB);
  expect(localStorage.getItem("impetus.auth.pending")).toBeNull();
});
