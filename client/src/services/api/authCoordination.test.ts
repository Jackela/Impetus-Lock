import { afterEach, expect, it, vi } from "vitest";
import { observeAuthenticationWrites } from "./authCoordination";

afterEach(() => vi.unstubAllGlobals());

it("observes storage changes when the browser rejects BroadcastChannel", () => {
  vi.stubGlobal(
    "BroadcastChannel",
    class {
      constructor() {
        throw new DOMException("Channel unavailable", "SecurityError");
      }
    }
  );
  const listener = vi.fn();
  const stop = observeAuthenticationWrites("this-page", listener);
  window.dispatchEvent(
    new StorageEvent("storage", {
      key: "impetus.auth.pending",
      newValue: JSON.stringify({ source: "other-page" }),
    })
  );
  expect(listener).toHaveBeenCalledWith("started");
  stop();
  window.dispatchEvent(
    new StorageEvent("storage", {
      key: "impetus.auth.pending",
      oldValue: JSON.stringify({ source: "other-page" }),
    })
  );
  expect(listener).toHaveBeenCalledOnce();
});
