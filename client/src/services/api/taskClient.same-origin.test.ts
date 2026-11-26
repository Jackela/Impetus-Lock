import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("fetches the task list through the configured same-origin API prefix", async () => {
  vi.stubEnv("VITE_API_URL", "/api");
  const { fetchTasks } = await import("./taskClient");
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      new Response(JSON.stringify({ tasks: [], limit: 100, offset: 0, total: 0 }))
    );

  await expect(fetchTasks()).resolves.toMatchObject({ tasks: [], total: 0 });

  const [url, options] = fetchSpy.mock.calls[0] ?? [];
  expect(url).toBe(new URL("/api/tasks/?limit=100&offset=0", location.origin).href);
  expect(options?.credentials).toBe("include");
});
