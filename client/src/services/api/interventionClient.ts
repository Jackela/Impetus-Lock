/**
 * Intervention API Client
 *
 * Handles backend communication for AI intervention generation.
 * Includes Idempotency-Key generation and header management.
 *
 * Constitutional Compliance:
 * - Article I (Simplicity): Uses native fetch (no axios/ky dependency)
 * - Article V (Documentation): Complete JSDoc for all exported functions
 *
 * @module services/api/interventionClient
 */

import type { components } from "../../types/api.generated";
import { getStoredLLMConfig } from "../llmConfigStore";

type InterventionRequest = components["schemas"]["InterventionRequest"];
type InterventionResponse = components["schemas"]["InterventionResponse"];

/**
 * API client configuration.
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const CONTRACT_VERSION = "1.0.1";

/**
 * Generate UUID v4 for Idempotency-Key.
 *
 * Uses crypto.randomUUID() (available in modern browsers and Node 19+).
 *
 * @returns UUID v4 string
 *
 * @example
 * ```typescript
 * const key = generateIdempotencyKey();
 * // "550e8400-e29b-41d4-a716-446655440000"
 * ```
 */
function generateIdempotencyKey(): string {
  const globalCrypto =
    typeof globalThis !== "undefined" ? (globalThis.crypto as Crypto | undefined) : undefined;

  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID();
  }

  if (globalCrypto?.getRandomValues) {
    const buffer = new Uint8Array(16);
    globalCrypto.getRandomValues(buffer);
    buffer[6] = (buffer[6] & 0x0f) | 0x40; // version 4
    buffer[8] = (buffer[8] & 0x3f) | 0x80; // variant 10

    const hex = Array.from(buffer, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  const timestamp = Date.now().toString(16);
  const randomPart = Math.random().toString(16).slice(2, 14);
  return `fallback-${timestamp}-${randomPart}`;
}

/**
 * API client error class.
 *
 * Wraps HTTP errors with status code and error details.
 */
export class InterventionAPIError extends Error {
  constructor(
    public status: number,
    public errorCode: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "InterventionAPIError";
  }
}

/**
 * Call backend API to generate intervention action.
 *
 * Sends intervention request to POST /api/v1/impetus/generate-intervention
 * with required headers (Idempotency-Key, X-Contract-Version).
 *
 * @param request - Intervention request payload
 * @param options - Optional configuration
 * @param options.idempotencyKey - Custom idempotency key (auto-generated if not provided)
 * @param options.signal - AbortSignal for request cancellation
 * @returns Intervention response from backend
 *
 * @throws {InterventionAPIError} If API returns error (400, 422, 429, 500)
 * @throws {TypeError} If network request fails
 *
 * @example
 * ```typescript
 * try {
 *   const response = await generateIntervention({
 *     context: "他打开门，犹豫着要不要进去。",
 *     mode: "muse",
 *     client_meta: {
 *       doc_version: 42,
 *       selection_from: 1234,
 *       selection_to: 1234,
 *     },
 *   });
 *
 *   console.log(response.action); // "provoke" or "delete"
 *
 *   if (response.action === "provoke") {
 *     console.log(response.content); // "立即让主角曝露一个秘密。"
 *     console.log(response.lock_id); // "lock_01j4z3m8a6q3qz2x8j4z3m8a"
 *     console.log(response.source); // "muse"
 *   }
 * } catch (error) {
 *   if (error instanceof InterventionAPIError) {
 *     console.error('API error:', error.status, error.message);
 *   }
 * }
 * ```
 */
export async function generateIntervention(
  request: InterventionRequest,
  options?: {
    idempotencyKey?: string;
    signal?: AbortSignal;
    retries?: number;
  }
): Promise<InterventionResponse> {
  const idempotencyKey = options?.idempotencyKey || generateIdempotencyKey();
  const maxRetries = options?.retries ?? 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/impetus/generate-intervention`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
          "X-Contract-Version": CONTRACT_VERSION,
          ...buildLLMHeaders(),
        },
        body: JSON.stringify(request),
        signal: options?.signal,
      });

      let data: unknown;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new InterventionAPIError(
          response.status,
          "ParseError",
          "Failed to parse response JSON",
          { originalError: parseError instanceof Error ? parseError.message : String(parseError) }
        );
      }

      const parsedData = (data as Record<string, unknown>) || {};

      if (!response.ok) {
        const detail =
          (parsedData.detail as Record<string, unknown> | undefined) ??
          (typeof parsedData.details === "object" ? (parsedData.details as Record<string, unknown>) : undefined);
        const code =
          (parsedData.error as string) ||
          (parsedData.code as string) ||
          (detail?.code as string) ||
          "UnknownError";
        const message =
          (parsedData.message as string) ||
          (detail?.message as string) ||
          "Unknown error occurred";

        throw new InterventionAPIError(response.status, code, message, detail ?? parsedData.details);
      }

      return parsedData as InterventionResponse;
    } catch (error) {
      lastError = error as Error;

      if (error instanceof InterventionAPIError) {
        if (error.status === 422 || error.status === 400) {
          throw error;
        }
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw error;
      }

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw lastError;
    }
  }

  throw lastError || new Error("Request failed after retries");
}

function buildLLMHeaders(): Record<string, string> {
  const config = getStoredLLMConfig();
  if (!config?.apiKey) return {};
  return {
    "X-LLM-Provider": config.provider,
    "X-LLM-Model": config.model,
    "X-LLM-Api-Key": config.apiKey,
  };
}

/**
 * Trigger Muse mode intervention (STUCK detection flow).
 *
 * Convenience wrapper for generateIntervention with Muse-specific defaults.
 * Extracts context using contextExtractor and calls backend API.
 *
 * @param fullText - Full editor content
 * @param cursorPosition - Current cursor position
 * @param docVersion - Document version (for optimistic locking)
 * @returns Intervention response with provoke action
 *
 * @example
 * ```typescript
 * import { extractLastSentences } from '../../utils/contextExtractor';
 *
 * const fullText = editor.getMarkdown();
 * const context = extractLastSentences(fullText, 3, cursorPosition);
 *
 * const response = await triggerMuseIntervention(
 *   context,
 *   cursorPosition,
 *   42 // doc version
 * );
 *
 * if (response.action === 'provoke') {
 *   injectLockedBlock(response.content, response.lock_id, response.anchor, response.source);
 * }
 * ```
 */
export async function triggerMuseIntervention(
  context: string,
  cursorPosition: number,
  docVersion: number
): Promise<InterventionResponse> {
  return generateIntervention({
    context,
    mode: "muse",
    client_meta: {
      doc_version: docVersion,
      selection_from: cursorPosition,
      selection_to: cursorPosition,
    },
  });
}

/**
 * Trigger Loki mode intervention (random chaos flow).
 *
 * Convenience wrapper for generateIntervention with Loki-specific defaults.
 * Loki mode can return either Provoke (inject) or Delete (remove) actions.
 *
 * @param context - Last 3-10 sentences from document (or full doc if <2000 chars)
 * @param cursorPosition - Current cursor position
 * @param docVersion - Document version (for optimistic locking)
 * @returns Intervention response with provoke or delete action
 *
 * @example
 * ```typescript
 * import { extractLastSentences } from '../../utils/contextExtractor';
 *
 * const fullText = editor.getMarkdown();
 * const context = extractLastSentences(fullText, 10, cursorPosition);
 *
 * const response = await triggerLokiIntervention(
 *   context,
 *   cursorPosition,
 *   42 // doc version
 * );
 *
 * if (response.action === 'provoke') {
 *   injectLockedBlock(response.content, response.lock_id, response.anchor, response.source);
 * } else if (response.action === 'rewrite') {
 *   rewriteRangeWithLock({ view, content: response.content, lockId: response.lock_id, anchor: response.anchor });
 * } else if (response.action === 'delete') {
 *   executeDelete(response.anchor);
 * }
 * ```
 */
export async function triggerLokiIntervention(
  context: string,
  cursorPosition: number,
  docVersion: number
): Promise<InterventionResponse> {
  return generateIntervention({
    context,
    mode: "loki",
    client_meta: {
      doc_version: docVersion,
      selection_from: cursorPosition,
      selection_to: cursorPosition,
    },
  });
}

/**
 * Test backend health/connectivity.
 *
 * Calls GET /health endpoint to verify backend is reachable.
 *
 * @returns True if backend is healthy
 *
 * @example
 * ```typescript
 * const isHealthy = await checkHealth();
 * if (!isHealthy) {
 *   console.warn('Backend unavailable');
 * }
 * ```
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000), // 5s timeout
    });

    return response.ok;
  } catch {
    return false;
  }
}
