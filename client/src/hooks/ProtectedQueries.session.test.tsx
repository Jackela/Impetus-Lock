import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { useTasks } from "./useTasks";
import { useStats } from "./useStats";
import { useAchievements } from "./useAchievements";
import { useCreateTask } from "./useCreateTask";
import { useStyleLearning } from "./useStyleLearning";

const accountA = { id: "query-account-a", email: "query-a@example.com" };
const accountB = { id: "query-account-b", email: "query-b@example.com" };
const task = (id: string) => ({
  id,
  content: `writing ${id}`,
  lock_ids: [],
  version: 1,
  created_at: "2026-10-07T00:00:00Z",
  updated_at: "2026-10-07T00:00:00Z",
});
const taskList = (id: string) => ({ tasks: [task(id)], total: 1, limit: 100, offset: 0 });
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
function delayedBody(data: unknown) {
  const body = deferred<unknown>();
  const httpResponse = response(null);
  vi.spyOn(httpResponse, "json").mockReturnValue(body.promise);
  return {
    response: httpResponse,
    finish() {
      body.resolve(data);
    },
  };
}
function useAccountQueries() {
  return { auth: useAuth(), tasks: useTasks(), stats: useStats(), ...useAchievements() };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
function setupWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </AuthProvider>
  );
  return { queryClient, wrapper };
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

it("waits for a confirmed account before querying and scopes task pages to its user ID", async () => {
  const check = deferred<Response>();
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation((url) =>
      String(url).endsWith("/auth/me")
        ? check.promise
        : Promise.resolve(response(taskList("task-a")))
    );
  const { queryClient, wrapper } = setupWrapper();
  const { result } = renderHook(() => ({ auth: useAuth(), tasks: useTasks() }), { wrapper });

  expect(result.current.auth.status).toBe("checking");
  expect(fetchSpy.mock.calls.filter(([url]) => String(url).includes("/tasks/"))).toHaveLength(0);
  await act(async () => check.resolve(response(accountA)));
  await waitFor(() => expect(result.current.tasks.data[0]?.id).toBe("task-a"));

  expect(
    queryClient.getQueryData([
      "tasks",
      accountA.id,
      { limit: 100, offset: 0 },
      result.current.auth.generation,
    ])
  ).toBeDefined();
  const request = fetchSpy.mock.calls.find(([url]) => String(url).includes("/tasks/"));
  expect(request?.[1]?.signal).toBeInstanceOf(AbortSignal);
});

it("does not retry a forbidden task query or expire its confirmed account", async () => {
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (url) =>
      String(url).endsWith("/auth/me") ? response(accountA) : response({ detail: "Forbidden" }, 403)
    );
  const { queryClient, wrapper } = setupWrapper();
  queryClient.setDefaultOptions({ queries: { retry: 3, retryDelay: 0 } });
  const { result } = renderHook(() => ({ auth: useAuth(), tasks: useTasks() }), { wrapper });

  await waitFor(() => expect(result.current.tasks.error).toMatchObject({ status: 403 }));

  expect(result.current.auth.status).toBe("authenticated");
  expect(fetchSpy.mock.calls.filter(([url]) => String(url).includes("/tasks/"))).toHaveLength(1);
});

it("waits for server identity before fetching account statistics or achievements", async () => {
  const check = deferred<Response>();
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    const path = new URL(String(url)).pathname;
    if (path === "/auth/me") return check.promise;
    if (path === "/stats/") return response({ total_tasks: 7 });
    if (path === "/achievements/")
      return response({ achievements: [{ id: "earned-a" }], total: 1 });
    return response({ achievements: [{ achievement_type: "first-task" }] });
  });
  const { queryClient, wrapper } = setupWrapper();
  const { result } = renderHook(
    () => ({ auth: useAuth(), stats: useStats(), ...useAchievements() }),
    { wrapper }
  );

  expect(fetchSpy.mock.calls.filter(([url]) => !String(url).includes("/auth/"))).toHaveLength(0);
  await act(async () => check.resolve(response(accountA)));
  await waitFor(() => expect(result.current.stats.data?.total_tasks).toBe(7));
  await waitFor(() =>
    expect(result.current.achievements.data?.achievements[0]?.id).toBe("earned-a")
  );
  await waitFor(() =>
    expect(result.current.definitions.data?.achievements[0]?.achievement_type).toBe("first-task")
  );

  for (const key of ["stats", "achievements", "achievement-definitions"])
    expect(
      queryClient.getQueryData([key, accountA.id, result.current.auth.generation])
    ).toBeDefined();
  for (const [, options] of fetchSpy.mock.calls.filter(([url]) => !String(url).includes("/auth/")))
    expect(options?.signal).toBeInstanceOf(AbortSignal);
});

