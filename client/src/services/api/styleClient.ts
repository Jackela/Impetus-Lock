/**
 * Style Learning API Client
 *
 * Handles backend communication for style analysis and application.
 * Communicates with /style/analyze and /style/apply endpoints.
 *
 * Constitutional Compliance:
 * - Article I (Simplicity): Uses native fetch (no axios/ky dependency)
 * - Article V (Documentation): Complete JSDoc for all exported functions
 *
 * @module services/api/styleClient
 */

import type { StyleAnalysisResponse, StyleApplyResponse } from "./types";

export type { StyleAnalysisResponse, StyleApplyResponse } from "./types";

export type { StyleVector, StyleAnalysisResponse, StyleApplyResponse } from "./types";

/**
 * Options for API calls.
 */
export interface StyleClientOptions {
  /** AbortSignal for request cancellation */
  signal?: AbortSignal;
}

/**
 * API client configuration.
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/**
 * Error class for Style API operations.
 *
 * Includes HTTP status code, error code, and optional details.
 */
export class StyleAPIError extends Error {
  /** HTTP status code */
  status: number;
  /** Error code from API */
  code: string;
  /** Optional additional error details */
  details?: unknown;

  /**
   * Creates a new StyleAPIError.
   *
   * @param status - HTTP status code
   * @param code - Error code from API
   * @param message - Human-readable error message
   * @param details - Optional additional error details
   */
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "StyleAPIError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Analyze writing style from a text sample.
 *
 * Sends text to POST /style/analyze endpoint to extract style characteristics.
 *
 * @param text - Writing sample to analyze (min 500 words recommended)
 * @param userId - User identifier to associate the style with
 * @param options - Optional configuration (e.g., AbortSignal)
 * @returns Style analysis response with vector and confidence
 *
 * @throws {StyleAPIError} If API returns error (400, 404, 500)
 * @throws {Error} If network request fails or is aborted
 *
 * @example
 * ```typescript
 * try {
 *   const result = await analyzeStyle(writingSample, 'user-123');
 *   console.log('Style confidence:', result.confidence);
 *   console.log('Avg sentence length:', result.style_vector.avg_sentence_length);
 * } catch (error) {
 *   if (error instanceof StyleAPIError) {
 *     console.error('API error:', error.code, error.message);
 *   }
 * }
 * ```
 */
export async function analyzeStyle(
  text: string,
  userId: string,
  options?: StyleClientOptions
): Promise<StyleAnalysisResponse> {
  const response = await fetch(`${API_BASE_URL}/style/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      user_id: userId,
    }),
    signal: options?.signal,
  });

  let data: unknown;
  try {
    data = await response.json();
  } catch (parseError) {
    throw new StyleAPIError(response.status, "ParseError", "Failed to parse response JSON", {
      originalError: parseError instanceof Error ? parseError.message : String(parseError),
    });
  }

  // Type guard to safely check parsed data
  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  const parsedData = isRecord(data) ? data : {};

  if (!response.ok) {
    const code = typeof parsedData.code === "string" ? parsedData.code : "UnknownError";
    const message =
      typeof parsedData.message === "string" ? parsedData.message : "Unknown error occurred";

    throw new StyleAPIError(response.status, code, message, parsedData.details);
  }

  return parsedData as unknown as StyleAnalysisResponse;
}

/**
 * Apply a user's learned style to transform text.
 *
 * Sends text to POST /style/apply endpoint to transform it with the user's style.
 *
 * @param text - Text to transform
 * @param userId - User whose style to apply
 * @param intensity - Style application intensity (0-1, default: 1.0)
 * @param options - Optional configuration (e.g., AbortSignal)
 * @returns Transformed text with style applied
 *
 * @throws {StyleAPIError} If API returns error (400, 404, 500)
 * @throws {Error} If network request fails or is aborted
 *
 * @example
 * ```typescript
 * try {
 *   const result = await applyStyle('The quick brown fox.', 'user-123', 0.7);
 *   console.log('Transformed:', result.transformed_text);
 * } catch (error) {
 *   if (error instanceof StyleAPIError && error.code === 'style_not_found') {
 *     console.error('User has no style profile yet');
 *   }
 * }
 * ```
 */
export async function applyStyle(
  text: string,
  userId: string,
  intensity: number = 1.0,
  options?: StyleClientOptions
): Promise<StyleApplyResponse> {
  const response = await fetch(`${API_BASE_URL}/style/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      user_id: userId,
      intensity,
    }),
    signal: options?.signal,
  });

  let data: unknown;
  try {
    data = await response.json();
  } catch (parseError) {
    throw new StyleAPIError(response.status, "ParseError", "Failed to parse response JSON", {
      originalError: parseError instanceof Error ? parseError.message : String(parseError),
    });
  }

  // Type guard to safely check parsed data
  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  const parsedData = isRecord(data) ? data : {};

  if (!response.ok) {
    const code = typeof parsedData.code === "string" ? parsedData.code : "UnknownError";
    const message =
      typeof parsedData.message === "string" ? parsedData.message : "Unknown error occurred";

    throw new StyleAPIError(response.status, code, message, parsedData.details);
  }

  return parsedData as unknown as StyleApplyResponse;
}
