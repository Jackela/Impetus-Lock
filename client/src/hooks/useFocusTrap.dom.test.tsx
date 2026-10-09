import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useFocusTrap } from "./useFocusTrap";

function Trap({
  active = true,
  children,
  excludeSelectors,
}: {
  active?: boolean;
  children?: ReactNode;
  excludeSelectors?: string[];
}) {
  const { ref } = useFocusTrap<HTMLDivElement>({ active, excludeSelectors });
  return (
    <div ref={ref} role="dialog">
      {children}
    </div>
  );
}

describe("useFocusTrap with a mounted DOM container", () => {
  it("focuses the first control and wraps Tab in both directions", () => {
    render(
      <Trap>
        <button>First</button>
        <button>Last</button>
      </Trap>
    );
    const first = screen.getByRole("button", { name: "First" });
    const last = screen.getByRole("button", { name: "Last" });
    expect(first).toHaveFocus();
    expect(fireEvent.keyDown(first, { key: "Tab", shiftKey: true })).toBe(false);
    expect(last).toHaveFocus();
    expect(fireEvent.keyDown(last, { key: "Tab" })).toBe(false);
    expect(first).toHaveFocus();
  });

  it("keeps focus on a sole control for either Tab direction", () => {
    render(
      <Trap>
        <button>Only</button>
      </Trap>
    );
    const button = screen.getByRole("button");
    expect(fireEvent.keyDown(button, { key: "Tab" })).toBe(false);
    expect(button).toHaveFocus();
    expect(fireEvent.keyDown(button, { key: "Tab", shiftKey: true })).toBe(false);
    expect(button).toHaveFocus();
  });

  it("leaves Tab untouched when no focusable controls remain", () => {
    const { rerender } = render(
      <Trap>
        <button>Control</button>
      </Trap>
    );
    rerender(
      <Trap>
        <button disabled>Control</button>
      </Trap>
    );
    const dialog = screen.getByRole("dialog");
    expect(fireEvent.keyDown(dialog, { key: "Tab" })).toBe(true);
    expect(fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true })).toBe(true);
  });

  it("wraps around disabled and excluded controls", () => {
    render(
      <Trap excludeSelectors={[".excluded"]}>
        <button disabled>Disabled</button>
        <button>First</button>
        <button>Last</button>
        <button className="excluded">Excluded</button>
      </Trap>
    );
    const first = screen.getByRole("button", { name: "First" });
    const last = screen.getByRole("button", { name: "Last" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(first).toHaveFocus();
  });

  it("ignores non-Tab keys and an inactive trap", () => {
    const { rerender } = render(
      <Trap>
        <button>Control</button>
      </Trap>
    );
    const button = screen.getByRole("button");
    expect(fireEvent.keyDown(button, { key: "Enter" })).toBe(true);
    rerender(
      <Trap active={false}>
        <button>Control</button>
      </Trap>
    );
    expect(fireEvent.keyDown(button, { key: "Tab" })).toBe(true);
    expect(fireEvent.keyDown(button, { key: "Tab", shiftKey: true })).toBe(true);
  });

  it("returns focus to the trigger when the trap unmounts", () => {
    const outside = render(<button>Open</button>);
    const trigger = screen.getByRole("button", { name: "Open" });
    trigger.focus();
    const trap = render(
      <Trap>
        <button>Inside</button>
      </Trap>
    );
    expect(screen.getByRole("button", { name: "Inside" })).toHaveFocus();
    trap.unmount();
    expect(trigger).toHaveFocus();
    outside.unmount();
  });
});
