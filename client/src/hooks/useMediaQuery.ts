import { useSyncExternalStore } from "react";

/**
 * React hook for responsive breakpoint detection using window.matchMedia API
 *
 * This hook provides a React 19-compatible way to detect viewport breakpoints using
 * useSyncExternalStore for concurrent-safe external state management.
 *
 * @param query - CSS media query string (e.g., "(max-width: 767px)")
 * @returns boolean - true if media query matches current viewport, false otherwise
 *
 * @example
 * ```tsx
 * // Detect mobile viewport (< 768px)
 * const isMobile = useMediaQuery("(max-width: 767px)");
 *
 * // Detect tablet range (768px - 1023px)
 * const isTablet = useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
 *
 * // Detect desktop (≥ 1024px)
 * const isDesktop = useMediaQuery("(min-width: 1024px)");
 *
 * // Conditional rendering based on breakpoint
 * return isMobile ? <MobileToolbar /> : <DesktopToolbar />;
 * ```
 *
 * @remarks
 * - Uses native window.matchMedia API (no external dependencies)
 * - Automatically subscribes/unsubscribes to media query changes
 * - SSR-safe: returns false during server-side rendering
 * - Concurrent-safe: uses useSyncExternalStore for React 19 compatibility
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia
 * @see https://react.dev/reference/react/useSyncExternalStore
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = (callback: () => void) => {
    const mediaQueryList = window.matchMedia(query);

    // Modern browsers use addEventListener
    mediaQueryList.addEventListener("change", callback);

    return () => {
      mediaQueryList.removeEventListener("change", callback);
    };
  };

  const getSnapshot = () => {
    return window.matchMedia(query).matches;
  };

  const getServerSnapshot = () => {
    // During SSR, assume desktop viewport (safest default)
    return false;
  };

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
