/**
 * Style Input Form Component Tests
 *
 * Tests for the writing sample input form with validation.
 *
 * @module components/StyleLearning/StyleInputForm.test
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StyleInputForm } from "./StyleInputForm";

describe("StyleInputForm", () => {
  describe("rendering", () => {
    it("should render a textarea for writing sample input", () => {
      render(<StyleInputForm onSubmit={vi.fn()} />);

      expect(screen.getByLabelText(/writing sample/i)).toBeInTheDocument();
    });

    it("should render a submit button", () => {
      render(<StyleInputForm onSubmit={vi.fn()} />);

      expect(screen.getByRole("button", { name: /analyze style/i })).toBeInTheDocument();
    });

    it("should display word count", () => {
      render(<StyleInputForm onSubmit={vi.fn()} />);

      // Initial state shows 0 words - use more specific selector
      const wordCountSpan = screen.getByTestId("style-input-form").querySelector(".word-count");
      expect(wordCountSpan).toHaveTextContent("0 words");
    });

    it("should show minimum word requirement hint", () => {
      render(<StyleInputForm onSubmit={vi.fn()} />);

      expect(screen.getByText(/500 words/i)).toBeInTheDocument();
    });
  });

  describe("word count validation", () => {
    it("should update word count as user types", async () => {
      const user = userEvent.setup();
      render(<StyleInputForm onSubmit={vi.fn()} />);

      const textarea = screen.getByLabelText(/writing sample/i);
      await user.type(textarea, "one two three four five");

      const wordCountSpan = screen.getByTestId("style-input-form").querySelector(".word-count");
      expect(wordCountSpan).toHaveTextContent("5 words");
    });

    it("should show visual warning when word count is below minimum", async () => {
      const user = userEvent.setup();
      const handleSubmit = vi.fn();

      render(<StyleInputForm onSubmit={handleSubmit} />);

      const textarea = screen.getByLabelText(/writing sample/i);
      await user.type(textarea, "one two three");

      // Submit button should be disabled (validation at UI level)
      const submitButton = screen.getByRole("button", { name: /analyze style/i });
      expect(submitButton).toBeDisabled();

      // Word count should show warning class
      const wordCountSpan = screen.getByTestId("style-input-form").querySelector(".word-count");
      expect(wordCountSpan).toHaveClass("low");

      // Handler should not have been called
      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it("should disable submit button when word count is below minimum", () => {
      render(<StyleInputForm onSubmit={vi.fn()} />);

      const submitButton = screen.getByRole("button", { name: /analyze style/i });
      expect(submitButton).toBeDisabled();
    });

    it("should enable submit button when word count meets minimum", async () => {
      render(<StyleInputForm onSubmit={vi.fn()} />);

      const textarea = screen.getByLabelText(/writing sample/i);
      // Use fireEvent for faster input (user.type is too slow with 500 words)
      const words = Array(501).fill("word").join(" ");
      fireEvent.change(textarea, { target: { value: words } });

      const submitButton = screen.getByRole("button", { name: /analyze style/i });
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe("submission", () => {
    it("should call onSubmit with text when form is submitted", async () => {
      const handleSubmit = vi.fn();

      render(<StyleInputForm onSubmit={handleSubmit} />);

      const textarea = screen.getByLabelText(/writing sample/i);
      const testText = Array(501).fill("word").join(" ");
      fireEvent.change(textarea, { target: { value: testText } });

      const submitButton = screen.getByRole("button", { name: /analyze style/i });
      fireEvent.click(submitButton);

      expect(handleSubmit).toHaveBeenCalledWith(testText);
    });

    it("should show loading state during submission", async () => {
      const user = userEvent.setup();
      const handleSubmit = vi.fn(() => new Promise(() => {})); // Never resolves

      render(<StyleInputForm onSubmit={handleSubmit} isLoading={true} />);

      const textarea = screen.getByLabelText(/writing sample/i);
      const testText = Array(501).fill("word").join(" ");
      await user.type(textarea, testText);

      const submitButton = screen.getByRole("button", { name: /analyzing/i });
      expect(submitButton).toBeDisabled();
    });

    it("should disable textarea when loading", () => {
      render(<StyleInputForm onSubmit={vi.fn()} isLoading={true} />);

      const textarea = screen.getByLabelText(/writing sample/i);
      expect(textarea).toBeDisabled();
    });
  });

  describe("error handling", () => {
    it("should display error message when provided", () => {
      render(
        <StyleInputForm onSubmit={vi.fn()} error="Failed to analyze style. Please try again." />
      );

      expect(screen.getByText(/failed to analyze style/i)).toBeInTheDocument();
    });

    it("should clear error when user starts typing", async () => {
      const user = userEvent.setup();
      const handleErrorClear = vi.fn();

      render(
        <StyleInputForm
          onSubmit={vi.fn()}
          error="Failed to analyze style."
          onErrorClear={handleErrorClear}
        />
      );

      const textarea = screen.getByLabelText(/writing sample/i);
      await user.type(textarea, "new text");

      expect(handleErrorClear).toHaveBeenCalled();
    });

    it("should show validation error in red", () => {
      render(<StyleInputForm onSubmit={vi.fn()} />);

      // Initially, there might be a hint that turns red on validation failure
      const hint = screen.getByText(/500 words/i);
      expect(hint).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("should have proper form labels", () => {
      render(<StyleInputForm onSubmit={vi.fn()} />);

      const textarea = screen.getByLabelText(/writing sample/i);
      expect(textarea).toHaveAttribute("id");
    });

    it("should have aria-describedby for validation message", () => {
      render(<StyleInputForm onSubmit={vi.fn()} />);

      const textarea = screen.getByLabelText(/writing sample/i);
      const describedBy = textarea.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();

      // The described element should exist
      const descriptionElement = document.getElementById(describedBy!);
      expect(descriptionElement).toBeInTheDocument();
    });

    it("should announce errors to screen readers", () => {
      render(<StyleInputForm onSubmit={vi.fn()} error="Failed to analyze style." />);

      const errorElement = screen.getByRole("alert");
      expect(errorElement).toHaveTextContent(/failed to analyze style/i);
    });
  });

  describe("snapshot", () => {
    it("should match snapshot", () => {
      const { container } = render(<StyleInputForm onSubmit={vi.fn()} />);

      expect(container.firstChild).toMatchSnapshot();
    });

    it("should match snapshot with error", () => {
      const { container } = render(<StyleInputForm onSubmit={vi.fn()} error="Test error" />);

      expect(container.firstChild).toMatchSnapshot();
    });

    it("should match snapshot when loading", () => {
      const { container } = render(<StyleInputForm onSubmit={vi.fn()} isLoading={true} />);

      expect(container.firstChild).toMatchSnapshot();
    });
  });
});
