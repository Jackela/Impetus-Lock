import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StyleComparisonChart } from "./StyleComparisonChart";

describe("StyleComparisonChart", () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 400, 400)
    );
    // jsdom has no layout observer; supply only that browser boundary.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("formats numeric tooltip values to two decimals through chart keyboard interaction", async () => {
    render(
      <StyleComparisonChart
        vector1={{ complexity: 0.125 }}
        vector2={{ complexity: 0 }}
        label1="First sample"
        label2="Second sample"
      />
    );
    const chart = await screen.findByRole("application");
    fireEvent.keyDown(chart, { key: "ArrowRight" });
    await waitFor(() => {
      expect(screen.getByText("0.13")).toBeInTheDocument();
      expect(screen.getByText("0.00")).toBeInTheDocument();
    });
  });

  it("renders sparse vectors without inventing a numeric tooltip value", async () => {
    render(<StyleComparisonChart vector1={{}} vector2={{ complexity: 0.25 }} />);
    const chart = await screen.findByRole("application");
    fireEvent.keyDown(chart, { key: "ArrowRight" });
    await waitFor(() => expect(screen.getByText("0.25")).toBeInTheDocument());
    expect(screen.queryByText("0.00")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export as PNG" })).toBeEnabled();
  });
});
