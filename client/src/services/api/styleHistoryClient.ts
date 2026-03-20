import type { StyleVector } from "./types";
import { secureApiClient } from "../security/secureApi";

/**
 * Style History Record - Single analysis result
 */
export interface StyleHistoryRecord {
  id: string;
  user_id: string;
  text: string;
  style_vector: StyleVector;
  created_at: string;
}

/**
 * Paginated Style History List Response
 */
export interface StyleHistoryListResponse {
  items: StyleHistoryRecord[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Fetch style history for a user
 */
export async function getStyleHistory(
  userId: string,
  limit: number = 10,
  offset: number = 0
): Promise<StyleHistoryListResponse> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  const response = await secureApiClient.get(`/style/history/user/${userId}?${params}`);
  return response.data;
}

/**
 * Get a specific style history record
 */
export async function getStyleHistoryById(id: string): Promise<StyleHistoryRecord> {
  const response = await secureApiClient.get(`/style/history/${id}`);
  return response.data;
}

/**
 * Delete a style history record
 */
export async function deleteStyleHistory(id: string): Promise<void> {
  await secureApiClient.delete(`/style/history/${id}`);
}
