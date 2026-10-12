import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { AppLayout } from "./AppLayout";

afterEach(() => vi.unstubAllGlobals());

function Host() {
  const [overlay, setOverlay] = useState<string | null>(null);
  const toggle = (name: string) => () => setOverlay((current) => (current === name ? null : name));
  return (
    <AppLayout
      mode="off"
      sidebarOpen={false}
      onToggleSidebar={vi.fn()}
      onModeChange={vi.fn()}
      onManualTrigger={vi.fn()}
      onTaskClick={vi.fn()}
      taskStatus="local"
      isSaving={false}
      taskError={null}
      onCreateTask={vi.fn()}
      onShowSettings={vi.fn()}
      onLockSession={vi.fn()}
      onForgetKey={vi.fn()}
      onShowStyleLearning={toggle("Style Learning")}
      showStyleLearning={overlay === "Style Learning"}
      llmFeedback={null}
      isConfigured={false}
      showStats={overlay === "Writing Statistics"}
      onToggleStats={toggle("Writing Statistics")}
      showAchievements={overlay === "Achievements"}
      onToggleAchievements={toggle("Achievements")}
      content="Retained writing"
    >
      <textarea aria-label="Writing" defaultValue="Retained writing" />
    </AppLayout>
  );
}

it.each([
  ["stats-toggle", "Writing Statistics", "Close Stats"],
  ["achievements-toggle", "Achievements", "Close Achievements"],
  ["style-learning-toggle", "Style Learning", "Close Style Learning"],
])("keeps %s keyboard focus inside and returns it after Escape", async (id, name, closeName) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input) => {
      const path = new URL(String(input), window.location.href).pathname;
      if (path === "/tasks/") return Response.json({ tasks: [], total: 0, limit: 100, offset: 0 });
      if (path === "/stats") return Response.json({ total_tasks: 0 });
      return Response.json({ achievements: [] });
    })
  );
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Host />
    </QueryClientProvider>
  );
  const opener = screen.getByTestId(id);
  opener.focus();
  fireEvent.click(opener);
  const dialog = await screen.findByRole("dialog", { name });
  expect(dialog.contains(document.activeElement)).toBe(true);
  const close = within(dialog).getByRole("button", { name: closeName });
  close.focus();
  fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
  expect(dialog.contains(document.activeElement)).toBe(true);
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog", { name })).not.toBeInTheDocument());
  expect(opener).toHaveFocus();
  expect(screen.getByRole("textbox", { name: "Writing" })).toHaveValue("Retained writing");
});
