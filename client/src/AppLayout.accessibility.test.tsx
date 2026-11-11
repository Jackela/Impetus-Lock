import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AppLayout } from "./AppLayout";

/**
 * Mounts the layout inside a `#root` element so the shared `Modal` primitive's
 * background `inert` / `aria-hidden` marking targets the same node it does in
 * the real app (`client/index.html`).
 */
function renderInAppRoot(ui: React.ReactElement) {
  const container = document.createElement("div");
  container.id = "root";
  document.body.appendChild(container);
  return render(ui, { container });
}

function queryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.querySelectorAll("#root").forEach((node) => node.remove());
});

function stubTaskFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input) => {
      const path = new URL(String(input), window.location.href).pathname;
      if (path === "/tasks/") return Response.json({ tasks: [], total: 0, limit: 100, offset: 0 });
      if (path === "/stats") return Response.json({ total_tasks: 0 });
      return Response.json({ achievements: [] });
    })
  );
}

interface HostState {
  overlay: string | null;
  sidebarOpen: boolean;
}

function renderLayout(initial: Partial<HostState> = {}) {
  const state: HostState = { overlay: null, sidebarOpen: false, ...initial };

  function Host() {
    const [overlay, setOverlay] = useState<string | null>(state.overlay);
    const [sidebarOpen, setSidebarOpen] = useState(state.sidebarOpen);
    const toggle = (name: string) => () =>
      setOverlay((current) => (current === name ? null : name));
    return (
      <ThemeProvider>
        <AppLayout
          mode="off"
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((current) => !current)}
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
      </ThemeProvider>
    );
  }

  return renderInAppRoot(
    <QueryClientProvider client={queryClient()}>
      <Host />
    </QueryClientProvider>
  );
}

/** Opens the header overflow menu and returns the requested menu item. */
function openMenuItem(testId: string) {
  fireEvent.click(screen.getByTestId("header-menu-button"));
  return screen.getByTestId(testId);
}

it.each([
  ["stats-toggle", "Writing Statistics", "Close Stats"],
  ["achievements-toggle", "Achievements", "Close Achievements"],
  ["style-learning-toggle", "Style Learning", "Close Style Learning"],
])("keeps %s keyboard focus inside and returns it after Escape", async (id, name, closeName) => {
  stubTaskFetch();
  renderLayout();
  const opener = openMenuItem(id);
  fireEvent.click(opener);
  const dialog = await screen.findByRole("dialog", { name });
  expect(dialog.contains(document.activeElement)).toBe(true);
  const close = within(dialog).getByRole("button", { name: closeName });
  close.focus();
  fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
  expect(dialog.contains(document.activeElement)).toBe(true);
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog", { name })).not.toBeInTheDocument());
  // Focus returns to the header menu trigger, the control that opened the panel.
  expect(screen.getByTestId("header-menu-button")).toHaveFocus();
  expect(screen.getByRole("textbox", { name: "Writing" })).toHaveValue("Retained writing");
});

it("marks the background inert while an overlay is open and restores it on close", async () => {
  stubTaskFetch();
  renderLayout();
  const root = document.getElementById("root")!;
  expect(root).not.toHaveAttribute("inert");

  fireEvent.click(openMenuItem("stats-toggle"));
  await screen.findByRole("dialog", { name: "Writing Statistics" });
  expect(root).toHaveAttribute("inert");
  expect(root).toHaveAttribute("aria-hidden", "true");
  // The editor must be unreachable while the dialog owns the screen.
  expect(screen.queryByRole("textbox", { name: "Writing" })).not.toBeInTheDocument();

  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Writing Statistics" })).not.toBeInTheDocument()
  );
  expect(root).not.toHaveAttribute("inert");
  expect(root).not.toHaveAttribute("aria-hidden");
});

it("Escape closes only the top-most overlay", async () => {
  stubTaskFetch();
  function StackedHost() {
    const [stats, setStats] = useState(false);
    const [achievements, setAchievements] = useState(false);
    return (
      <ThemeProvider>
        <AppLayout
          mode="off"
          sidebarOpen={false}
          onToggleSidebar={vi.fn()}
          onModeChange={vi.fn()}
          onManualTrigger={vi.fn()}
          onTaskClick={vi.fn()}
          taskStatus="synced"
          isSaving={false}
          taskError={null}
          onCreateTask={vi.fn()}
          onShowSettings={vi.fn()}
          onLockSession={vi.fn()}
          onForgetKey={vi.fn()}
          onShowStyleLearning={vi.fn()}
          showStyleLearning={false}
          llmFeedback={null}
          isConfigured={false}
          showStats={stats}
          onToggleStats={() => setStats((current) => !current)}
          showAchievements={achievements}
          onToggleAchievements={() => setAchievements((current) => !current)}
          content="Stacked"
        >
          <textarea aria-label="Writing" defaultValue="Stacked" />
        </AppLayout>
      </ThemeProvider>
    );
  }

  renderInAppRoot(
    <QueryClientProvider client={queryClient()}>
      <StackedHost />
    </QueryClientProvider>
  );

  fireEvent.click(openMenuItem("stats-toggle"));
  await screen.findByRole("dialog", { name: "Writing Statistics" });

  fireEvent.click(openMenuItem("achievements-toggle"));
  await screen.findByRole("dialog", { name: "Achievements" });

  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Achievements" })).not.toBeInTheDocument()
  );
  // The lower dialog stays open, and the background stays inert.
  expect(screen.getByRole("dialog", { name: "Writing Statistics" })).toBeInTheDocument();
  expect(document.getElementById("root")).toHaveAttribute("inert");

  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Writing Statistics" })).not.toBeInTheDocument()
  );
  expect(document.getElementById("root")).not.toHaveAttribute("inert");
});

it("renders the sidebar as a dismissible modal sheet on mobile", async () => {
  stubTaskFetch();
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => {
      const matches = query.includes("max-width: 768px");
      return {
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as unknown as MediaQueryList;
    })
  );

  renderLayout({ sidebarOpen: true });
  const sheet = await screen.findByTestId("task-sidebar");
  expect(sheet).toHaveAttribute("aria-modal", "true");
  expect(sheet).toHaveAttribute("role", "dialog");
  expect(screen.getByTestId("task-sidebar-backdrop")).toBeInTheDocument();
  expect(document.querySelector(".app-header")).toHaveAttribute("inert");

  fireEvent.click(within(sheet).getByRole("button", { name: "Close task list" }));
  await waitFor(() => expect(screen.queryByTestId("task-sidebar")).not.toBeInTheDocument());
  expect(screen.queryByTestId("task-sidebar-backdrop")).not.toBeInTheDocument();
  expect(document.querySelector(".app-header")).not.toHaveAttribute("inert");
});

it("exposes Tasks, Style, Stats, Achievements, Export, Theme, Telemetry and session actions in one menu", async () => {
  stubTaskFetch();
  renderLayout();
  fireEvent.click(screen.getByTestId("header-menu-button"));

  const menu = screen.getByRole("menu", { name: "Main menu" });
  const labels = within(menu)
    .getAllByRole("menuitem")
    .map((item) => item.textContent?.trim());
  expect(labels).toEqual([
    "TasksAlt+T",
    "Style",
    "Stats",
    "Achievements",
    "Export",
    "Theme: Dark",
    "Telemetry Off",
    "LLM Settings",
    "Lock Session",
    "Forget Key",
  ]);

  // The dev-only triggers live behind a collapsed Dev tools region.
  const devRegion = screen.getByTestId("header-dev-region");
  expect(devRegion.tagName).toBe("DETAILS");
  expect(devRegion).not.toHaveAttribute("open");
});
