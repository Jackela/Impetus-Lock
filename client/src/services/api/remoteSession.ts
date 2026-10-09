/** Server-confirmed account and the lifetime of its authorized remote work. */
export interface RemoteSession {
  /** Stable user ID returned by the server. */
  readonly userId: string;
  /** Changes whenever remote authorization is paused or replaced. */
  readonly generation: number;
  /** Aborted before another account or paused session can start work. */
  readonly signal: AbortSignal;
  /** Synchronous guard for requests and their delayed completions. */
  isCurrent: () => boolean;
  /** Reports a 401 only while this exact session is still current. */
  onUnauthorized: () => void;
}

/** Optional lifetime guards for existing API clients. */
export interface RemoteRequestOptions {
  /** A caller may cancel an individual query independently of the session. */
  signal?: AbortSignal;
  /** Null explicitly pauses remote work; omission preserves standalone clients. */
  session?: RemoteSession | null;
}

/**
 * Reject work whose confirmed account is no longer authorized.
 * @param session - Captured authorization, or null for paused work
 * @returns Nothing when this request may continue
 */
export function assertCurrentSession(session?: RemoteSession | null): void {
  if (session === null || (session && (!session.isCurrent() || session.signal.aborted))) {
    throw new DOMException("Remote work is paused", "AbortError");
  }
}

/**
 * Fetch within the captured account, including cancellation and scoped 401 handling.
 * @param input - Request URL
 * @param init - Existing cookie and request options
 * @param options - Query cancellation and captured account
 * @returns The response only while the request still belongs to the current session
 */
export async function sessionFetch(
  input: RequestInfo | URL,
  init: RequestInit,
  options?: RemoteRequestOptions
): Promise<Response> {
  assertCurrentSession(options?.session);
  const sessionSignal = options?.session?.signal;
  const signal =
    options?.signal && sessionSignal
      ? AbortSignal.any([options.signal, sessionSignal])
      : (options?.signal ?? sessionSignal);
  const response = await fetch(input, signal ? { ...init, signal } : init);
  assertCurrentSession(options?.session);
  if (response.status === 401) options?.session?.onUnauthorized();
  return response;
}
