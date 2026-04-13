import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders with initial theme from localStorage", () => {
    localStorage.setItem("impetus-theme", "light");
    render(<ThemeToggle />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Current theme: light");
  });

  it("cycles theme on click", () => {
    render(<ThemeToggle />);
    const button = screen.getByRole("button");

    expect(button).toHaveAttribute("aria-label", "Current theme: dark");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-label", "Current theme: light");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-label", "Current theme: elevenlabs");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-label", "Current theme: dark");
  });

  it("persists theme to localStorage", () => {
    render(<ThemeToggle />);
    const button = screen.getByRole("button");

    fireEvent.click(button);
    expect(localStorage.getItem("impetus-theme")).toBe("light");

    fireEvent.click(button);
    expect(localStorage.getItem("impetus-theme")).toBe("elevenlabs");
  });
});
