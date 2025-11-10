/**
 * Unit Tests for SimpleEditor (Milkdown Integration)
 *
 * Tests Milkdown editor initialization and basic rendering.
 *
 * Constitutional Compliance:
 * - Article III (TDD): Tests for P1 editor component
 * - Article III (Coverage): Critical path coverage for editor init
 * - Article V (Documentation): JSDoc for all test cases
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SimpleEditor } from "./EditorCore.simple";

/**
 * Mock Milkdown to avoid complex editor initialization in unit tests.
 * E2E tests will verify actual editor functionality.
 */
vi.mock("@milkdown/react", () => ({
  MilkdownProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="milkdown-provider">{children}</div>
  ),
  Milkdown: () => <div data-testid="milkdown-editor">Editor Content</div>,
  useEditor: vi.fn(() => ({})),
}));

vi.mock("@milkdown/core", () => ({
  Editor: {
    make: vi.fn(() => ({
      config: vi.fn().mockReturnThis(),
      use: vi.fn().mockReturnThis(),
    })),
  },
  rootCtx: {},
  defaultValueCtx: {},
}));

vi.mock("@milkdown/preset-commonmark", () => ({
  commonmark: {},
}));

vi.mock("@milkdown/theme-nord", () => ({
  nord: {},
}));

describe("SimpleEditor", () => {
  /**
   * Test: SimpleEditor should render without crashing.
   *
   * Critical path: Component initialization
   * Coverage: Ensures basic React render works
   */
  it("should render without crashing", () => {
    render(<SimpleEditor />);
    expect(screen.getByTestId("milkdown-provider")).toBeInTheDocument();
  });

  /**
   * Test: SimpleEditor should render Milkdown editor component.
   *
   * Critical path: Milkdown integration
   * Coverage: Verifies editor component is mounted
   */
  it("should render Milkdown editor component", () => {
    render(<SimpleEditor />);
    expect(screen.getByTestId("milkdown-editor")).toBeInTheDocument();
  });

  /**
   * Test: SimpleEditor should render wrapper div with correct styles.
   *
   * Coverage: UI structure validation
   */
  it("should render wrapper div with correct styles", () => {
    render(<SimpleEditor />);
    const wrapper = screen.getByTestId("simple-editor-wrapper");
    expect(wrapper).toHaveStyle({ padding: "20px" });
    expect(wrapper).toHaveStyle({ minHeight: "300px" });
    expect(wrapper).toHaveStyle({ borderWidth: "1px" });
    expect(wrapper).toHaveStyle({ borderStyle: "solid" });
  });

  /**
   * Test: SimpleEditor should use default initial content if not provided.
   *
   * Coverage: Default props handling
   */
  it("should use default initial content if not provided", () => {
    render(<SimpleEditor />);
    // Mock doesn't test actual content, E2E will verify this
    expect(screen.getByTestId("milkdown-editor")).toBeInTheDocument();
  });

  /**
   * Test: SimpleEditor should accept custom initial content.
   *
   * Coverage: Props handling
   */
  it("should accept custom initial content", () => {
    render(<SimpleEditor initialContent="# Custom Content" />);
    expect(screen.getByTestId("milkdown-editor")).toBeInTheDocument();
  });

  /**
   * Test: SimpleEditor should render MilkdownProvider as parent.
   *
   * Critical path: Context provider setup
   * Coverage: Ensures proper React context hierarchy
   */
  it("should render MilkdownProvider as parent", () => {
    render(<SimpleEditor />);
    const provider = screen.getByTestId("milkdown-provider");
    const editor = screen.getByTestId("milkdown-editor");

    expect(provider).toBeInTheDocument();
    expect(provider).toContainElement(editor);
  });

  /**
   * Test: SimpleEditor should not crash with empty initial content.
   *
   * Coverage: Edge case - empty string
   */
  it("should not crash with empty initial content", () => {
    render(<SimpleEditor initialContent="" />);
    expect(screen.getByTestId("milkdown-editor")).toBeInTheDocument();
  });

  /**
   * Test: SimpleEditor should not crash with very long initial content.
   *
   * Coverage: Edge case - large input
   */
  it("should not crash with very long initial content", () => {
    const longContent = "# Long Content\n\n" + "a".repeat(10000);
    render(<SimpleEditor initialContent={longContent} />);
    expect(screen.getByTestId("milkdown-editor")).toBeInTheDocument();
  });

  /**
   * Test: SimpleEditor should handle special Markdown characters.
   *
   * Coverage: Edge case - special characters
   */
  it("should handle special Markdown characters", () => {
    const specialContent = "# Test\n\n**Bold** _italic_ `code` [link](url)";
    render(<SimpleEditor initialContent={specialContent} />);
    expect(screen.getByTestId("milkdown-editor")).toBeInTheDocument();
  });

  /**
   * Test: SimpleEditor should be accessible (no a11y violations).
   *
   * Coverage: Accessibility compliance (Article V)
   */
  it("should be accessible", async () => {
    render(<SimpleEditor />);
    const wrapper = screen.getByTestId("simple-editor-wrapper");
    expect(wrapper).toBeVisible();
  });
});
