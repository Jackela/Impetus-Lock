/**
 * Coordinate cookie-changing authentication requests across this origin's tabs.
 * @param signal - Cancels waiting for the lock; dispatched requests must settle before release
 * @param send - Sends the authentication request with current cookie and CSRF settings
 * @param source - The writing page initiating this operation
 * @returns The response after its cookie headers have been processed
 */
export async function authenticationWrite(
  signal: AbortSignal,
  send: () => Promise<Response>,
  source = crypto.randomUUID()
): Promise<Response> {
  if (!navigator.locks?.request)
    throw new Error(
      "This browser cannot safely coordinate sign-in across tabs. Your writing is retained. Use an updated browser in a secure context or a private window."
    );
  return navigator.locks.request("impetus.authentication", { signal }, async () => {
    const pendingKey = "impetus.auth.pending";
    let pending: string | null;
    try {
      pending = localStorage.getItem(pendingKey);
    } catch {
      throw new Error(
        "Browser storage cannot protect your authentication changes. Keep this page open, export your writing, and retry when storage is available."
      );
    }
    if (pending)
      throw new Error(
        "A sign-in or sign-out request could not be confirmed. Keep this page open and export any unsaved writing. Check the current session, or use a new browser profile or private window to sign in safely."
      );
    // This record detects an abandoned request; Web Locks provides the mutual exclusion.
    // It must precede dispatch because unloading can prevent any cleanup handler from running.
    try {
      localStorage.setItem(pendingKey, JSON.stringify({ id: crypto.randomUUID(), source }));
    } catch {
      throw new Error(
        "Browser storage cannot protect your authentication changes. Keep this page open, export your writing, and retry when storage is available."
      );
    }
    announce(source, "started");
    let receivedHeaders = false;
    try {
      const response = await send();
      receivedHeaders = true;
      return response;
    } finally {
      // A rejected fetch or a closed page cannot prove its cookie response never arrived.
      // Never expire an unresolved marker on a timer or because /auth/me succeeded.
      if (receivedHeaders) {
        try {
          localStorage.removeItem(pendingKey);
          announce(source, "settled");
        } catch {
          // Retain the conservative write barrier if the browser cannot remove it.
        }
      }
    }
  });
}

function announce(source: string, stage: "started" | "settled"): void {
  if (typeof BroadcastChannel === "undefined") return;
  try {
    const channel = new BroadcastChannel("impetus.authentication");
    channel.postMessage({ source, stage });
    channel.close();
  } catch {
    // Storage events still notify other pages if this browser rejects the channel.
  }
}

/**
 * Observe cookie changes in other pages, using storage events as a broadcast fallback.
 * @param source - This page's identity, ignored in its own announcements
 * @param listener - Preserves writing on start and checks server identity after settlement
 * @returns Removes all cross-page observers
 */
export function observeAuthenticationWrites(
  source: string,
  listener: (stage: "started" | "settled") => void
): () => void {
  const receive = (data: unknown): void => {
    if (!data || typeof data !== "object" || !("source" in data) || data.source === source) return;
    if ("stage" in data && (data.stage === "started" || data.stage === "settled"))
      listener(data.stage);
  };
  const storage = (event: StorageEvent): void => {
    if (event.key !== "impetus.auth.pending") return;
    try {
      const raw: unknown = JSON.parse(event.newValue ?? event.oldValue ?? "null");
      if (raw && typeof raw === "object" && "source" in raw && raw.source !== source)
        listener(event.newValue ? "started" : "settled");
    } catch {
      listener("started");
    }
  };
  let channel: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== "undefined")
      channel = new BroadcastChannel("impetus.authentication");
  } catch {
    // Keep the storage observer when this browser denies broadcast channels.
  }
  if (channel) channel.onmessage = (event: MessageEvent<unknown>) => receive(event.data);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener("storage", storage);
    channel?.close();
  };
}
