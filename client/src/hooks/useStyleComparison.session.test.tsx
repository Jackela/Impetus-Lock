import type { ReactNode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { useStyleComparison } from "./useStyleComparison";
import type { StyleHistoryRecord } from "../services/api/styleHistoryClient";

const account = { id: "account-a", email: "a@example.com" };
const first: StyleHistoryRecord = {
  id: "first",
  user_id: account.id,
  text: "first",
  style_vector: { vocab_richness: 0.5 },
  created_at: "2026-10-09",
};
const second = { ...first, id: "second" };
const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("expires the real auth context when a comparison returns401", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (input) =>
      String(input).endsWith("/auth/me")
        ? Response.json(account)
        : Response.json({ message: "expired" }, { status: 401 })
    )
  );
  const { result } = renderHook(() => ({ auth: useAuth(), comparison: useStyleComparison() }), {
    wrapper,
  });
  await waitFor(() => expect(result.current.auth.remoteEnabled).toBe(true));
  act(() => {
    result.current.comparison.selectFirstStyle(first);
    result.current.comparison.selectSecondStyle(second);
  });
  await act(async () => {
    expect(await result.current.comparison.performComparison()).toBe(false);
  });
  expect(result.current.auth.status).toBe("expired");
  expect(result.current.comparison.comparisonResult).toBeNull();
  expect(result.current.comparison.loading).toBe(false);
});

it("keeps a delayed comparison from crossing same-account reauthentication", async () => {
  let finish!: (response: Response) => void;
  const http = vi.fn<typeof fetch>(async (input) => {
    if (String(input).endsWith("/style/compare"))
      return new Promise((resolve) => {
        finish = resolve;
      });
    return String(input).endsWith("/auth/login")
      ? Response.json({ user: account })
      : Response.json(account);
  });
  vi.stubGlobal("fetch", http);
  const { result } = renderHook(() => ({ auth: useAuth(), comparison: useStyleComparison() }), {
    wrapper,
  });
  await waitFor(() => expect(result.current.auth.remoteEnabled).toBe(true));
  act(() => {
    result.current.comparison.selectFirstStyle(first);
    result.current.comparison.selectSecondStyle(second);
  });
  let pending!: Promise<boolean>;
  act(() => {
    pending = result.current.comparison.performComparison();
  });
  await waitFor(() => expect(finish).toBeTypeOf("function"));
  act(() => result.current.auth.session?.onUnauthorized());
  await act(async () => result.current.auth.login(account.email, "controlled-password"));
  expect(result.current.auth.remoteEnabled).toBe(true);
  await act(async () => {
    finish(Response.json({ similarity_score: 1 }));
    expect(await pending).toBe(false);
  });
  expect(result.current.comparison.comparisonResult).toBeNull();
  expect(result.current.comparison.loading).toBe(false);
});

it("preserves the standalone comparison contract without an auth provider", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async () => Response.json({ similarity_score: 0.5 }))
  );
  const { result } = renderHook(() => useStyleComparison());
  act(() => {
    result.current.selectFirstStyle(first);
    result.current.selectSecondStyle(second);
  });
  await act(async () => {
    expect(await result.current.performComparison()).toBe(true);
  });
  expect(result.current.comparisonResult?.similarity_score).toBe(0.5);
});
