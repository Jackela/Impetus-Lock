/**
 * Style API Client Tests
 *
 * Tests for style learning API communication.
 *
 * @module services/api/styleClient.test
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  analyzeStyle,
  applyStyle,
  StyleAPIError,
  type StyleVector,
  type StyleAnalysisResponse,
  type StyleApplyResponse,
} from "./styleClient";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

describe("styleClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("StyleAPIError", () => {
    it("should create error with status, code, and message", () => {
      const error = new StyleAPIError(400, "validation_error", "Invalid input");

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(StyleAPIError);
      expect(error.name).toBe("StyleAPIError");
      expect(error.status).toBe(400);
      expect(error.code).toBe("validation_error");
      expect(error.message).toBe("Invalid input");
    });

    it("should create error with details", () => {
      const details = { field: "text", minWords: 500 };
      const error = new StyleAPIError(400, "validation_error", "Text too short", details);

      expect(error.details).toEqual(details);
    });
  });

  describe("analyzeStyle", () => {
    const sampleText = "This is a sample text. ".repeat(100); // ~500 words equivalent
    const userId = "user-123";

    it("should call POST /style/analyze with correct payload", async () => {
      const mockResponse: StyleAnalysisResponse = {
        user_id: userId,
        style_vector: {
          avg_sentence_length: 15.5,
          vocab_richness: 0.72,
          punctuation_density: 0.05,
          paragraph_length_avg: 3.2,
          dialogue_ratio: 0.15,
        },
        confidence: 0.85,
        analyzed_at: "2024-01-15T10:30:00Z",
      };

      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await analyzeStyle(sampleText, userId);

      expect(fetchSpy).toHaveBeenCalledWith(`${API_BASE_URL}/style/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: sampleText,
          user_id: userId,
        }),
      });

      expect(result).toEqual(mockResponse);
    });

    it("should throw StyleAPIError on validation failure (400)", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            code: "text_too_short",
            message: "Text must be at least 500 words",
          }),
      } as Response);

      await expect(analyzeStyle("short text", userId)).rejects.toThrow(StyleAPIError);

      await expect(analyzeStyle("short text", userId)).rejects.toMatchObject({
        status: 400,
        code: "text_too_short",
        message: "Text must be at least 500 words",
      });
    });

    it("should throw StyleAPIError on server error (500)", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 500,
        json: () =>
          Promise.resolve({
            code: "internal_error",
            message: "Internal server error",
          }),
      } as Response);

      await expect(analyzeStyle(sampleText, userId)).rejects.toThrow(StyleAPIError);

      await expect(analyzeStyle(sampleText, userId)).rejects.toMatchObject({
        status: 500,
        code: "internal_error",
      });
    });

    it("should support AbortSignal for cancellation", async () => {
      const controller = new AbortController();
      const mockResponse: StyleAnalysisResponse = {
        user_id: userId,
        style_vector: {
          avg_sentence_length: 15.5,
          vocab_richness: 0.72,
          punctuation_density: 0.05,
          paragraph_length_avg: 3.2,
          dialogue_ratio: 0.15,
        },
        confidence: 0.85,
        analyzed_at: "2024-01-15T10:30:00Z",
      };

      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      await analyzeStyle(sampleText, userId, { signal: controller.signal });

      expect(fetchSpy).toHaveBeenCalledWith(
        `${API_BASE_URL}/style/analyze`,
        expect.objectContaining({
          signal: controller.signal,
        })
      );
    });

    it("should propagate AbortError without wrapping", async () => {
      const controller = new AbortController();
      controller.abort();

      vi.spyOn(global, "fetch").mockRejectedValue(
        Object.assign(new Error("Aborted"), { name: "AbortError" })
      );

      await expect(analyzeStyle(sampleText, userId, { signal: controller.signal })).rejects.toThrow(
        "Aborted"
      );
    });
  });

  describe("applyStyle", () => {
    const sampleText = "This is text to transform.";
    const userId = "user-123";
    const intensity = 0.7;

    it("should call POST /style/apply with correct payload", async () => {
      const mockResponse: StyleApplyResponse = {
        transformed_text: "This is the transformed text with style applied.",
        style_user_id: userId,
        intensity: intensity,
        applied_at: "2024-01-15T10:35:00Z",
      };

      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await applyStyle(sampleText, userId, intensity);

      expect(fetchSpy).toHaveBeenCalledWith(`${API_BASE_URL}/style/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: sampleText,
          user_id: userId,
          intensity: intensity,
        }),
      });

      expect(result).toEqual(mockResponse);
    });

    it("should use default intensity of 1.0 when not specified", async () => {
      const mockResponse: StyleApplyResponse = {
        transformed_text: "Transformed text.",
        style_user_id: userId,
        intensity: 1.0,
        applied_at: "2024-01-15T10:35:00Z",
      };

      let capturedBody: string | undefined;

      vi.spyOn(global, "fetch").mockImplementation(async (_url, init) => {
        capturedBody = init?.body as string;
        return {
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response;
      });

      await applyStyle(sampleText, userId);

      const requestBody = JSON.parse(capturedBody as string);
      expect(requestBody.intensity).toBe(1.0);
    });

    it("should throw StyleAPIError on style not found (404)", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 404,
        json: () =>
          Promise.resolve({
            code: "style_not_found",
            message: "No style profile found for this user",
          }),
      } as Response);

      await expect(applyStyle(sampleText, userId, intensity)).rejects.toThrow(StyleAPIError);

      await expect(applyStyle(sampleText, userId, intensity)).rejects.toMatchObject({
        status: 404,
        code: "style_not_found",
      });
    });

    it("should throw StyleAPIError on invalid intensity (400)", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            code: "invalid_intensity",
            message: "Intensity must be between 0 and 1",
          }),
      } as Response);

      await expect(applyStyle(sampleText, userId, 1.5)).rejects.toMatchObject({
        status: 400,
        code: "invalid_intensity",
      });
    });

    it("should support AbortSignal for cancellation", async () => {
      const controller = new AbortController();
      const mockResponse: StyleApplyResponse = {
        transformed_text: "Transformed.",
        style_user_id: userId,
        intensity: intensity,
        applied_at: "2024-01-15T10:35:00Z",
      };

      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      await applyStyle(sampleText, userId, intensity, { signal: controller.signal });

      expect(fetchSpy).toHaveBeenCalledWith(
        `${API_BASE_URL}/style/apply`,
        expect.objectContaining({
          signal: controller.signal,
        })
      );
    });
  });

  describe("types", () => {
    it("StyleVector should have required properties", () => {
      const vector: StyleVector = {
        avg_sentence_length: 15.5,
        vocab_richness: 0.72,
        punctuation_density: 0.05,
        paragraph_length_avg: 3.2,
        dialogue_ratio: 0.15,
      };

      expect(vector.avg_sentence_length).toBe(15.5);
      expect(vector.vocab_richness).toBe(0.72);
      expect(vector.punctuation_density).toBe(0.05);
      expect(vector.paragraph_length_avg).toBe(3.2);
      expect(vector.dialogue_ratio).toBe(0.15);
    });

    it("StyleAnalysisResponse should have required properties", () => {
      const response: StyleAnalysisResponse = {
        user_id: "user-123",
        style_vector: {
          avg_sentence_length: 15.5,
          vocab_richness: 0.72,
          punctuation_density: 0.05,
          paragraph_length_avg: 3.2,
          dialogue_ratio: 0.15,
        },
        confidence: 0.85,
        analyzed_at: "2024-01-15T10:30:00Z",
      };

      expect(response.user_id).toBe("user-123");
      expect(response.confidence).toBe(0.85);
      expect(response.analyzed_at).toBe("2024-01-15T10:30:00Z");
    });

    it("StyleApplyResponse should have required properties", () => {
      const response: StyleApplyResponse = {
        transformed_text: "Transformed text.",
        style_user_id: "user-123",
        intensity: 0.7,
        applied_at: "2024-01-15T10:35:00Z",
      };

      expect(response.transformed_text).toBe("Transformed text.");
      expect(response.style_user_id).toBe("user-123");
      expect(response.intensity).toBe(0.7);
      expect(response.applied_at).toBe("2024-01-15T10:35:00Z");
    });
  });
});
