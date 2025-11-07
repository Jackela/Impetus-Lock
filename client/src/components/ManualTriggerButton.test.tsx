import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { ManualTriggerButton } from "./ManualTriggerButton";

// Mock hooks
vi.mock("../hooks/useManualTrigger", () => ({
  useManualTrigger: vi.fn(),
}));

import { useManualTrigger } from "../hooks/useManualTrigger";

describe("ManualTriggerButton", () => {
  it("renders enabled in Muse mode", () => {
    vi.mocked(useManualTrigger).mockReturnValue({
      trigger: vi.fn(),
      isLoading: false,
    });

    render(<ManualTriggerButton mode="muse" />);

    const button = screen.getByTestId("manual-trigger-button");
    expect(button).toBeDefined();
    expect(button.disabled).toBe(false);
    expect(button.textContent).toBe("I'm stuck!");
  });

  it("renders disabled in Loki mode", () => {
    vi.mocked(useManualTrigger).mockReturnValue({
      trigger: vi.fn(),
      isLoading: false,
    });

    render(<ManualTriggerButton mode="loki" />);

    const button = screen.getByTestId("manual-trigger-button");
    expect(button.disabled).toBe(true);
  });

  it("renders disabled in Off mode", () => {
    vi.mocked(useManualTrigger).mockReturnValue({
      trigger: vi.fn(),
      isLoading: false,
    });

    render(<ManualTriggerButton mode="off" />);

    const button = screen.getByTestId("manual-trigger-button");
    expect(button.disabled).toBe(true);
  });

  it("calls trigger function on click", async () => {
    const user = userEvent.setup();
    const mockTrigger = vi.fn();

    vi.mocked(useManualTrigger).mockReturnValue({
      trigger: mockTrigger,
      isLoading: false,
    });

    render(<ManualTriggerButton mode="muse" />);

    const button = screen.getByTestId("manual-trigger-button");
    await user.click(button);

    expect(mockTrigger).toHaveBeenCalledOnce();
  });

  it("shows loading state during API call", () => {
    vi.mocked(useManualTrigger).mockReturnValue({
      trigger: vi.fn(),
      isLoading: true,
    });

    render(<ManualTriggerButton mode="muse" />);

    const button = screen.getByTestId("manual-trigger-button");
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe("Thinking...");
  });
});
