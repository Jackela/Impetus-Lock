import type { AriaRole } from "react";
import { useTelemetry } from "../hooks/useTelemetry";
import { IconButton, SignalIcon } from "./ui";

interface TelemetryToggleProps {
  /** Optional role forwarded to the native button (e.g. `menuitem` in a menu). */
  role?: AriaRole;
  /** Additional CSS classes merged onto the control. */
  className?: string;
}

/**
 * Control toggling anonymous telemetry on and off.
 *
 * Rendered with the shared `IconButton` primitive; the state stays visible as
 * text (`Telemetry On` / `Telemetry Off`) and as `aria-pressed` so the control
 * is announced correctly outside of a menu.
 *
 * @param props - Component props
 * @param props.role - Optional role for the native button
 * @param props.className - Additional CSS classes
 * @returns The rendered telemetry toggle button
 */
export function TelemetryToggle({ role, className = "" }: TelemetryToggleProps = {}) {
  const { enabled, toggleTelemetry } = useTelemetry();

  return (
    <IconButton
      ariaLabel={enabled ? "Telemetry On" : "Telemetry Off"}
      aria-pressed={enabled}
      className={`telemetry-toggle ${className}`.trim()}
      role={role}
      size="sm"
      onClick={toggleTelemetry}
    >
      <SignalIcon size={18} />
      <span className="telemetry-toggle__label">{enabled ? "Telemetry On" : "Telemetry Off"}</span>
    </IconButton>
  );
}
