/**
 * Task association header coverage for Muse/Loki interventions.
 *
 * A generated action is only recorded under `GET /tasks/{id}/actions` when the
 * client announces the task it belongs to. The editor must therefore forward a
 * known task id as `X-Task-Id` and stay silent while the draft has no server task
 * (the server rejects unknown task ids with 404).
 */

import { cleanup, render, waitFor } from "@testing-library/react";
import type { Editor } from "@milkdown/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AIActionType } from "../../types/ai-actions";
import { EditorCore } from "./EditorCore";

// jsdom has no layout, while the selection toolbar requests text rectangles.
beforeEach(() => {
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: () => [new DOMRect(0, 0, 10, 10)],
  });
  Object.defineProperty(Range.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => new DOMRect(0, 0, 10, 10),
  });
});

afterEach(() => {
  Reflect.deleteProperty(Range.prototype, "getClientRects");
  Reflect.deleteProperty(Range.prototype, "getBoundingClientRect");
  cleanup();
  vi.restoreAllMocks();
});

/** Capture the headers of each intervention request while answering harmlessly. */
function captureInterventionHeaders(): Record<string, unknown>[] {
  const requests: Record<string, unknown>[] = [];
  vi.spyOn(global, "fetch").mockImplementation(async (input, options) => {
    if (!String(input).includes("/impetus/generate-intervention"))
      return new Response(new ArrayBuffer(8));
    requests.push((options?.headers ?? {}) as Record<string, unknown>);
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  return requests;
}

async function triggerIntervention(taskId: string | null | undefined, mode: "muse" | "loki") {
  const requests = captureInterventionHeaders();
  const onReady = vi.fn<(editor: Editor) => void>();
  const props = { initialContent: "正在书写的一句话。", mode, onReady, taskId };
  const mounted = render(<EditorCore {...props} />);
  await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
  mounted.rerender(
    <EditorCore
      {...props}
      externalTrigger={mode === "muse" ? AIActionType.PROVOKE : AIActionType.CHAOS}
    />
  );
  await waitFor(() => expect(requests).toHaveLength(1));
  return requests[0]!;
}

describe("EditorCore intervention task association", () => {
  it.each(["muse", "loki"] as const)(
    "sends the known task id as X-Task-Id for %s interventions",
    async (mode) => {
      const headers = await triggerIntervention("0f8fad5b-d9cb-469f-a165-70867728950e", mode);
      expect(headers["X-Task-Id"]).toBe("0f8fad5b-d9cb-469f-a165-70867728950e");
      // The rest of the request contract is untouched.
      expect(headers["X-Contract-Version"]).toBe("2.0.0");
      expect(headers["Content-Type"]).toBe("application/json");
    }
  );

  it.each([undefined, null, "   "] as const)(
    "omits X-Task-Id when the task id is %j",
    async (taskId) => {
      const headers = await triggerIntervention(taskId, "muse");
      expect(Object.keys(headers)).not.toContain("X-Task-Id");
    }
  );
});
