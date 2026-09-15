import { useTelemetry } from "../hooks/useTelemetry";

/**
 * Header button toggling anonymous telemetry on and off.
 *
 * @returns The rendered telemetry toggle button
 */
export function TelemetryToggle() {
  const { enabled, toggleTelemetry } = useTelemetry();

  return (
    <button onClick={toggleTelemetry} aria-pressed={enabled} className="telemetry-toggle">
      {enabled ? "Telemetry On" : "Telemetry Off"}
    </button>
  );
}
