import { describe, it, expect, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { TelemetryToggle } from "../TelemetryToggle";
import { setTelemetryEnabled } from "../../hooks/useTelemetry";

describe("TelemetryToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setTelemetryEnabled(false);
  });

  it("shows current telemetry state and toggles on click", () => {
    const { getByRole, rerender } = render(<TelemetryToggle />);

    const button = getByRole("button");
    expect(button.textContent).toBe("Telemetry Off");

    fireEvent.click(button);
    // Rerender to reflect updated hook state
    rerender(<TelemetryToggle />);
    expect(button.textContent).toBe("Telemetry On");
    expect(window.localStorage.getItem("impetus.telemetry.enabled")).toBe("1");

    fireEvent.click(button);
    rerender(<TelemetryToggle />);
    expect(button.textContent).toBe("Telemetry Off");
    expect(window.localStorage.getItem("impetus.telemetry.enabled")).toBe("0");
  });
});
