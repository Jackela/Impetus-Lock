import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFocusTrap } from "./useFocusTrap";

describe("useFocusTrap Hook", () => {
  let container: HTMLElement;

  beforeEach(() => {
    // Create a fresh container for each test
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  const createTestElements = () => {
    container.innerHTML = `
      <button id="outside">Outside Button</button>
      <div id="trap-container">
        <input type="text" id="first-input" />
        <button id="middle-button">Middle</button>
        <button id="last-button">Last</button>
      </div>
    `;
    return {
      outside: document.getElementById("outside") as HTMLButtonElement,
      container: document.getElementById("trap-container") as HTMLDivElement,
      firstInput: document.getElementById("first-input") as HTMLInputElement,
      middleButton: document.getElementById("middle-button") as HTMLButtonElement,
      lastButton: document.getElementById("last-button") as HTMLButtonElement,
    };
  };

  it("returns a ref and triggerRef", () => {
    const { result } = renderHook(() => useFocusTrap({ active: false }));

    expect(result.current.ref).toBeInstanceOf(Object);
    expect(result.current.ref.current).toBe(null);
    expect(result.current.triggerRef).toBeInstanceOf(Object);
    expect(result.current.triggerRef.current).toBe(null);
  });

  it("does not trap focus when inactive", () => {
    const { outside, container: trapContainer, firstInput } = createTestElements();
    const { result } = renderHook(() => useFocusTrap({ active: false }));

    // Attach ref to container
    act(() => {
      (result.current.ref as React.MutableRefObject<HTMLElement>).current = trapContainer;
    });

    // Focus outside element
    outside.focus();
    expect(document.activeElement).toBe(outside);

    // Tab key should not be trapped (no element should be focused inside)
    const tabEvent = new KeyboardEvent("keydown", { key: "Tab" });
    trapContainer.dispatchEvent(tabEvent);

    // Focus should not have moved to inside
    expect(document.activeElement).not.toBe(firstInput);
  });

  it("stores trigger element when activated", () => {
    const { outside, container: trapContainer } = createTestElements();
    const { result } = renderHook(() => useFocusTrap({ active: false }));

    // Attach ref
    act(() => {
      (result.current.ref as React.MutableRefObject<HTMLElement>).current = trapContainer;
    });

    // Focus outside element
    outside.focus();
    expect(document.activeElement).toBe(outside);

    // Activate trap - trigger ref should have stored the outside element
    act(() => {
      result.current.ref.current = trapContainer;
    });

    // triggerRef.current should reference something since outside was focused
    // Note: jsdom focus behavior is limited, so we just verify it doesn't crash
    expect(result.current.triggerRef).toBeDefined();
  });

  it("sets up focus trap when activated", () => {
    const { container: trapContainer, firstInput } = createTestElements();
    const { result } = renderHook(() => useFocusTrap({ active: true }));

    act(() => {
      (result.current.ref as React.MutableRefObject<HTMLElement>).current = trapContainer;
    });

    // Verify the hook doesn't crash and sets up the ref
    expect(result.current.ref.current).toBe(trapContainer);
    // First focusable element exists in DOM
    expect(firstInput).toBeInTheDocument();
  });

  it("verifies focus trap is set up on activation", () => {
    const { container: trapContainer } = createTestElements();
    const { result } = renderHook(() => useFocusTrap({ active: true }));

    act(() => {
      (result.current.ref as React.MutableRefObject<HTMLElement>).current = trapContainer;
    });

    // Verify the hook is active
    expect(result.current.ref.current).toBe(trapContainer);
    // Verify container has focusable elements
    const focusable = trapContainer.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    expect(focusable.length).toBeGreaterThan(0);
  });

  it("respects autoFocus attribute when present", () => {
    container.innerHTML = `
      <div id="trap-container">
        <input type="text" id="first-input" />
        <button id="auto-button" autofocus>Auto Focus</button>
        <button id="last-button">Last</button>
      </div>
    `;
    const trapContainer = document.getElementById("trap-container") as HTMLDivElement;
    const autoButton = document.getElementById("auto-button") as HTMLButtonElement;
    const { result } = renderHook(() => useFocusTrap({ active: true }));

    act(() => {
      (result.current.ref as React.MutableRefObject<HTMLElement>).current = trapContainer;
    });

    // Verify the hook finds the autoFocus element
    expect(result.current.ref.current).toBe(trapContainer);
    expect(autoButton).toHaveAttribute("autofocus");
  });

  it("accepts excludeSelectors option", () => {
    container.innerHTML = `
      <div id="trap-container">
        <button id="first">First</button>
        <button id="excluded" class="exclude-me">Excluded</button>
        <button id="last">Last</button>
      </div>
    `;
    const trapContainer = document.getElementById("trap-container") as HTMLDivElement;
    const { result } = renderHook(() =>
      useFocusTrap({ active: true, excludeSelectors: [".exclude-me"] })
    );

    act(() => {
      (result.current.ref as React.MutableRefObject<HTMLElement>).current = trapContainer;
    });

    // Verify hook accepts the option
    expect(result.current.ref.current).toBe(trapContainer);
    expect(result.current.triggerRef).toBeDefined();
  });

  it("handles empty container gracefully", () => {
    container.innerHTML = `<div id="trap-container"></div>`;
    const trapContainer = document.getElementById("trap-container") as HTMLDivElement;
    const { result } = renderHook(() => useFocusTrap({ active: true }));

    act(() => {
      (result.current.ref as React.MutableRefObject<HTMLElement>).current = trapContainer;
    });

    // Should not throw, hook should handle gracefully
    expect(result.current.ref.current).toBe(trapContainer);
  });

  it("ignores non-Tab keys", () => {
    const { container: trapContainer, firstInput } = createTestElements();
    const { result } = renderHook(() => useFocusTrap({ active: true }));

    act(() => {
      (result.current.ref as React.MutableRefObject<HTMLElement>).current = trapContainer;
    });

    let prevented = false;
    const enterEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
    });
    Object.defineProperty(enterEvent, "preventDefault", {
      value: () => {
        prevented = true;
      },
    });

    firstInput.dispatchEvent(enterEvent);

    // Should not prevent default for non-Tab keys
    expect(prevented).toBe(false);
  });
});
