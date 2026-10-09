import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearVault, saveVaultConfig } from "../llmKeyVault";
import { generateIntervention } from "./interventionClient";
import {
  createTask,
  deleteTask,
  updateTask,
  updateTaskMetadata,
  fetchTask,
  fetchTasks,
} from "./taskClient";
import { createTemplate, deleteTemplate, fetchTemplate, fetchTemplates } from "./templateClient";
import { updateStreak, fetchStreak } from "./streakClient";
import { analyzeStyle, applyStyle } from "./styleClient";
import { compareStyles } from "./styleComparisonClient";
import { fetchAchievements, fetchAchievementDefinitions } from "./achievementClient";
import { fetchStats, fetchInterventionBreakdown } from "./statsClient";

const taskResponse = {
  id: "r04-task",
  content: "test",
  lock_ids: [],
  version: 1,
  created_at: "2026-09-29T00:00:00Z",
  updated_at: "2026-09-29T00:00:00Z",
  tasks: [],
  total: 0,
  limit: 100,
  offset: 0,
};

beforeEach(() => {
  document.cookie = "csrf_token=r04-client-csrf; path=/";
});

it.each([
  ["create task", "POST", "/tasks", () => createTask({ content: "test" })],
  [
    "update task",
    "PUT",
    "/tasks/r04-task",
    () => updateTask("r04-task", { content: "test", lockIds: [], version: 1 }),
  ],
  ["update metadata", "PUT", "/tasks/r04-task/metadata", () => updateTaskMetadata("r04-task", {})],
  ["delete task", "DELETE", "/tasks/r04-task", () => deleteTask("r04-task")],
  ["create template", "POST", "/templates/", () => createTemplate("name", "content")],
  ["delete template", "DELETE", "/templates/r04-template", () => deleteTemplate("r04-template")],
  ["update streak", "POST", "/streaks/update", () => updateStreak()],
  ["analyze style", "POST", "/style/analyze", () => analyzeStyle("test", "r04-user")],
  ["apply style", "POST", "/style/apply", () => applyStyle("test", "r04-user")],
  ["compare style", "POST", "/style/compare", () => compareStyles({}, {})],
] as const)("%s sends cookies and current CSRF", async (_name, method, path, request) => {
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => new Response(JSON.stringify(taskResponse)));
  await request();
  const [url, options] = fetchSpy.mock.calls[0] ?? [];
  expect(String(url)).toContain(path);
  expect(options?.method).toBe(method);
  expect(options?.credentials).toBe("include");
  expect(new Headers(options?.headers).get("X-CSRF-Token")).toBe("r04-client-csrf");
  // A new cookie must be read on the next request rather than cached at import time.
  document.cookie = "csrf_token=r04-rotated-csrf; path=/";
  await request();
  expect(new Headers(fetchSpy.mock.calls[1]?.[1]?.headers).get("X-CSRF-Token")).toBe(
    "r04-rotated-csrf"
  );
});

it.each([
  ["task", () => fetchTask("r04-task")],
  ["task list", () => fetchTasks()],
  ["template", () => fetchTemplate("r04-template")],
  ["template list", () => fetchTemplates()],
  ["streak", () => fetchStreak()],
  ["achievements", () => fetchAchievements()],
  ["achievement definitions", () => fetchAchievementDefinitions()],
  ["stats", () => fetchStats()],
  ["intervention breakdown", () => fetchInterventionBreakdown()],
] as const)("%s reads send credentials without CSRF", async (_name, request) => {
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify(taskResponse)));
  await request();
  const options = fetchSpy.mock.calls[0]?.[1];
  expect(options?.credentials).toBe("include");
  expect(new Headers(options?.headers).has("X-CSRF-Token")).toBe(false);
});

afterEach(async () => {
  document.cookie = "csrf_token=; max-age=0; path=/";
  await clearVault();
  vi.restoreAllMocks();
});

it("sends cookie credentials and CSRF while preserving BYOK and request-specific options", async () => {
  await saveVaultConfig({ provider: "openai", model: "test-model", apiKey: "r04-dummy-byok" });
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      new Response(JSON.stringify({ action: "inject", content: "test constraint", source: "muse" }))
    );
  const signal = new AbortController().signal;
  const request = {
    context: "test writing context",
    mode: "muse" as const,
    client_meta: { doc_version: 1, selection_from: 0, selection_to: 0 },
  };

  await generateIntervention(request, { idempotencyKey: "r04-idempotency", retries: 0, signal });

  const options = fetchSpy.mock.calls[0]?.[1];
  expect(options?.credentials).toBe("include");
  const headers = new Headers(options?.headers);
  expect(headers.get("X-CSRF-Token")).toBe("r04-client-csrf");
  expect(headers.get("Content-Type")).toBe("application/json");
  expect(headers.get("Idempotency-Key")).toBe("r04-idempotency");
  expect(headers.get("X-Contract-Version")).toBe("2.0.0");
  expect(headers.get("X-LLM-Provider")).toBe("openai");
  expect(headers.get("X-LLM-Model")).toBe("test-model");
  expect(headers.get("X-LLM-Api-Key")).toBe("r04-dummy-byok");
  expect(options?.signal).toBe(signal);
  expect(options?.body).toBe(JSON.stringify(request));
});
