import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CreateTaskModal } from "./CreateTaskModal";
import * as useCreateTaskModule from "../../hooks/useCreateTask";

// Mock the useCreateTask hook
vi.mock("../../hooks/useCreateTask", () => ({
  useCreateTask: vi.fn(),
}));

const mockMutate = vi.fn();
const mockUseCreateTask = {
  mutate: mockMutate,
  mutateAsync: vi.fn(),
  isLoading: false,
  error: null,
};

describe("CreateTaskModal", () => {
  let queryClient: QueryClient;

  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        mutations: {
          retry: false,
        },
      },
    });

    vi.clearAllMocks();
    mockMutate.mockImplementation((variables, options) => {
      // Simulate success by default
      options?.onSuccess?.({ id: "task-123", content: variables.content });
    });

    vi.mocked(useCreateTaskModule.useCreateTask).mockReturnValue(mockUseCreateTask);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe("rendering", () => {
    it("should not render when open is false", () => {
      render(<CreateTaskModal {...defaultProps} open={false} />, { wrapper });

      expect(screen.queryByTestId("create-task-modal")).not.toBeInTheDocument();
    });

    it("should render when open is true", () => {
      render(<CreateTaskModal {...defaultProps} open={true} />, { wrapper });

      expect(screen.getByTestId("create-task-modal")).toBeInTheDocument();
    });

    it("should render title", () => {
      render(<CreateTaskModal {...defaultProps} open={true} />, { wrapper });

      expect(screen.getByText("Create New Task")).toBeInTheDocument();
    });

    it("should render input field", () => {
      render(<CreateTaskModal {...defaultProps} open={true} />, { wrapper });

      const input = screen.getByTestId("create-task-input");
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute("type", "text");
      expect(input).toHaveAttribute("placeholder", "Enter task title...");
    });

    it("should render cancel and confirm buttons", () => {
      render(<CreateTaskModal {...defaultProps} open={true} />, { wrapper });

      expect(screen.getByTestId("create-task-cancel")).toBeInTheDocument();
      expect(screen.getByTestId("create-task-confirm")).toBeInTheDocument();
      expect(screen.getByText("Cancel")).toBeInTheDocument();
      expect(screen.getByText("Create Task")).toBeInTheDocument();
    });

    it("should render character count", () => {
      render(<CreateTaskModal {...defaultProps} open={true} />, { wrapper });

      expect(screen.getByText("0/200")).toBeInTheDocument();
    });

    it("should have input with maxLength of 200", () => {
      render(<CreateTaskModal {...defaultProps} open={true} />, { wrapper });

      const input = screen.getByTestId("create-task-input");
      expect(input).toHaveAttribute("maxLength", "200");
    });

    it("should have input with aria-invalid false by default", () => {
      render(<CreateTaskModal {...defaultProps} open={true} />, { wrapper });

      const input = screen.getByTestId("create-task-input");
      expect(input).toHaveAttribute("aria-invalid", "false");
    });
  });

  describe("validation", () => {
    it("should disable confirm button when input is empty", () => {
      render(<CreateTaskModal {...defaultProps} open={true} />, { wrapper });

      const confirmButton = screen.getByTestId("create-task-confirm");
      expect(confirmButton).toBeDisabled();
    });
  });

  describe("loading state", () => {
    beforeEach(() => {
      vi.mocked(useCreateTaskModule.useCreateTask).mockReturnValue({
        ...mockUseCreateTask,
        isLoading: true,
      });
    });

    it("should disable buttons during loading", () => {
      render(<CreateTaskModal {...defaultProps} open={true} />, { wrapper });

      const cancelButton = screen.getByTestId("create-task-cancel");
      expect(cancelButton).toBeDisabled();
    });

    it("should show loading text on confirm button", () => {
      render(<CreateTaskModal {...defaultProps} open={true} />, { wrapper });

      expect(screen.getByText("Creating...")).toBeInTheDocument();
    });

    it("should disable input during loading", () => {
      render(<CreateTaskModal {...defaultProps} open={true} />, { wrapper });

      const input = screen.getByTestId("create-task-input");
      expect(input).toBeDisabled();
    });
  });

  describe("cancel and close", () => {
    it("should call onClose when cancel is clicked", () => {
      render(<CreateTaskModal {...defaultProps} open={true} />, { wrapper });

      const cancelButton = screen.getByTestId("create-task-cancel");
      cancelButton.click();

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it("should call onClose when overlay is clicked", () => {
      render(<CreateTaskModal {...defaultProps} open={true} />, { wrapper });

      const overlay = screen.getByTestId("create-task-modal");
      overlay.click();

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it("should not close when clicking modal content", () => {
      render(<CreateTaskModal {...defaultProps} open={true} />, { wrapper });

      const modalContent = screen.getByText("Create New Task").closest(".create-task-modal");
      modalContent?.click();

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  describe("accessibility", () => {
    it("should have role dialog", () => {
      render(<CreateTaskModal {...defaultProps} open={true} />, { wrapper });

      const overlay = screen.getByTestId("create-task-modal");
      expect(overlay).toHaveAttribute("role", "dialog");
    });

    it("should have aria-modal", () => {
      render(<CreateTaskModal {...defaultProps} open={true} />, { wrapper });

      const overlay = screen.getByTestId("create-task-modal");
      expect(overlay).toHaveAttribute("aria-modal", "true");
    });

    it("should have aria-labelledby pointing to title", () => {
      render(<CreateTaskModal {...defaultProps} open={true} />, { wrapper });

      const overlay = screen.getByTestId("create-task-modal");
      expect(overlay).toHaveAttribute("aria-labelledby", "create-task-title-label");
    });

    it("should have label with htmlFor pointing to input", () => {
      render(<CreateTaskModal {...defaultProps} open={true} />, { wrapper });

      const label = screen.getByText("Task Title *");
      expect(label).toHaveAttribute("for", "create-task-title");
    });

    it("should have input with id matching label", () => {
      render(<CreateTaskModal {...defaultProps} open={true} />, { wrapper });

      const input = screen.getByTestId("create-task-input");
      expect(input).toHaveAttribute("id", "create-task-title");
    });
  });

  describe("mutation integration", () => {
    it("should use useCreateTask hook", () => {
      render(<CreateTaskModal {...defaultProps} open={true} />, { wrapper });

      expect(useCreateTaskModule.useCreateTask).toHaveBeenCalled();
    });

    it("should call onClose when cancel button is clicked", () => {
      render(<CreateTaskModal {...defaultProps} open={true} />, { wrapper });

      const cancelButton = screen.getByTestId("create-task-cancel");
      cancelButton.click();

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });
});
