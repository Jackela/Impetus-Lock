import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

afterEach(() => {
  document.cookie = "csrf_token=; max-age=0; path=/";
  vi.restoreAllMocks();
});

it("uses cookie credentials and current CSRF for auth actions without enabling UI", async () => {
  const user = { id: "r04-user", email: "r04@example.com" };
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => new Response(JSON.stringify({ ...user, user })));
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
