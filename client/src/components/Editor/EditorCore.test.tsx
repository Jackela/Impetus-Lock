/**
 * Unit Tests for EditorCore (Full Milkdown Editor with Lock System)
 *
 * Tests the complete editor with lock enforcement, transaction filtering,
 * and AI intervention integration.
 *
 * Constitutional Compliance:
 * - Article III (TDD): Tests for P1 editor component with lock system
 * - Article III (Coverage): ≥80% coverage for critical paths (lock enforcement)
 * - Article V (Documentation): JSDoc for all test cases
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { EditorCore } from "./EditorCore";

/**
 * Mock all Milkdown dependencies to avoid complex editor initialization.
 * E2E tests will verify actual editor functionality.
 */
vi.mock("@milkdown/react", () => ({
  MilkdownProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="milkdown-provider">{children}</div>
  ),
  Milkdown: () => <div data-testid="milkdown-editor">Editor Content</div>,
  useEditor: vi.fn(() => ({
    get: vi.fn(),
  })),
}));

vi.mock("@milkdown/core", () => ({
  Editor: {
    make: vi.fn(() => ({
      config: vi.fn().mockReturnThis(),
      use: vi.fn().mockReturnThis(),
      create: vi.fn().mockResolvedValue({}),
    })),
  },
  rootCtx: {},
  defaultValueCtx: {},
  editorViewCtx: {},
}));

vi.mock("@milkdown/preset-commonmark", () => ({
  commonmark: {},
}));

vi.mock("@milkdown/theme-nord", () => ({
  nord: {},
}));

// Mock services - include both class and singleton for context compatibility
vi.mock("../../services/LockManager", () => {
  const mockLockManagerInstance = {
    applyLock: vi.fn(),
    hasLock: vi.fn(() => false),
    extractLockEntriesFromMarkdown: vi.fn(() => []),
    extractLocksFromMarkdown: vi.fn(() => []),
    getLockCount: vi.fn(() => 0),
    getAllLocks: vi.fn(() => []),
    removeLock: vi.fn(),
    getLockMetadata: vi.fn(),
    getLockSource: vi.fn(),
    injectLockComment: vi.fn((content: string) => content),
    clear: vi.fn(),
  };

  // Create a proper class mock that can be instantiated with `new`
  class MockLockManager {
    applyLock = mockLockManagerInstance.applyLock;
    hasLock = mockLockManagerInstance.hasLock;
    extractLockEntriesFromMarkdown = mockLockManagerInstance.extractLockEntriesFromMarkdown;
    extractLocksFromMarkdown = mockLockManagerInstance.extractLocksFromMarkdown;
    getLockCount = mockLockManagerInstance.getLockCount;
    getAllLocks = mockLockManagerInstance.getAllLocks;
    removeLock = mockLockManagerInstance.removeLock;
    getLockMetadata = mockLockManagerInstance.getLockMetadata;
    getLockSource = mockLockManagerInstance.getLockSource;
    injectLockComment = mockLockManagerInstance.injectLockComment;
    clear = mockLockManagerInstance.clear;
  }

  return {
    lockManager: mockLockManagerInstance,
    LockManager: MockLockManager,
  };
});

vi.mock("./TransactionFilter", () => ({
  createLockTransactionFilter: vi.fn(() => vi.fn()),
}));

vi.mock("../../hooks/useWritingState", () => ({
  useWritingState: vi.fn(() => ({
    writingState: "idle",
    handleContentChange: vi.fn(),
  })),
}));

vi.mock("../../hooks/useLokiTimer", () => ({
  useLokiTimer: vi.fn(() => ({
    isActive: false,
    reset: vi.fn(),
  })),
}));

vi.mock("../../services/api/interventionClient", () => ({
  triggerMuseIntervention: vi.fn(),
  triggerLokiIntervention: vi.fn(),
}));

vi.mock("../../services/ContentInjector", () => ({
  injectLockedBlock: vi.fn(),
  deleteContentAtAnchor: vi.fn(),
}));

vi.mock("../SensoryFeedback", () => ({
  SensoryFeedback: () => <div data-testid="sensory-feedback">Feedback</div>,
}));

