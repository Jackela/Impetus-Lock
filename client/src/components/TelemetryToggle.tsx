import { useTelemetry } from "../hooks/useTelemetry";

export function TelemetryToggle() {
  const { enabled, toggleTelemetry } = useTelemetry();

  return (
    <button onClick={toggleTelemetry} aria-pressed={enabled} className="telemetry-toggle">
      {enabled ? "Telemetry On" : "Telemetry Off"}
    </button>
  );
}
