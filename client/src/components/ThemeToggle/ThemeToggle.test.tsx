import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "../../contexts/ThemeContext";
import { ThemeToggle } from "./ThemeToggle";

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>
  );
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders with initial theme from localStorage", () => {
    localStorage.setItem("impetus-theme", "light");
    renderToggle();
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Current theme: light");
  });

  it("cycles theme on click", () => {
    renderToggle();
    const button = screen.getByRole("button");

    expect(button).toHaveAttribute("aria-label", "Current theme: dark");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-label", "Current theme: light");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-label", "Current theme: elevenlabs");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-label", "Current theme: dark");
  });

  it("applies the stored theme to the document root on startup", () => {
    localStorage.setItem("impetus-theme", "elevenlabs");
    renderToggle();
    expect(document.documentElement).toHaveAttribute("data-theme", "elevenlabs");
  });

  it("persists theme to localStorage", () => {
    renderToggle();
    const button = screen.getByRole("button");

    fireEvent.click(button);
    expect(localStorage.getItem("impetus-theme")).toBe("light");

    fireEvent.click(button);
    expect(localStorage.getItem("impetus-theme")).toBe("elevenlabs");
  });
});