it("rejects task creation before server identity and refreshes only the submitting account", async () => {
  const check = deferred<Response>();
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (url) =>
      String(url).endsWith("/auth/me") ? check.promise : response(task("created-a"), 201)
    );
  const { queryClient, wrapper } = setupWrapper();
  const keyA = ["tasks", accountA.id, { limit: 100, offset: 0 }];
  const keyB = ["tasks", accountB.id, { limit: 100, offset: 0 }];
  queryClient.setQueryData(keyA, taskList("task-a"));
  queryClient.setQueryData(keyB, taskList("task-b"));
  const { result } = renderHook(() => ({ auth: useAuth(), create: useCreateTask() }), { wrapper });

  await act(async () => {
    await expect(
      result.current.create.mutateAsync({ content: "local draft" })
    ).rejects.toMatchObject({ name: "AbortError" });
  });
  expect(fetchSpy.mock.calls.filter(([url]) => String(url).endsWith("/tasks"))).toHaveLength(0);
  await act(async () => check.resolve(response(accountA)));
  const onSuccess = vi.fn();
  await act(async () => {
    await result.current.create.mutateAsync({ content: "account A writing" }, { onSuccess });
  });

  expect(onSuccess).toHaveBeenCalledTimes(1);
  expect(queryClient.getQueryState(keyA)?.isInvalidated).toBe(true);
  expect(queryClient.getQueryState(keyB)?.isInvalidated).toBe(false);
});

it("keeps an old creation's errors, callbacks, and returned task out of account B", async () => {
  const creation = deferred<Response>();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    if (String(url).endsWith("/auth/me")) return response(accountA);
    if (String(url).endsWith("/auth/login")) return response({ user: accountB });
    return creation.promise;
  });
  const { queryClient, wrapper } = setupWrapper();
  const keyB = ["tasks", accountB.id, { limit: 100, offset: 0 }];
  queryClient.setQueryData(keyB, taskList("task-b"));
  const { result } = renderHook(() => ({ auth: useAuth(), create: useCreateTask() }), { wrapper });
  await waitFor(() => expect(result.current.auth.status).toBe("authenticated"));
  const onSuccess = vi.fn();
  const onError = vi.fn();
  const onSettled = vi.fn();
  let request!: Promise<unknown>;
  let settled!: Promise<unknown>;
  act(() => {
    request = result.current.create.mutateAsync(
      { content: "account A draft" },
      { onSuccess, onError, onSettled }
    );
    settled = request.catch(() => undefined);
  });
  await waitFor(() => expect(result.current.create.isLoading).toBe(true));
  await act(async () => result.current.auth.login(accountB.email, "test-password"));

  expect(result.current.create.isLoading).toBe(false);
  await act(async () => {
    creation.resolve(response(task("created-a"), 201));
    await settled;
  });
  await expect(request).rejects.toMatchObject({ name: "AbortError" });

  expect(result.current.auth.user).toEqual(accountB);
  expect(result.current.create.error).toBeNull();
  expect(onSuccess).not.toHaveBeenCalled();
  expect(onError).not.toHaveBeenCalled();
  expect(onSettled).not.toHaveBeenCalled();
  expect(queryClient.getQueryState(keyB)?.isInvalidated).toBe(false);
});

it("pauses style analysis before identity and uses the server-confirmed user ID", async () => {
  const check = deferred<Response>();
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (url) =>
      String(url).endsWith("/auth/me")
        ? check.promise
        : response({ user_id: accountA.id, confidence: 0.8 })
    );
  const { wrapper } = setupWrapper();
  const { result } = renderHook(() => ({ auth: useAuth(), style: useStyleLearning() }), {
    wrapper,
  });

  await act(async () => result.current.style.analyze("writing sample", "default-user"));
  expect(
    fetchSpy.mock.calls.filter(([url]) => String(url).endsWith("/style/analyze"))
  ).toHaveLength(0);
  await act(async () => check.resolve(response(accountA)));
  await act(async () => result.current.style.analyze("writing sample", "default-user"));

  expect(result.current.style.result?.user_id).toBe(accountA.id);
  const request = fetchSpy.mock.calls.find(([url]) => String(url).endsWith("/style/analyze"));
  expect(JSON.parse(String(request?.[1]?.body))).toEqual({
    text: "writing sample",
    user_id: accountA.id,
  });
  expect(request?.[1]?.signal).toBeInstanceOf(AbortSignal);
});

