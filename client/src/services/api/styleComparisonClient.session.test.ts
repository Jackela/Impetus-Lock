import { afterEach, expect, it, vi } from "vitest";
import { compareStyles } from "./styleComparisonClient";
import type { RemoteSession } from "./remoteSession";

const vector = {
  avg_sentence_length: 10,
  vocab_richness: 0.5,
  punctuation_density: 0.1,
  paragraph_length_avg: 20,
  dialogue_ratio: 0.2,
};
afterEach(() => vi.unstubAllGlobals());

it("pauses comparisons before sending and reports a current unauthorized response", async () => {
  const unauthorized = vi.fn();
  const session: RemoteSession = {
    userId: "account-a",
    generation: 1,
    signal: new AbortController().signal,
    isCurrent: () => true,
    onUnauthorized: unauthorized,
  };
  const http = vi.fn<typeof fetch>(async () =>
    Response.json({ message: "expired" }, { status: 401 })
  );
  vi.stubGlobal("fetch", http);
  await expect(compareStyles(vector, vector, { session: null })).rejects.toMatchObject({
    name: "AbortError",
  });
  expect(http).not.toHaveBeenCalled();
  await expect(compareStyles(vector, vector, { session })).rejects.toMatchObject({ status: 401 });
  expect(unauthorized).toHaveBeenCalledOnce();
});

it("rejects parsed comparison data after the captured session is replaced", async () => {
  let current = true;
  let finish!: (value: unknown) => void;
  const session: RemoteSession = {
    userId: "account-a",
    generation: 1,
    signal: new AbortController().signal,
    isCurrent: () => current,
    onUnauthorized: vi.fn(),
  };
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async () => {
      const response = Response.json({});
      vi.spyOn(response, "json").mockImplementation(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          })
      );
      return response;
    })
  );
  const request = compareStyles(vector, vector, { session });
  await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
  current = false;
  finish({ similarity_score: 1 });
  await expect(request).rejects.toMatchObject({ name: "AbortError" });
});
