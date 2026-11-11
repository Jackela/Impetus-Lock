import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskList } from "./TaskList";
import type { TaskRecord } from "../../types/task";

describe("TaskList", () => {
  const mockTask: TaskRecord = {
    id: "task-1",
    content: "Test task content",
    lock_ids: [],
    created_at: "2025-02-04T10:00:00Z",
    updated_at: "2025-02-04T10:00:00Z",
    title: "Test task",
    category: "WRITING",
    priority: "MEDIUM",
    due_date: null,
    word_count: 0,
    version: 1,
  };

  const mockTaskWithLocks: TaskRecord = {
    id: "task-2",
    content: "Task with locks",
    lock_ids: ["lock-1", "lock-2"],
    created_at: "2025-02-04T09:00:00Z",
    updated_at: "2025-02-04T10:00:00Z",
    title: "Test task",
    category: "WRITING",
    priority: "MEDIUM",
    due_date: null,
    word_count: 0,
    version: 2,
  };

  describe("rendering", () => {
    it("should render empty state when no tasks provided", () => {
      render(<TaskList tasks={[]} />);

      expect(screen.getByTestId("task-list-empty")).toBeInTheDocument();
      expect(screen.getByText("No tasks yet")).toBeInTheDocument();
    });

    it("should offer the create-task CTA in the empty state", async () => {
      const onCreateTask = vi.fn();
      render(<TaskList tasks={[]} onCreateTask={onCreateTask} />);

      await userEvent.setup().click(screen.getByRole("button", { name: "Create your first task" }));

      expect(onCreateTask).toHaveBeenCalledOnce();
    });

    it("should render list of tasks", () => {
      const tasks = [mockTask, mockTaskWithLocks];

      render(<TaskList tasks={tasks} />);

      expect(screen.getByTestId("task-list")).toBeInTheDocument();
      expect(screen.getByTestId(`task-item-${mockTask.id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`task-item-${mockTaskWithLocks.id}`)).toBeInTheDocument();
    });

    it("should display task title from content", () => {
      render(<TaskList tasks={[mockTask]} />);

      expect(screen.getByText("Test task content")).toBeInTheDocument();
    });

    it("should truncate long content to 100 characters", () => {
      const longContent = "a".repeat(150);
      const longTask: TaskRecord = {
        ...mockTask,
        content: longContent,
      };

      render(<TaskList tasks={[longTask]} />);

      const titleElement = screen
        .getByTestId(`task-item-${longTask.id}`)
        .querySelector(".task-item-title");
      expect(titleElement).toBeInTheDocument();
      // Content is truncated to 100 chars + "..." (103 total)
      expect(titleElement?.textContent).toHaveLength(103);
      expect(titleElement?.textContent).toMatch(/^a{100}\.\.\.$/);
    });

    it("should display 'Untitled Task' for empty content", () => {
      const emptyTask: TaskRecord = {
        ...mockTask,
        content: "",
      };

      render(<TaskList tasks={[emptyTask]} />);

      expect(screen.getByText("Untitled Task")).toBeInTheDocument();
    });
  });

  describe("lock status", () => {
    it("should not show lock badge when task has no locks", () => {
      render(<TaskList tasks={[mockTask]} />);

      const lockBadge = screen.queryByTitle(/locked section/);
      expect(lockBadge).not.toBeInTheDocument();
    });

    it("should show lock badge when task has locks", () => {
      render(<TaskList tasks={[mockTaskWithLocks]} />);

      const lockBadge = screen.getByTitle("2 locked sections");
      expect(lockBadge).toBeInTheDocument();
    });

    it("should display correct lock count", () => {
      render(<TaskList tasks={[mockTaskWithLocks]} />);

      expect(screen.getByText("2")).toBeInTheDocument(); // lock_ids.length
    });
  });

  describe("task metadata", () => {
    it("should display relative time for recent task", () => {
      const recentTask: TaskRecord = {
        ...mockTask,
        created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
      };

      render(<TaskList tasks={[recentTask]} />);

      expect(screen.getByText("30m ago")).toBeInTheDocument();
    });

    it("should not show version badge for first version", () => {
      render(<TaskList tasks={[mockTask]} />);

      expect(screen.queryByText("v1")).not.toBeInTheDocument();
    });

    it("should show version badge for updated tasks", () => {
      render(<TaskList tasks={[mockTaskWithLocks]} />);

      expect(screen.getByText("v2")).toBeInTheDocument();
    });
  });

  describe("interactions", () => {
    it("should call onTaskClick when task is clicked", () => {
      const handleClick = vi.fn();

      render(<TaskList tasks={[mockTask]} onTaskClick={handleClick} />);

      const taskButton = screen.getByTestId(`task-item-${mockTask.id}`);
      taskButton.click();

      expect(handleClick).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledWith(mockTask);
    });

    it("should not call onTaskClick when not provided", () => {
      render(<TaskList tasks={[mockTask]} />);

      const taskButton = screen.getByTestId(`task-item-${mockTask.id}`);
      expect(() => taskButton.click()).not.toThrow();
    });

    it("should apply selected class to selected task", () => {
      render(<TaskList tasks={[mockTask]} selectedTaskId={mockTask.id} />);

      const taskButton = screen.getByTestId(`task-item-${mockTask.id}`);
      expect(taskButton).toHaveClass("selected");
    });

    it("should not apply selected class to non-selected task", () => {
      render(<TaskList tasks={[mockTask]} selectedTaskId="other-task-id" />);

      const taskButton = screen.getByTestId(`task-item-${mockTask.id}`);
      expect(taskButton).not.toHaveClass("selected");
    });
  });

  describe("accessibility", () => {
    it("identifies the current task on its native button without unsupported selection attributes", () => {
      render(<TaskList tasks={[mockTask]} selectedTaskId={mockTask.id} />);

      const taskButton = screen.getByTestId(`task-item-${mockTask.id}`);
      expect(taskButton).toHaveAttribute("aria-current", "true");
      expect(taskButton).not.toHaveAttribute("aria-selected");
    });

    it.each(["{Enter}", " "])("opens the focused task once with %s", async (key) => {
      const select = vi.fn();
      render(<TaskList tasks={[mockTask]} onTaskClick={select} />);
      screen.getByRole("button").focus();
      await userEvent.setup().keyboard(key);
      expect(select).toHaveBeenCalledExactlyOnceWith(mockTask);
    });

    it("should have role=list on list container", () => {
      render(<TaskList tasks={[mockTask]} />);

      const list = screen.getByRole("list");
      expect(list).toBeInTheDocument();
    });

    it("should have data-task-id on each task button", () => {
      render(<TaskList tasks={[mockTask]} />);

      const taskButton = screen.getByTestId(`task-item-${mockTask.id}`);
      expect(taskButton).toHaveAttribute("data-task-id", mockTask.id);
    });
  });

  /**
   * Explicit structure assertions that replaced the former DOM snapshots.
   * Snapshots embedded `toLocaleString()`/`toLocaleDateString()` output, so
   * they only passed under an en-US host locale; these checks pin the
   * machine-readable `<time datetime>` contract instead and stay green under
   * any locale (verified with LC_ALL=zh_CN.UTF-8).
   */
  describe("structure", () => {
    it("renders only the empty state when no tasks are provided", () => {
      const { container } = render(<TaskList tasks={[]} />);

      expect(container.querySelector('[data-testid="task-list"]')).toBeNull();
      const empty = screen.getByTestId("task-list-empty");
      expect(empty).toHaveTextContent("No tasks yet");
      expect(container.querySelectorAll("time")).toHaveLength(0);
    });

    it("renders one task row per task with stable data attributes", () => {
      render(<TaskList tasks={[mockTask, mockTaskWithLocks]} />);

      const [firstRow, secondRow] = screen.getAllByRole("button");
      expect(screen.getAllByRole("button")).toHaveLength(2);
      expect(firstRow).toHaveAttribute("data-task-id", mockTask.id);
      expect(secondRow).toHaveAttribute("data-task-id", mockTaskWithLocks.id);
      const rows = screen.getAllByTestId(/^task-item-/);
      expect(rows.map((row) => row.getAttribute("data-testid"))).toEqual([
        `task-item-${mockTask.id}`,
        `task-item-${mockTaskWithLocks.id}`,
      ]);
    });

    it("keeps task titles, lock badges and version badges in the right row", () => {
      render(<TaskList tasks={[mockTask, mockTaskWithLocks]} />);

      expect(screen.getByText("Test task content")).toBeInTheDocument();
      expect(screen.getByText("Task with locks")).toBeInTheDocument();
      expect(screen.getByTitle("2 locked sections").closest("[data-task-id]")).toHaveAttribute(
        "data-task-id",
        mockTaskWithLocks.id
      );
      expect(screen.getByText("v2").closest("[data-task-id]")).toHaveAttribute(
        "data-task-id",
        mockTaskWithLocks.id
      );
    });

    it("exposes each creation timestamp through the datetime attribute", () => {
      const { container } = render(<TaskList tasks={[mockTask, mockTaskWithLocks]} />);

      const times = [...container.querySelectorAll("time.task-item-time")];
      expect(times.map((time) => time.getAttribute("datetime"))).toEqual([
        mockTask.created_at,
        mockTaskWithLocks.created_at,
      ]);
      // The visible label and title are host-locale formatted; only assert that
      // they are present and non-empty so the test stays locale independent.
      for (const time of times) {
        expect(time.textContent?.trim()).not.toBe("");
        expect(time.getAttribute("title")).toBeTruthy();
      }
    });

    it("marks only the selected row as current", () => {
      const { container } = render(
        <TaskList tasks={[mockTask, mockTaskWithLocks]} selectedTaskId={mockTaskWithLocks.id} />
      );

      const [firstRow, secondRow] = screen.getAllByRole("button");
      expect(firstRow).not.toHaveAttribute("aria-current");
      expect(firstRow).not.toHaveClass("selected");
      expect(secondRow).toHaveAttribute("aria-current", "true");
      expect(secondRow).toHaveClass("selected");
      expect(container.querySelectorAll("li.task-list-item")).toHaveLength(2);
    });
  });
});
