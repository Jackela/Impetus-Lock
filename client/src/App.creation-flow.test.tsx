import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { TaskRecord } from "./types/task";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("App task creation flow", () => {
  it("opens the newly created task in the real editor after closing the modal and refreshing the list", async () => {
    const oldTask: TaskRecord = {
      id: "r12-existing-task",
      title: "Existing task",
      content: "Existing task content",
      lock_ids: [],
      category: "WRITING",
      priority: "MEDIUM",
      due_date: null,
      word_count: 3,
      created_at: "2026-09-29T00:00:00Z",
      updated_at: "2026-09-29T00:00:00Z",
      version: 1,
    };
    const newTask: TaskRecord = {
      ...oldTask,
      id: "r12-created-task",
      version: 0,
      title: "New writing task",
      content: "New writing task",
    };
    let created = false;
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
        mutations: { retry: false },
      },
    });

    // Only storage and fetch are controlled; App, its modals, task hooks,
    // API client, and Milkdown/ProseMirror editor all run unchanged.
    localStorage.clear();
    localStorage.setItem("impetus-lock-welcome-dismissed", "true");
    localStorage.setItem(
      "impetus.task.meta",
      JSON.stringify({ taskId: oldTask.id, version: oldTask.version })
    );
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input, init) => {
        const url = new URL(
          typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
          window.location.href
        );
        const method = init?.method ?? "GET";
        if (url.pathname.includes("/assets/audio/")) {
          return new Response(new ArrayBuffer(8), { status: 200 });
        }
        if (method === "GET" && url.pathname === "/tasks/") {
          const tasks = created ? [newTask, oldTask] : [oldTask];
          return Response.json({ tasks, total: tasks.length, limit: 100, offset: 0 });
        }
        if (method === "GET" && url.pathname === `/tasks/${oldTask.id}`) {
          return Response.json(oldTask);
        }
        if (method === "GET" && url.pathname === `/tasks/${newTask.id}` && created) {
          return Response.json(newTask);
        }
        if (method === "POST" && url.pathname === "/tasks") {
          expect(JSON.parse(String(init?.body))).toEqual({
            content: "New writing task",
            lock_ids: [],
          });
          created = true;
          return Response.json(newTask, { status: 201 });
        }
        throw new Error(`Unexpected fetch: ${method} ${url.pathname}`);
      })
    );

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );
    fireEvent.click(await screen.findByTestId(`task-item-${oldTask.id}`));
    await waitFor(() => {
      expect(container.querySelector(".milkdown .ProseMirror")).toHaveTextContent(
        "Existing task content"
      );
      expect(screen.getByTestId(`task-item-${oldTask.id}`)).toHaveAttribute(
        "aria-selected",
        "true"
      );
    });

    fireEvent.click(screen.getByTestId("new-task-button"));
    fireEvent.change(screen.getByTestId("create-task-input"), {
      target: { value: "New writing task" },
    });
    fireEvent.click(screen.getByTestId("create-task-confirm"));

    await waitFor(() => expect(screen.queryByTestId("create-task-modal")).not.toBeInTheDocument());
    expect(await screen.findByTestId(`task-item-${newTask.id}`)).toHaveTextContent(
      "New writing task"
    );
    await waitFor(() => {
      expect(container.querySelector(".milkdown .ProseMirror")).toHaveTextContent(
        "New writing task"
      );
      expect(screen.getByTestId(`task-item-${newTask.id}`)).toHaveAttribute(
        "aria-selected",
        "true"
      );
      expect(screen.getByTestId(`task-item-${oldTask.id}`)).toHaveAttribute(
        "aria-selected",
        "false"
      );
    });
  });
});
