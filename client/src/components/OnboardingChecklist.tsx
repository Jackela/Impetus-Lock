import { useState } from "react";

const steps = [
  "Launch dev stack via ./scripts/dev-start.sh",
  "Open LLM Settings and paste your API key",
  "Trigger Muse or Loki to verify the flow",
];

export function OnboardingChecklist() {
  const [completed, setCompleted] = useState<boolean[]>(steps.map(() => false));

  const toggle = (index: number) => {
    setCompleted((prev) =>
      prev.map((value, i) => (i === index ? !value : value))
    );
  };

  return (
    <section className="onboarding-checklist">
      <h3>BYOK Onboarding</h3>
      <ol>
        {steps.map((step, index) => (
          <li key={step}>
            <label>
              <input
                type="checkbox"
                checked={completed[index]}
                onChange={() => toggle(index)}
              />
              {step}
            </label>
          </li>
        ))}
      </ol>
    </section>
  );
}
