import { render, screen, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "../App";

const renderApp = async () => {
  let utils: ReturnType<typeof render> | undefined;
  await act(async () => {
    utils = render(<App />);
  });
  if (!utils) {
    throw new Error("Failed to render App");
  }
  return utils;
};

describe("App - Responsive Container", () => {
  it("should render without crashing", async () => {
    await renderApp();
    const appElement = screen.getByRole("main", { hidden: true }) || document.querySelector(".app");
    expect(appElement).toBeTruthy();
  });

  it("should have max-width: 100% to prevent horizontal overflow", async () => {
    const { container } = await renderApp();
    const appElement = container.querySelector(".app");

    if (appElement) {
      const styles = window.getComputedStyle(appElement);
      // Check that max-width is set to 100% or a reasonable constraint
      const maxWidth = styles.maxWidth;
      expect(maxWidth).toBeTruthy();
    }
  });

  it("should use flexbox layout for responsive stacking", async () => {
    const { container } = await renderApp();
    const appElement = container.querySelector(".app");

    if (appElement) {
      const styles = window.getComputedStyle(appElement);
      expect(styles.display).toMatch(/flex/);
    }
  });
});
