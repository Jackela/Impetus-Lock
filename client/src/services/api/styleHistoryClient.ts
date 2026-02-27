import type { StyleVector } from "./types";

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

  const response = await fetch(`http://127.0.0.1:8000/style/history/user/${userId}?${params}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch style history: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get a specific style history record
 */
export async function getStyleHistoryById(id: string): Promise<StyleHistoryRecord> {
  const response = await fetch(`http://127.0.0.1:8000/style/history/${id}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Style history not found");
    }
    throw new Error(`Failed to fetch style history: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Delete a style history record
 */
export async function deleteStyleHistory(id: string): Promise<void> {
  const response = await fetch(`http://127.0.0.1:8000/style/history/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Style history not found");
    }
    throw new Error(`Failed to delete style history: ${response.statusText}`);
  }
}
