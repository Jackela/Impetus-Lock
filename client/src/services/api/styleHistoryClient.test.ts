import { describe, it, expect, vi } from "vitest";
import { getStyleHistory, getStyleHistoryById, deleteStyleHistory } from "./styleHistoryClient";

describe("styleHistoryClient", () => {
  const mockUserId = "test-user-123";
  const mockHistoryId = "history-456";

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("getStyleHistory", () => {
    it("should fetch style history with pagination", async () => {
      const mockResponse = {
        items: [
          {
            id: "1",
            user_id: mockUserId,
            text: "Sample text",
            style_vector: { tone: 0.8 },
            created_at: "2026-02-27T12:00:00Z",
          },
        ],
        total: 1,
        limit: 10,
        offset: 0,
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getStyleHistory(mockUserId, 10, 0);

      expect(fetch).toHaveBeenCalledWith(
        `http://127.0.0.1:8000/style/history/user/${mockUserId}?limit=10&offset=0`
      );
      expect(result).toEqual(mockResponse);
    });

    it("should throw error on fetch failure", async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: "Internal Server Error",
      });

      await expect(getStyleHistory(mockUserId)).rejects.toThrow("Failed to fetch style history");
    });
  });

  describe("getStyleHistoryById", () => {
    it("should fetch a specific history record", async () => {
      const mockRecord = {
        id: mockHistoryId,
        user_id: mockUserId,
        text: "Sample text",
        style_vector: { tone: 0.8 },
        created_at: "2026-02-27T12:00:00Z",
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRecord,
      });

      const result = await getStyleHistoryById(mockHistoryId);

      expect(fetch).toHaveBeenCalledWith(`http://127.0.0.1:8000/style/history/${mockHistoryId}`);
      expect(result).toEqual(mockRecord);
    });

    it("should throw 404 error when not found", async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      await expect(getStyleHistoryById(mockHistoryId)).rejects.toThrow("Style history not found");
    });
  });

  describe("deleteStyleHistory", () => {
    it("should delete a history record", async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      await deleteStyleHistory(mockHistoryId);

      expect(fetch).toHaveBeenCalledWith(`http://127.0.0.1:8000/style/history/${mockHistoryId}`, {
        method: "DELETE",
      });
    });

    it("should throw 404 error when not found", async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      await expect(deleteStyleHistory(mockHistoryId)).rejects.toThrow("Style history not found");
    });
  });
});
