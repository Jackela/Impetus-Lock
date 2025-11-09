import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useMediaQuery } from "./useMediaQuery";

describe("useMediaQuery", () => {
  let matchMediaMock: ReturnType<typeof vi.fn>;
  let listeners: ((event: MediaQueryListEvent) => void)[] = [];

  beforeEach(() => {
    listeners = [];

    // Mock window.matchMedia
    matchMediaMock = vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn((event: string, handler: (event: MediaQueryListEvent) => void) => {
        if (event === "change") {
          listeners.push(handler);
        }
      }),
      removeEventListener: vi.fn((event: string, handler: (event: MediaQueryListEvent) => void) => {
        if (event === "change") {
          listeners = listeners.filter((l) => l !== handler);
        }
      }),
      dispatchEvent: vi.fn(),
    }));

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: matchMediaMock,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return false when media query does not match", () => {
    matchMediaMock.mockReturnValue({
      matches: false,
      media: "(max-width: 767px)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const { result } = renderHook(() => useMediaQuery("(max-width: 767px)"));

    expect(result.current).toBe(false);
  });

  it("should return true when media query matches", () => {
    matchMediaMock.mockReturnValue({
      matches: true,
      media: "(max-width: 767px)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const { result } = renderHook(() => useMediaQuery("(max-width: 767px)"));

    expect(result.current).toBe(true);
  });

  it("should detect mobile breakpoint (< 768px)", () => {
    matchMediaMock.mockReturnValue({
      matches: true,
      media: "(max-width: 767px)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const { result } = renderHook(() => useMediaQuery("(max-width: 767px)"));

    expect(result.current).toBe(true);
    expect(matchMediaMock).toHaveBeenCalledWith("(max-width: 767px)");
  });

  it("should detect tablet breakpoint (768px - 1023px)", () => {
    matchMediaMock.mockReturnValue({
      matches: true,
      media: "(min-width: 768px) and (max-width: 1023px)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const { result } = renderHook(() =>
      useMediaQuery("(min-width: 768px) and (max-width: 1023px)")
    );

    expect(result.current).toBe(true);
  });

  it("should detect desktop breakpoint (>= 1024px)", () => {
    matchMediaMock.mockReturnValue({
      matches: true,
      media: "(min-width: 1024px)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const { result } = renderHook(() => useMediaQuery("(min-width: 1024px)"));

    expect(result.current).toBe(true);
  });

  it("should update when media query match changes", () => {
    let matches = false;
    const addEventListener = vi.fn((event: string, handler: () => void) => {
      if (event === "change") {
        listeners.push(handler);
      }
    });

    matchMediaMock.mockImplementation(() => ({
      matches,
      media: "(max-width: 767px)",
      addEventListener,
      removeEventListener: vi.fn(),
    }));

    const { result, rerender } = renderHook(() => useMediaQuery("(max-width: 767px)"));

    expect(result.current).toBe(false);

    // Simulate viewport resize that triggers media query change
    matches = true;
    listeners.forEach((listener) =>
      listener({ matches: true, media: "(max-width: 767px)" } as MediaQueryListEvent)
    );

    rerender();

    expect(result.current).toBe(true);
  });

  it("should subscribe to media query changes on mount", () => {
    const addEventListener = vi.fn();

    matchMediaMock.mockReturnValue({
      matches: false,
      media: "(max-width: 767px)",
      addEventListener,
      removeEventListener: vi.fn(),
    });

    renderHook(() => useMediaQuery("(max-width: 767px)"));

    expect(addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("should unsubscribe from media query changes on unmount", () => {
    const removeEventListener = vi.fn();

    matchMediaMock.mockReturnValue({
      matches: false,
      media: "(max-width: 767px)",
      addEventListener: vi.fn(),
      removeEventListener,
    });

    const { unmount } = renderHook(() => useMediaQuery("(max-width: 767px)"));

    unmount();

    expect(removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("should handle multiple simultaneous subscriptions with different queries", () => {
    matchMediaMock.mockImplementation((query: string) => ({
      matches: query === "(max-width: 767px)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    const { result: mobileResult } = renderHook(() => useMediaQuery("(max-width: 767px)"));
    const { result: desktopResult } = renderHook(() => useMediaQuery("(min-width: 1024px)"));

    expect(mobileResult.current).toBe(true);
    expect(desktopResult.current).toBe(false);
  });
});
