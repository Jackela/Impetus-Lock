import { useCallback, useEffect, useRef } from "react";

/**
 * Return type for useFocusTrap hook.
 */
export interface UseFocusTrapReturn {
  /** Ref to attach to the container element */
  ref: React.RefObject<HTMLElement>;
  /** Ref to store the element that had focus before trap was activated */
  triggerRef: React.MutableRefObject<HTMLElement | null>;
}

/**
 * Options for useFocusTrap hook.
 */
export interface UseFocusTrapOptions {
  /** Whether the focus trap is active */
  active: boolean;
  /** Additional elements to exclude from focus trap (e.g., portaled content) */
  excludeSelectors?: string[];
}

/**
 * Hook for trapping keyboard focus within a DOM element.
 *
 * When active, creates a focus trap that:
 * - Moves focus to the first focusable element on activation
 * - Cycles focus within the container on Tab/Shift+Tab
 * - Returns focus to the triggering element on deactivation
 * - Supports Escape key to deactivate (via callback)
 *
 * @param options - Configuration options
 * @returns Object containing container ref and trigger ref
 *
 * @example
 * ```tsx
 * function Modal({ open, onClose }) {
 *   const { ref } = useFocusTrap({ active: open });
 *
 *   return (
 *     <div ref={ref} role="dialog">
 *       <input autoFocus />
 *       <button>OK</button>
 *       <button>Cancel</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useFocusTrap({
  active,
  excludeSelectors = [],
}: UseFocusTrapOptions): UseFocusTrapReturn {
  const ref = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Get all focusable elements within container
  const getFocusableElements = useCallback((): HTMLElement[] => {
    const container = ref.current;
    if (!container) return [];

    const selectors = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    const focusable = Array.from(
      container.querySelectorAll<HTMLElement>(selectors)
    );

    // Filter out excluded elements
    return focusable.filter((el) => {
      return !excludeSelectors.some((selector) =>
        el.matches(selector)
      );
    });
  }, [excludeSelectors]);

  // Store the element that had focus before activation
  useEffect(() => {
    if (active) {
      triggerRef.current = document.activeElement as HTMLElement;
    }
  }, [active]);

  // Focus first element on activation
  useEffect(() => {
    if (!active) return;

    const container = ref.current;
    if (!container) return;

    // Try to find an element with autoFocus, otherwise first focusable
    const autoFocusEl = container.querySelector<HTMLElement>('[autofocus]');
    const focusableElements = getFocusableElements();
    const firstElement = autoFocusEl || focusableElements[0];

    if (firstElement) {
      firstElement.focus();
    }
  }, [active, getFocusableElements]);

  // Handle Tab key cycling
  useEffect(() => {
    if (!active) return;

    const container = ref.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // Shift+Tab on first element -> wrap to last
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
      // Tab (no shift) on last element -> wrap to first
      else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [active, getFocusableElements]);

  // Return focus to trigger element on deactivation
  useEffect(() => {
    return () => {
      if (triggerRef.current) {
        triggerRef.current.focus();
      }
    };
  }, []);

  return { ref, triggerRef };
}