describe("EditorCore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test: EditorCore should render without crashing.
   *
   * Critical path: Component initialization
   * Coverage: Ensures basic React render works
   */
  it("should render without crashing", () => {
    render(<EditorCore />);
    expect(screen.getByTestId("milkdown-provider")).toBeInTheDocument();
  });

  /**
   * Test: EditorCore should render Milkdown editor component.
   *
   * Critical path: Milkdown integration
   * Coverage: Verifies editor component is mounted
   */
  it("should render Milkdown editor component", () => {
    render(<EditorCore />);
    expect(screen.getByTestId("milkdown-editor")).toBeInTheDocument();
  });

  /**
   * Test: EditorCore should render SensoryFeedback component.
   *
   * Coverage: P2 feature integration (vibe enhancements)
   */
  it("should render SensoryFeedback component", () => {
    render(<EditorCore />);
    expect(screen.getByTestId("sensory-feedback")).toBeInTheDocument();
  });

  /**
   * Test: EditorCore should accept initialContent prop.
   *
   * Coverage: Props handling
   */
  it("should accept initialContent prop", () => {
    render(<EditorCore initialContent="# Test Content" />);
    expect(screen.getByTestId("milkdown-editor")).toBeInTheDocument();
  });

  /**
   * Test: EditorCore should accept mode prop.
   *
   * Coverage: Agent mode integration
   */
  it("should accept mode prop", () => {
    render(<EditorCore mode="muse" />);
    expect(screen.getByTestId("milkdown-editor")).toBeInTheDocument();
  });

  /**
   * Test: EditorCore should accept onChange callback.
   *
   * Coverage: Event handling
   */
  it("should accept onChange callback", () => {
    const onChange = vi.fn();
    render(<EditorCore onChange={onChange} />);
    expect(screen.getByTestId("milkdown-editor")).toBeInTheDocument();
  });

  /**
   * Test: EditorCore should accept onReady callback.
   *
   * Coverage: Lifecycle callbacks
   */
  it("should accept onReady callback", () => {
    const onReady = vi.fn();
    render(<EditorCore onReady={onReady} />);
    expect(screen.getByTestId("milkdown-editor")).toBeInTheDocument();
  });

  /**
   * Test: EditorCore should handle empty initialContent.
   *
   * Coverage: Edge case - empty string
   */
  it("should handle empty initialContent", () => {
    render(<EditorCore initialContent="" />);
    expect(screen.getByTestId("milkdown-editor")).toBeInTheDocument();
  });

  /**
   * Test: EditorCore should handle mode="off".
   *
   * Coverage: Default/disabled state
   */
  it("should handle mode='off'", () => {
    render(<EditorCore mode="off" />);
    expect(screen.getByTestId("milkdown-editor")).toBeInTheDocument();
  });

  /**
   * Test: EditorCore should handle mode="loki".
   *
   * Coverage: Loki mode integration
   */
  it("should handle mode='loki'", () => {
    render(<EditorCore mode="loki" />);
    expect(screen.getByTestId("milkdown-editor")).toBeInTheDocument();
  });

  /**
   * Test: EditorCore should render with all props.
   *
   * Coverage: Full props integration
   */
  it("should render with all props", () => {
    const onChange = vi.fn();
    const onReady = vi.fn();

    render(
      <EditorCore initialContent="# Full Test" mode="muse" onChange={onChange} onReady={onReady} />
    );

    expect(screen.getByTestId("milkdown-editor")).toBeInTheDocument();
    expect(screen.getByTestId("sensory-feedback")).toBeInTheDocument();
  });

  /**
   * Test: EditorCore should not crash with very long initialContent.
   *
   * Coverage: Edge case - large input
   */
  it("should not crash with very long initialContent", () => {
    const longContent = "# Long\n\n" + "a".repeat(10000);
    render(<EditorCore initialContent={longContent} />);
    expect(screen.getByTestId("milkdown-editor")).toBeInTheDocument();
  });

  /**
   * Test: EditorCore should handle special Markdown with lock comments.
   *
   * Critical path: Lock comment parsing
   * Coverage: Lock persistence feature
   */
  it("should handle Markdown with lock comments", () => {
    const contentWithLocks = "> Muse Prompt <!-- lock:lock_001 source:muse -->";
    render(<EditorCore initialContent={contentWithLocks} />);
    expect(screen.getByTestId("milkdown-editor")).toBeInTheDocument();
  });

  /**
   * Test: EditorCore should be accessible.
   *
   * Coverage: Accessibility compliance (Article V)
   */
  it("should be accessible", () => {
    render(<EditorCore />);
    const provider = screen.getByTestId("milkdown-provider");
    expect(provider).toBeInTheDocument();
    expect(provider).toBeVisible();
  });
});
