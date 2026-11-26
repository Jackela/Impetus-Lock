import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LLMSettingsModal } from "../LLMSettingsModal";

describe("LLMSettingsModal validations", () => {
  it("shows validation message when key format is invalid", () => {
    render(
      <LLMSettingsModal
        open
        storageMode="session"
        onModeChange={vi.fn()}
        locked={false}
        onUnlock={vi.fn()}
        onLock={vi.fn()}
        onClose={vi.fn()}
        config={null}
        onSave={vi.fn()}
        onClear={vi.fn()}
      />
    );

    const keyInput = screen.getByTestId("llm-key-input") as HTMLInputElement;
    fireEvent.change(keyInput, { target: { value: "invalid" } });

    expect(screen.getByText(/Key format doesn’t match/i)).toBeInTheDocument();
    const saveButton = screen.getByTestId("llm-settings-save") as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });
});

describe("LLMSettingsModal model recommendations", () => {
  it.each([
    ["gemini", "gemini-2.0-flash-lite", "gemini-3.1-flash-lite", "AI-test-model-key"],
    ["anthropic", "claude-3-5-haiku-latest", "claude-haiku-4-5-20251001", "sk-ant-test-model-key"],
  ] as const)(
    "offers an explicit replacement for the saved %s model",
    async (provider, model, replacement, apiKey) => {
      const onSave = vi.fn();
      const config = { provider, model, apiKey };
      render(
        <LLMSettingsModal
          open
          storageMode="local"
          onModeChange={vi.fn()}
          locked={false}
          onUnlock={vi.fn()}
          onLock={vi.fn()}
          onClose={vi.fn()}
          config={config}
          onSave={onSave}
          onClear={vi.fn()}
        />
      );

      expect(screen.getByText("Recommended model: " + replacement)).toBeInTheDocument();
      const modelInput = screen.getByRole("textbox", { name: "Model" });
      expect(modelInput).toHaveValue(model);
      expect(modelInput).toHaveAccessibleDescription(/retired/i);
      fireEvent.click(screen.getByRole("button", { name: /use recommended model/i }));
      expect(modelInput).toHaveValue(replacement);
      expect(onSave).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(onSave).toHaveBeenCalledWith({ ...config, model: replacement }));
    }
  );

  it("keeps a saved custom Gemini model unless the writer edits it", async () => {
    const onSave = vi.fn();
    const config = {
      provider: "gemini",
      model: "gemini-custom-model",
      apiKey: "AI-test-model-key",
    } as const;
    render(
      <LLMSettingsModal
        open
        storageMode="local"
        onModeChange={vi.fn()}
        locked={false}
        onUnlock={vi.fn()}
        onLock={vi.fn()}
        onClose={vi.fn()}
        config={config}
        onSave={onSave}
        onClear={vi.fn()}
      />
    );

    expect(screen.getByRole("textbox", { name: "Model" })).toHaveValue(config.model);
    expect(
      screen.queryByRole("button", { name: /use recommended model/i })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(config));
  });
});
