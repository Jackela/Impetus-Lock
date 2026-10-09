/**
 * Add browser cookie credentials and double-submit CSRF to API request options.
 *
 * @param options - Request options, including any custom headers or cancellation signal
 * @returns Options with credentials and the current CSRF cookie for unsafe methods
 */
export function cookieAuthOptions(options: RequestInit = {}): RequestInit {
  const method = (options.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrf = document.cookie
      .split(";")
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith("csrf_token="))
      ?.slice("csrf_token=".length);
    if (csrf) {
      const headers = new Headers(options.headers);
      headers.set("X-CSRF-Token", csrf);
      return { ...options, credentials: "include", headers: Object.fromEntries(headers.entries()) };
    }
  }
  return { ...options, credentials: "include" };
}