it.each([
  ["/tasks/", "tasks", 401],
  ["/tasks/", "tasks", 403],
  ["/stats/", "stats", 401],
  ["/stats/", "stats", 403],
  ["/achievements/", "achievements", 401],
  ["/achievements/", "achievements", 403],
  ["/achievements/definitions", "definitions", 401],
  ["/achievements/definitions", "definitions", 403],
] as const)(
  "reports %s (%s HTTP %s) once, expires only unauthorized sessions",
  async (failurePath, key, status) => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const path = new URL(String(url)).pathname;
      if (path === "/auth/me") return response(accountA);
      if (path === failurePath) return response({ detail: "Rejected" }, status);
      if (path === "/tasks/") return response(taskList("task-a"));
      if (path === "/stats/") return response({ total_tasks: 7 });
      return response({ achievements: [], total: 0 });
    });
    const { queryClient, wrapper } = setupWrapper();
    queryClient.setDefaultOptions({ queries: { retry: 3, retryDelay: 0 } });
    const { result } = renderHook(useAccountQueries, { wrapper });

    await waitFor(() =>
      status === 401
        ? expect(result.current.auth.status).toBe("expired")
        : expect(result.current[key].error).toMatchObject({ status })
    );

    expect(result.current.auth.status).toBe(status === 401 ? "expired" : "authenticated");
    expect(result.current.auth.user).toEqual(accountA);
    expect(
      fetchSpy.mock.calls.filter(([url]) => new URL(String(url)).pathname === failurePath)
    ).toHaveLength(1);
  }
);

it("ignores old account query and style bodies after a different account is confirmed", async () => {
  const oldBodies = {
    "/tasks/": delayedBody(taskList("task-a")),
    "/stats/": delayedBody({ total_tasks: 99 }),
    "/achievements/": delayedBody({ achievements: [{ id: "earned-a" }], total: 1 }),
    "/achievements/definitions": delayedBody({
      achievements: [{ achievement_type: "definition-a" }],
    }),
    "/style/analyze": delayedBody({ user_id: accountA.id, confidence: 0.1 }),
  };
  let signedInAsB = false;
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    const path = new URL(String(url)).pathname;
    if (path === "/auth/me") return response(accountA);
    if (path === "/auth/login") {
      signedInAsB = true;
      return response({ user: accountB });
    }
    if (!signedInAsB) return oldBodies[path as keyof typeof oldBodies].response;
    if (path === "/tasks/") return response(taskList("task-b"));
    if (path === "/stats/") return response({ total_tasks: 7 });
    if (path === "/style/analyze") return response({ user_id: accountB.id, confidence: 0.9 });
    if (path === "/achievements/")
      return response({ achievements: [{ id: "earned-b" }], total: 1 });
    return response({ achievements: [{ achievement_type: "definition-b" }] });
  });
  const { wrapper } = setupWrapper();
  const { result } = renderHook(() => ({ ...useAccountQueries(), style: useStyleLearning() }), {
    wrapper,
  });
  await waitFor(() => expect(result.current.auth.status).toBe("authenticated"));
  let oldStyle!: Promise<void>;
  act(() => {
    oldStyle = result.current.style.analyze("old account sample", accountA.id);
  });
  await waitFor(() => expect(result.current.style.isLoading).toBe(true));
  const oldRequests = fetchSpy.mock.calls.filter(([url]) => !String(url).includes("/auth/"));
  await act(async () => result.current.auth.login(accountB.email, "test-password"));
  await waitFor(() => expect(result.current.tasks.data[0]?.id).toBe("task-b"));
  await waitFor(() => expect(result.current.stats.data?.total_tasks).toBe(7));
  await act(async () => result.current.style.analyze("new account sample", accountB.id));
  await act(async () => {
    for (const body of Object.values(oldBodies)) body.finish();
    await oldStyle;
  });

  expect(result.current.auth.user).toEqual(accountB);
  expect(result.current.tasks.data[0]?.id).toBe("task-b");
  expect(result.current.stats.data?.total_tasks).toBe(7);
  expect(result.current.achievements.data?.achievements[0]?.id).toBe("earned-b");
  expect(result.current.definitions.data?.achievements[0]?.achievement_type).toBe("definition-b");
  expect(result.current.style.result?.user_id).toBe(accountB.id);
  expect(result.current.style.result?.confidence).toBe(0.9);
  expect(result.current.style.error).toBeNull();
  for (const [, options] of oldRequests) expect(options?.signal?.aborted).toBe(true);
});

