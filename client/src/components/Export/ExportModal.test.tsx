import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ExportModal } from "./ExportModal";
import * as exportServiceModule from "../../services/exportService";

vi.mock("../../services/exportService", () => ({
  exportMarkdown: vi.fn(),
  exportPdf: vi.fn(),
}));

describe("ExportModal", () => {
  const defaultProps = {
    open: true,
    content: "# Hello World",
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("rendering", () => {
    it("should not render when open is false", () => {
      render(<ExportModal {...defaultProps} open={false} />);

      expect(screen.queryByTestId("export-modal")).not.toBeInTheDocument();
    });

    it("should render when open is true", () => {
      render(<ExportModal {...defaultProps} />);

      expect(screen.getByTestId("export-modal")).toBeInTheDocument();
    });

    it("should render title", () => {
      render(<ExportModal {...defaultProps} />);

      expect(screen.getByText("Export Document")).toBeInTheDocument();
    });

    it("should render filename input with default value", () => {
      render(<ExportModal {...defaultProps} />);

      const input = screen.getByTestId("export-filename-input");
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue("impetus-export");
    });

    it("should render export buttons and cancel button", () => {
      render(<ExportModal {...defaultProps} />);

      expect(screen.getByTestId("export-markdown")).toBeInTheDocument();
      expect(screen.getByTestId("export-pdf")).toBeInTheDocument();
      expect(screen.getByTestId("export-cancel")).toBeInTheDocument();
    });
  });

  describe("export actions", () => {
    it("should call exportMarkdown when Markdown button clicked", async () => {
      render(<ExportModal {...defaultProps} />);

      const markdownButton = screen.getByTestId("export-markdown");
      fireEvent.click(markdownButton);
      await act(() => vi.advanceTimersByTimeAsync(150));

      expect(exportServiceModule.exportMarkdown).toHaveBeenCalledWith(
        "# Hello World",
        "impetus-export"
      );
    });

    it("should call exportPdf when PDF button clicked", async () => {
      render(<ExportModal {...defaultProps} />);

      const pdfButton = screen.getByTestId("export-pdf");
      fireEvent.click(pdfButton);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(exportServiceModule.exportPdf).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining("<!DOCTYPE html>"),
          filename: "impetus-export",
        })
      );
    });

    it("should pass htmlContent to exportPdf when provided", async () => {
      render(<ExportModal {...defaultProps} htmlContent="<h1>Custom HTML</h1>" />);

      const pdfButton = screen.getByTestId("export-pdf");
      fireEvent.click(pdfButton);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(exportServiceModule.exportPdf).toHaveBeenCalledWith({
        html: "<h1>Custom HTML</h1>",
        filename: "impetus-export",
      });
    });

    it("keeps the filename and permits a second download after a PDF failure", async () => {
      vi.mocked(exportServiceModule.exportPdf)
        .mockRejectedValueOnce(new Error("render failed"))
        .mockResolvedValueOnce(undefined);
      render(<ExportModal {...defaultProps} />);

      const filename = screen.getByRole("textbox", { name: "Filename" });
      const download = screen.getByRole("button", { name: "Export PDF" });
      fireEvent.change(filename, { target: { value: "a long draft" } });
      fireEvent.click(download);
      expect(download).toBeDisabled();
      await act(() => vi.advanceTimersByTimeAsync(200));

      expect(defaultProps.onClose).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent(/retry/i);
      expect(filename).toHaveValue("a long draft");
      expect(download).toBeEnabled();

      fireEvent.click(download);
      await act(() => vi.advanceTimersByTimeAsync(200));

      expect(exportServiceModule.exportPdf).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ filename: "a long draft" })
      );
      expect(defaultProps.onClose).toHaveBeenCalledOnce();
    });
  });

  describe("cancel and close", () => {
    it("should call onClose when cancel is clicked", () => {
      render(<ExportModal {...defaultProps} />);

      const cancelButton = screen.getByTestId("export-cancel");
      fireEvent.click(cancelButton);

      act(() => {
        vi.advanceTimersByTime(150);
      });

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it("should call onClose when overlay is clicked", () => {
      render(<ExportModal {...defaultProps} />);

      const overlay = screen.getByTestId("export-modal");
      fireEvent.click(overlay);

      act(() => {
        vi.advanceTimersByTime(150);
      });

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it("should call onClose when Escape is pressed", () => {
      render(<ExportModal {...defaultProps} />);

      fireEvent.keyDown(window, { key: "Escape" });

      act(() => {
        vi.advanceTimersByTime(150);
      });

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it("keeps a newly opened modal independent of a previous exit animation", () => {
      const { rerender } = render(<ExportModal {...defaultProps} />);
      fireEvent.click(screen.getByTestId("export-cancel"));
      rerender(<ExportModal {...defaultProps} open={false} />);
      rerender(<ExportModal {...defaultProps} />);
      fireEvent.change(screen.getByTestId("export-filename-input"), {
        target: { value: "new export" },
      });

      act(() => {
        vi.advanceTimersByTime(150);
      });

      expect(screen.getByTestId("export-filename-input")).toHaveValue("new export");
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it("should not close when clicking modal content", () => {
      render(<ExportModal {...defaultProps} />);

      const modalContent = screen
        .getByText("Export Document")
        .closest<HTMLElement>(".export-modal");
      modalContent?.click();

      act(() => {
        vi.advanceTimersByTime(150);
      });

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  describe("accessibility", () => {
    it("should have role dialog", () => {
      render(<ExportModal {...defaultProps} />);

      expect(screen.getByTestId("export-modal")).toHaveAttribute("role", "dialog");
    });

    it("should have aria-modal", () => {
      render(<ExportModal {...defaultProps} />);

      expect(screen.getByTestId("export-modal")).toHaveAttribute("aria-modal", "true");
    });

    it("should have aria-labelledby pointing to title", () => {
      render(<ExportModal {...defaultProps} />);

      expect(screen.getByTestId("export-modal")).toHaveAttribute(
        "aria-labelledby",
        "export-modal-title"
      );
    });
  });
});
