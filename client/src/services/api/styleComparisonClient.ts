/**
 * Style Comparison API Client
 *
 * Handles backend communication for comparing two style vectors.
 * Communicates with POST /style/compare endpoint.
 *
 * Constitutional Compliance:
 * - Article I (Simplicity): Uses native fetch (no axios/ky dependency)
 * - Article V (Documentation): Complete JSDoc for all exported functions
 *
 * @module services/api/styleComparisonClient
 */

/**
 * Style vector representing analyzed writing style characteristics.
 */
export interface StyleVector {
  /** Average sentence length in words */
  avg_sentence_length: number;
  /** Vocabulary richness (unique words / total words) */
  vocab_richness: number;
  /** Punctuation density (punctuation marks / total characters) */
  punctuation_density: number;
  /** Average paragraph length in sentences */
  paragraph_length_avg: number;
  /** Ratio of dialogue to narrative text */
  dialogue_ratio: number;
}

/**
 * Request body for style comparison endpoint.
 */
export interface StyleComparisonRequest {
  /** First style vector to compare */
  vector1: StyleVector;
  /** Second style vector to compare */
  vector2: StyleVector;
}

/**
 * Response from style comparison endpoint.
 */
export interface StyleComparisonResponse {
  /** Similarity score between the two styles (0-1, where 1 is identical) */
  similarity_score: number;
  /** Detailed breakdown of individual metric differences */
  metric_differences: {
    /** Difference in average sentence length */
    avg_sentence_length_diff: number;
    /** Difference in vocabulary richness */
    vocab_richness_diff: number;
    /** Difference in punctuation density */
    punctuation_density_diff: number;
    /** Difference in average paragraph length */
    paragraph_length_avg_diff: number;
    /** Difference in dialogue ratio */
    dialogue_ratio_diff: number;
  };
  /** ISO timestamp of comparison */
  compared_at: string;
}

/**
 * Options for API calls.
 */
export interface StyleComparisonOptions {
  /** AbortSignal for request cancellation */
  signal?: AbortSignal;
}

/**
 * API client configuration.
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/**
 * Error class for Style Comparison API operations.
 *
 * Includes HTTP status code, error code, and optional details.
 */
export class StyleComparisonAPIError extends Error {
  /**
   * Creates a new StyleComparisonAPIError.
   *
   * @param status - HTTP status code
   * @param code - Error code from API
   * @param message - Human-readable error message
   * @param details - Optional additional error details
   */
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "StyleComparisonAPIError";
  }
}

/**
 * Compare two style vectors to calculate similarity.
 *
 * Sends two style vectors to POST /style/compare endpoint to compute similarity metrics.
 *
 * @param vector1 - First style vector to compare
 * @param vector2 - Second style vector to compare
 * @param options - Optional configuration (e.g., AbortSignal)
 * @returns Style comparison response with similarity score and metric differences
 *
 * @throws {StyleComparisonAPIError} If API returns error (400, 404, 500)
 * @throws {Error} If network request fails or is aborted
 *
 * @example
 * ```typescript
 * try {
 *   const result = await compareStyles(styleVector1, styleVector2);
 *   console.log('Similarity score:', result.similarity_score);
 *   console.log('Vocabulary difference:', result.metric_differences.vocab_richness_diff);
 * } catch (error) {
 *   if (error instanceof StyleComparisonAPIError) {
 *     console.error('API error:', error.code, error.message);
 *   }
 * }
 * ```
 */
export async function compareStyles(
  vector1: StyleVector,
  vector2: StyleVector,
  options?: StyleComparisonOptions
): Promise<StyleComparisonResponse> {
  const response = await fetch(`${API_BASE_URL}/style/compare`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      vector1,
      vector2,
    }),
    signal: options?.signal,
  });

  let data: unknown;
  try {
    data = await response.json();
  } catch (parseError) {
    throw new StyleComparisonAPIError(
      response.status,
      "ParseError",
      "Failed to parse response JSON",
      {
        originalError: parseError instanceof Error ? parseError.message : String(parseError),
      }
    );
  }

  const parsedData = (data as Record<string, unknown>) || {};

  if (!response.ok) {
    const code = (parsedData.code as string) || "UnknownError";
    const message = (parsedData.message as string) || "Unknown error occurred";

    throw new StyleComparisonAPIError(response.status, code, message, parsedData.details);
  }

  return parsedData as StyleComparisonResponse;
}