it("starts fresh queries when the same account is rechecked before old response bodies finish", async () => {
  const oldBodies = {
    "/tasks/": delayedBody(taskList("old-task-a")),
    "/stats/": delayedBody({ total_tasks: 99 }),
    "/achievements/": delayedBody({ achievements: [{ id: "old-earned-a" }], total: 1 }),
    "/achievements/definitions": delayedBody({
      achievements: [{ achievement_type: "old-definition-a" }],
    }),
  };
  const seen = new Set<string>();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    const path = new URL(String(url)).pathname;
    if (path === "/auth/me") return response(accountA);
    if (!seen.has(path)) {
      seen.add(path);
      return oldBodies[path as keyof typeof oldBodies].response;
    }
    if (path === "/tasks/") return response(taskList("fresh-task-a"));
    if (path === "/stats/") return response({ total_tasks: 7 });
    if (path === "/achievements/")
      return response({ achievements: [{ id: "fresh-earned-a" }], total: 1 });
    return response({ achievements: [{ achievement_type: "fresh-definition-a" }] });
  });
  const { wrapper } = setupWrapper();
  const { result } = renderHook(useAccountQueries, { wrapper });
  await waitFor(() => expect(result.current.auth.status).toBe("authenticated"));
  await act(async () => result.current.auth.recheck());

  await waitFor(() => expect(result.current.tasks.data[0]?.id).toBe("fresh-task-a"));
  expect(result.current.stats.data?.total_tasks).toBe(7);
  expect(result.current.achievements.data?.achievements[0]?.id).toBe("fresh-earned-a");
  expect(result.current.definitions.data?.achievements[0]?.achievement_type).toBe(
    "fresh-definition-a"
  );
  await act(async () => {
    for (const body of Object.values(oldBodies)) body.finish();
  });
  expect(result.current.tasks.data[0]?.id).toBe("fresh-task-a");
  expect(result.current.stats.data?.total_tasks).toBe(7);
});

it("refuses manual refetches while authentication is anonymous", async () => {
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(response({ detail: "No session" }, 401));
  const { wrapper } = setupWrapper();
  const { result } = renderHook(useAccountQueries, { wrapper });
  await waitFor(() => expect(result.current.auth.status).toBe("anonymous"));

  for (const key of ["tasks", "stats", "achievements", "definitions"] as const) {
    await act(async () => {
      await expect(result.current[key].refetch({ throwOnError: true })).rejects.toMatchObject({
        name: "AbortError",
      });
    });
  }

  expect(fetchSpy.mock.calls.filter(([url]) => !String(url).includes("/auth/"))).toHaveLength(0);
});

it.each([401, 403] as const)(
  "handles style HTTP %s within the captured session without retries",
  async (status) => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url) =>
        String(url).endsWith("/auth/me")
          ? response(accountA)
          : response({ code: "rejected", message: "Style request rejected" }, status)
      );
    const { wrapper } = setupWrapper();
    const { result } = renderHook(() => ({ auth: useAuth(), style: useStyleLearning() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.auth.status).toBe("authenticated"));

    await act(async () => result.current.style.analyze("writing sample", "default-user"));

    expect(result.current.auth.status).toBe(status === 401 ? "expired" : "authenticated");
    expect(result.current.style.isLoading).toBe(false);
    expect(result.current.style.result).toBeNull();
    if (status === 403) expect(result.current.style.error).toBe("Style request rejected");
    expect(
      fetchSpy.mock.calls.filter(([url]) => String(url).endsWith("/style/analyze"))
    ).toHaveLength(1);
  }
);
