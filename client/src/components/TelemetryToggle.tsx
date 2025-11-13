import { useState } from "react";
import { isTelemetryEnabled, setTelemetryEnabled } from "../services/telemetry";

export function TelemetryToggle() {
  const [enabled, setEnabled] = useState(isTelemetryEnabled());

  const handleChange = () => {
    const next = !enabled;
    setEnabled(next);
    setTelemetryEnabled(next);
  };

  return (
    <button onClick={handleChange} aria-pressed={enabled} className="telemetry-toggle">
      {enabled ? "Telemetry On" : "Telemetry Off"}
    </button>
  );
}
