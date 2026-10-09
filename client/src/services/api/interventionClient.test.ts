import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  generateIntervention,
  triggerMuseIntervention,
  triggerLokiIntervention,
} from "./interventionClient";
import { saveVaultConfig, clearVault, setVaultMode } from "../llmKeyVault";
import type { RemoteSession } from "./remoteSession";

const baseRequest = {
  context: "test",
  mode: "muse" as const,
  client_meta: { doc_version: 1, selection_from: 0, selection_to: 0 },
};

describe("generateIntervention", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    await setVaultMode("local");
    await clearVault();
  });

  afterEach(() => vi.useRealTimers());

  it.each([triggerMuseIntervention, triggerLokiIntervention])(
    "does not send a paused mode intervention",
    async (trigger) => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response("{}"));
      await expect(trigger("local writing", 1, 0, { session: null })).rejects.toMatchObject({
        name: "AbortError",
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    }
  );

  it("does not report a delayed 401 from an account that is no longer current", async () => {
    let current = true;
    let finishFetch!: (response: Response) => void;
    const onUnauthorized = vi.fn();
    const session: RemoteSession = {
      userId: "account-a",
      generation: 1,
      signal: new AbortController().signal,
      isCurrent: () => current,
      onUnauthorized,
    };
    vi.spyOn(global, "fetch").mockImplementation(
      () =>
        new Promise((resolve) => {
          finishFetch = resolve;
        })
    );
    const result = generateIntervention(baseRequest, { session }).catch((error: unknown) => error);
    current = false;
    finishFetch(new Response("{}", { status: 401 }));

    expect(await result).toMatchObject({ name: "AbortError" });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("reports a 401 to the captured current session", async () => {
    const onUnauthorized = vi.fn();
    const session: RemoteSession = {
      userId: "account-a",
      generation: 1,
      signal: new AbortController().signal,
      isCurrent: () => true,
      onUnauthorized,
    };
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("{}", { status: 401 }));

    await expect(generateIntervention(baseRequest, { session })).rejects.toMatchObject({
      status: 401,
    });

    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("ignores a successful response body after its session is replaced", async () => {
    let current = true;
    let finishBody!: (value: unknown) => void;
    const session: RemoteSession = {
      userId: "account-a",
      generation: 1,
      signal: new AbortController().signal,
      isCurrent: () => current,
      onUnauthorized: vi.fn(),
    };
    const response = new Response("{}", { status: 200 });
    const body = vi.spyOn(response, "json").mockImplementation(
      () =>
        new Promise((resolve) => {
          finishBody = resolve;
        })
    );
    vi.spyOn(global, "fetch").mockResolvedValue(response);
    const result = generateIntervention(baseRequest, { session }).catch((error: unknown) => error);
    await vi.waitFor(() => expect(body).toHaveBeenCalled());

    current = false;
    finishBody({ action: "provoke", content: "A's old response" });

    expect(await result).toMatchObject({ name: "AbortError" });
  });

  it("cancels a retry delay immediately when the session is paused", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const session: RemoteSession = {
      userId: "account-a",
      generation: 1,
      signal: controller.signal,
      isCurrent: () => !controller.signal.aborted,
      onUnauthorized: vi.fn(),
    };
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockRejectedValue(new TypeError("Network unavailable"));
    let outcome: unknown;
    const request = generateIntervention(baseRequest, { session }).catch((error: unknown) => {
      outcome = error;
    });
    await vi.advanceTimersByTimeAsync(0);

    controller.abort();
    await vi.advanceTimersByTimeAsync(0);

    expect(outcome).toMatchObject({ name: "AbortError" });
    await vi.runAllTimersAsync();
    await request;
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it.each([401, 403])(
    "does not retry an unauthorized or forbidden response (%s)",
    async (status) => {
      vi.useFakeTimers();
      const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(
        async () =>
          new Response(JSON.stringify({ code: "access_denied", message: "Access denied" }), {
            status,
          })
      );
      const result = generateIntervention(baseRequest).catch((error: unknown) => error);

      await vi.runAllTimersAsync();
      expect(await result).toMatchObject({ status, errorCode: "access_denied" });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    }
  );

  it("attaches BYOK headers when config present", async () => {
    await saveVaultConfig({ provider: "gemini", model: "gemini-2.0-flash-lite", apiKey: "AI-KEY" });

    const mockResponse = {
      ok: true,
      json: () =>
        Promise.resolve({
          action: "provoke",
          content: "hello",
          lock_id: "lock",
          anchor: { type: "pos", from: 0 },
          action_id: "act",
          issued_at: new Date().toISOString(),
          source: "muse",
        }),
      status: 200,
    } as Response;

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(mockResponse);

    await generateIntervention(baseRequest, { idempotencyKey: "fixed" });

    const call = fetchSpy.mock.calls[0];
    if (!call) throw new Error("Expected an intervention request");
    const [, init] = call;
    expect(init?.headers).toMatchObject({
      "X-LLM-Provider": "gemini",
      "X-LLM-Model": "gemini-2.0-flash-lite",
      "X-LLM-Api-Key": "AI-KEY",
    });
  });

  it("maps provider errors to InterventionAPIError", async () => {
    await clearVault();

    const mockResponse = {
      ok: false,
      status: 503,
      json: () => Promise.resolve({ code: "llm_not_configured", message: "LLM unavailable" }),
    } as Response;

    vi.spyOn(global, "fetch").mockResolvedValue(mockResponse);

    await expect(
      generateIntervention(baseRequest, { idempotencyKey: "err" })
    ).rejects.toMatchObject({
      errorCode: "llm_not_configured",
      message: "LLM unavailable",
    });
  });
});
