import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaskList } from "./TaskList";
import type { TaskRecord } from "../../types/task";

describe("TaskList", () => {
  const mockTask: TaskRecord = {
    id: "task-1",
    content: "Test task content",
    lock_ids: [],
    created_at: "2025-02-04T10:00:00Z",
    updated_at: "2025-02-04T10:00:00Z",
    version: 1,
  };

  const mockTaskWithLocks: TaskRecord = {
    id: "task-2",
    content: "Task with locks",
    lock_ids: ["lock-1", "lock-2"],
    created_at: "2025-02-04T09:00:00Z",
    updated_at: "2025-02-04T10:00:00Z",
    version: 2,
  };

  describe("rendering", () => {
    it("should render empty state when no tasks provided", () => {
      render(<TaskList tasks={[]} />);

      expect(screen.getByTestId("task-list-empty")).toBeInTheDocument();
      expect(
        screen.getByText("No tasks yet. Create your first task to get started!")
      ).toBeInTheDocument();
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
    it("should have aria-selected on task items", () => {
      render(<TaskList tasks={[mockTask]} selectedTaskId={mockTask.id} />);

      const taskButton = screen.getByTestId(`task-item-${mockTask.id}`);
      expect(taskButton).toHaveAttribute("aria-selected", "true");
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

  describe("snapshot", () => {
    it("should match snapshot for empty state", () => {
      const { container } = render(<TaskList tasks={[]} />);

      expect(container.firstChild).toMatchSnapshot();
    });

    it("should match snapshot with tasks", () => {
      const tasks = [mockTask, mockTaskWithLocks];
      const { container } = render(<TaskList tasks={tasks} />);

      expect(container.firstChild).toMatchSnapshot();
    });

    it("should match snapshot with selected task", () => {
      const { container } = render(<TaskList tasks={[mockTask]} selectedTaskId={mockTask.id} />);

      expect(container.firstChild).toMatchSnapshot();
    });
  });
});
