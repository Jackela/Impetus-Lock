import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WelcomeModal } from "./WelcomeModal";
import { ConfigErrorModal } from "./ConfigErrorModal";
import { LLMSettingsModal } from "./LLMSettingsModal";
import { ExportModal } from "./Export/ExportModal";
import { CreateTaskModal } from "./CreateTaskModal/CreateTaskModal";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type Kind = "welcome" | "config" | "settings" | "export" | "create";
function DialogHost({ kind }: { kind: Kind }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open writing options</button>
      {kind === "welcome" && <WelcomeModal forceShow={open} onDismiss={close} />}
      {kind === "config" && (
        <ConfigErrorModal visible={open} onDismiss={close} onOpenSettings={close} />
      )}
      {kind === "settings" && (
        <LLMSettingsModal
          open={open}
          onClose={close}
          config={null}
          onSave={vi.fn()}
          onClear={vi.fn()}
          storageMode="local"
          onModeChange={vi.fn()}
          locked={false}
          onUnlock={vi.fn()}
          onLock={vi.fn()}
        />
      )}
      {kind === "export" && <ExportModal open={open} onClose={close} content="writing" />}
      {kind === "create" && <CreateTaskModal open={open} onClose={close} />}
    </>
  );
}
afterEach(() => {
  localStorage.clear();
});

it.each([
  ["welcome", "Welcome to Impetus Lock", "Close welcome modal"],
  ["config", "LLM 服务不可用", "打开 LLM 设置"],
  ["settings", "LLM Settings", "Close"],
  ["export", "Export Document", "Filename"],
  ["create", "Create New Task", "Task Title *"],
] as const)(
  "keeps %s dialog focus inside and restores its opener after Escape",
  async (kind, name, initial) => {
    localStorage.setItem("impetus-lock-welcome-dismissed", "true");
    render(
      <QueryClientProvider client={new QueryClient()}>
        <DialogHost kind={kind} />
      </QueryClientProvider>
    );
    const opener = screen.getByRole("button", { name: "Open writing options" });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await screen.findByRole(kind === "config" ? "alertdialog" : "dialog", { name });
    const first = within(dialog).getByRole(
      kind === "export" || kind === "create" ? "textbox" : "button",
      { name: initial }
    );
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(first).not.toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "Tab" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: "Escape" });
    await waitFor(() =>
      expect(
        screen.queryByRole(kind === "config" ? "alertdialog" : "dialog", { name })
      ).not.toBeInTheDocument()
    );
    expect(opener).toHaveFocus();
  }
);
