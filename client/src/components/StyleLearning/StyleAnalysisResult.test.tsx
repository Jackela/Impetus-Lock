/**
 * Style Analysis Result Component Tests
 *
 * Tests for displaying style analysis results.
 *
 * @module components/StyleLearning/StyleAnalysisResult.test
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StyleAnalysisResult } from "./StyleAnalysisResult";
import type { StyleAnalysisResponse } from "./types";

/** Sample style vector for testing */
const sampleStyleVector = {
  avg_sentence_length: 15.5,
  vocab_richness: 0.72,
  punctuation_density: 0.05,
  paragraph_length_avg: 3.2,
  dialogue_ratio: 0.15,
};

/** Sample analysis result for testing */
const sampleResult: StyleAnalysisResponse = {
  user_id: "user-123",
  style_vector: sampleStyleVector,
  confidence: 0.85,
  analyzed_at: "2024-01-15T10:30:00Z",
};

describe("StyleAnalysisResult", () => {
  describe("rendering", () => {
    it("should render the style vector metrics", () => {
      render(<StyleAnalysisResult result={sampleResult} />);

      expect(screen.getByText(/average sentence length/i)).toBeInTheDocument();
      expect(screen.getByText(/vocabulary richness/i)).toBeInTheDocument();
      expect(screen.getByText(/punctuation density/i)).toBeInTheDocument();
      expect(screen.getByText(/paragraph length/i)).toBeInTheDocument();
      expect(screen.getByText(/dialogue ratio/i)).toBeInTheDocument();
    });

    it("should display metric values correctly", () => {
      render(<StyleAnalysisResult result={sampleResult} />);

      // Check formatted values
      expect(screen.getByText("15.5")).toBeInTheDocument();
      expect(screen.getByText("72%")).toBeInTheDocument();
      expect(screen.getByText("5%")).toBeInTheDocument();
      expect(screen.getByText("3.2")).toBeInTheDocument();
      expect(screen.getByText("15%")).toBeInTheDocument();
    });

    it("should display confidence score", () => {
      render(<StyleAnalysisResult result={sampleResult} />);

      expect(screen.getByText(/confidence/i)).toBeInTheDocument();
      expect(screen.getByText("85%")).toBeInTheDocument();
    });

    it("should display confidence indicator (visual bar)", () => {
      const { container } = render(<StyleAnalysisResult result={sampleResult} />);

      const confidenceBar = container.querySelector(".confidence-bar-fill");
      expect(confidenceBar).toBeInTheDocument();
      expect(confidenceBar).toHaveStyle({ width: "85%" });
    });

    it("should display analysis timestamp", () => {
      render(<StyleAnalysisResult result={sampleResult} />);

      // Date should be formatted and displayed
      expect(screen.getByText(/analyzed/i)).toBeInTheDocument();
    });
  });

  describe("Apply to Task button", () => {
    it("should render Apply to Task button", () => {
      render(<StyleAnalysisResult result={sampleResult} />);

      expect(screen.getByRole("button", { name: /apply to task/i })).toBeInTheDocument();
    });

    it("should call onApplyClick when button is clicked", async () => {
      const user = userEvent.setup();
      const handleApplyClick = vi.fn();

      render(<StyleAnalysisResult result={sampleResult} onApplyClick={handleApplyClick} />);

      const button = screen.getByRole("button", { name: /apply to task/i });
      await user.click(button);

      expect(handleApplyClick).toHaveBeenCalledTimes(1);
    });

    it("should not crash when onApplyClick is not provided", async () => {
      const user = userEvent.setup();

      render(<StyleAnalysisResult result={sampleResult} />);

      const button = screen.getByRole("button", { name: /apply to task/i });
      // Should not throw
      await user.click(button);
    });

    it("should show button as disabled when isApplyDisabled is true", () => {
      render(
        <StyleAnalysisResult result={sampleResult} onApplyClick={vi.fn()} isApplyDisabled={true} />
      );

      const button = screen.getByRole("button", { name: /apply to task/i });
      expect(button).toBeDisabled();
    });
  });

  describe("accessibility", () => {
    it("should have proper heading structure", () => {
      render(<StyleAnalysisResult result={sampleResult} />);

      expect(screen.getByRole("heading", { name: /style analysis/i })).toBeInTheDocument();
    });

    it("should have accessible metric labels", () => {
      const { container } = render(<StyleAnalysisResult result={sampleResult} />);

      const metrics = container.querySelectorAll(".metric-item");
      expect(metrics.length).toBeGreaterThan(0);

      metrics.forEach((metric) => {
        expect(metric.querySelector(".metric-label")).toBeInTheDocument();
        expect(metric.querySelector(".metric-value")).toBeInTheDocument();
      });
    });

    it("should have aria-label for confidence bar", () => {
      const { container } = render(<StyleAnalysisResult result={sampleResult} />);

      const confidenceBar = container.querySelector(".confidence-bar-fill");
      expect(confidenceBar).toHaveAttribute("aria-label", "85% confidence");
    });
  });

  describe("edge cases", () => {
    it("should handle zero values correctly", () => {
      const zeroResult: StyleAnalysisResponse = {
        user_id: "user-123",
        style_vector: {
          avg_sentence_length: 0,
          vocab_richness: 0,
          punctuation_density: 0,
          paragraph_length_avg: 0,
          dialogue_ratio: 0,
        },
        confidence: 0,
        analyzed_at: "2024-01-15T10:30:00Z",
      };

      render(<StyleAnalysisResult result={zeroResult} />);

      // Zero values are formatted correctly (0.0 for decimals, 0% for percentages)
      // There are two 0.0 values (avg_sentence_length and paragraph_length_avg)
      const zeroValues = screen.getAllByText("0.0");
      expect(zeroValues.length).toBe(2);

      // There are three 0% values (vocab_richness, punctuation_density, dialogue_ratio, confidence)
      const zeroPercents = screen.getAllByText("0%");
      expect(zeroPercents.length).toBeGreaterThanOrEqual(3);
    });

    it("should handle high confidence values", () => {
      const highResult = {
        ...sampleResult,
        confidence: 0.99,
      };

      const { container } = render(<StyleAnalysisResult result={highResult} />);

      const confidenceBar = container.querySelector(".confidence-bar-fill");
      expect(confidenceBar).toHaveStyle({ width: "99%" });
    });

    it("should handle low confidence values", () => {
      const lowResult = {
        ...sampleResult,
        confidence: 0.25,
      };

      const { container } = render(<StyleAnalysisResult result={lowResult} />);

      const confidenceBar = container.querySelector(".confidence-bar-fill");
      expect(confidenceBar).toHaveStyle({ width: "25%" });
    });
  });

  describe("snapshot", () => {
    it("should match snapshot", () => {
      const { container } = render(<StyleAnalysisResult result={sampleResult} />);

      expect(container.firstChild).toMatchSnapshot();
    });

    it("should match snapshot with disabled button", () => {
      const { container } = render(
        <StyleAnalysisResult result={sampleResult} isApplyDisabled={true} />
      );

      expect(container.firstChild).toMatchSnapshot();
    });
  });
});
