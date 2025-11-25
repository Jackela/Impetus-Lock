import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LLMSettingsModal } from "../LLMSettingsModal";

describe("LLMSettingsModal validations", () => {
  it("shows validation message when key format is invalid", () => {
    render(
      <LLMSettingsModal open onClose={vi.fn()} config={null} onSave={vi.fn()} onClear={vi.fn()} />
    );

    const keyInput = screen.getByTestId("llm-key-input") as HTMLInputElement;
    fireEvent.change(keyInput, { target: { value: "invalid" } });

    expect(screen.getByText(/Key format doesn’t match/i)).toBeInTheDocument();
    const saveButton = screen.getByTestId("llm-settings-save") as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });
});
