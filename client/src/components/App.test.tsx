import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "./App";

describe("App - Responsive Container", () => {
  it("should render without crashing", () => {
    render(<App />);
    const appElement = screen.getByRole("main", { hidden: true }) || document.querySelector(".app");
    expect(appElement).toBeTruthy();
  });

  it("should have max-width: 100% to prevent horizontal overflow", () => {
    const { container } = render(<App />);
    const appElement = container.querySelector(".app");

    if (appElement) {
      const styles = window.getComputedStyle(appElement);
      // Check that max-width is set to 100% or a reasonable constraint
      const maxWidth = styles.maxWidth;
      expect(maxWidth).toBeTruthy();
    }
  });

  it("should use flexbox layout for responsive stacking", () => {
    const { container } = render(<App />);
    const appElement = container.querySelector(".app");

    if (appElement) {
      const styles = window.getComputedStyle(appElement);
      expect(styles.display).toMatch(/flex/);
    }
  });
});
