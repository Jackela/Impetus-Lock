/**
 * useInterventionApiError Hook Tests
 *
 * Test suite for intervention API error type guard utility.
 *
 * Constitutional Compliance:
 * - Article III (TDD): Tests for type guard validation
 * - Article V (Documentation): Test names describe behavior
 *
 * @module hooks/useInterventionApiError.test
 */

import { describe, it, expect } from "vitest";
import { InterventionAPIError } from "../services/api/interventionClient";
import { isInterventionAPIError } from "./useInterventionApiError";

describe("isInterventionAPIError", () => {
  it("returns true for InterventionAPIError instances", () => {
    const error = new InterventionAPIError(
      500,
      "INTERNAL_ERROR",
      "Test error message",
      { detail: "additional info" }
    );

    expect(isInterventionAPIError(error)).toBe(true);
  });

  it("returns false for generic Error instances", () => {
    const genericError = new Error("Generic error");
    const typeError = new TypeError("Type error");
    const rangeError = new RangeError("Range error");

    expect(isInterventionAPIError(genericError)).toBe(false);
    expect(isInterventionAPIError(typeError)).toBe(false);
    expect(isInterventionAPIError(rangeError)).toBe(false);
  });

  it("returns false for null and undefined", () => {
    expect(isInterventionAPIError(null)).toBe(false);
    expect(isInterventionAPIError(undefined)).toBe(false);
  });

  it("returns false for non-error values", () => {
    expect(isInterventionAPIError("string error")).toBe(false);
    expect(isInterventionAPIError(42)).toBe(false);
    expect(isInterventionAPIError({ message: "object" })).toBe(false);
    expect(isInterventionAPIError([])).toBe(false);
  });
});
