import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton } from "./Skeleton";

describe("Skeleton", () => {
  it("renders with default props", () => {
    const { container } = render(<Skeleton />);

    const skeleton = container.querySelector(".skeleton");
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveClass("skeleton--text");
    expect(skeleton).toHaveClass("skeleton--animate");
  });

  it("renders with custom className", () => {
    const { container } = render(<Skeleton className="custom-class" />);

    const skeleton = container.querySelector(".skeleton");
    expect(skeleton).toHaveClass("custom-class");
  });

  it("renders with custom width and height", () => {
    const { container } = render(<Skeleton width="200px" height="40px" />);

    const skeleton = container.querySelector(".skeleton") as HTMLElement;
    expect(skeleton.style.width).toBe("200px");
    expect(skeleton.style.height).toBe("40px");
  });

  it("renders without animation when animate is false", () => {
    const { container } = render(<Skeleton animate={false} />);

    const skeleton = container.querySelector(".skeleton");
    expect(skeleton).not.toHaveClass("skeleton--animate");
  });

  it("renders text variant by default", () => {
    const { container } = render(<Skeleton variant="text" />);

    const skeleton = container.querySelector(".skeleton");
    expect(skeleton).toHaveClass("skeleton--text");
  });

  it("renders circle variant", () => {
    const { container } = render(<Skeleton variant="circle" />);

    const skeleton = container.querySelector(".skeleton");
    expect(skeleton).toHaveClass("skeleton--circle");
  });

  it("renders rect variant", () => {
    const { container } = render(<Skeleton variant="rect" />);

    const skeleton = container.querySelector(".skeleton");
    expect(skeleton).toHaveClass("skeleton--rect");
  });

  it("renders multiple lines when lines > 1", () => {
    const { container } = render(<Skeleton lines={3} />);

    const skeletons = container.querySelectorAll(".skeleton");
    expect(skeletons).toHaveLength(3);
  });

  it("wraps multiple lines in skeleton-lines container", () => {
    const { container } = render(<Skeleton lines={2} />);

    const linesContainer = container.querySelector(".skeleton-lines");
    expect(linesContainer).toBeInTheDocument();
  });

  it("does not wrap single line in skeleton-lines container", () => {
    const { container } = render(<Skeleton lines={1} />);

    const linesContainer = container.querySelector(".skeleton-lines");
    expect(linesContainer).not.toBeInTheDocument();
  });

  it("has aria-hidden attribute", () => {
    render(<Skeleton />);

    // The component has aria-hidden but testing-library doesn't expose it directly
    const element = document.querySelector(".skeleton");
    expect(element?.getAttribute("aria-hidden")).toBe("true");
  });

  it("applies custom width to multi-line container", () => {
    const { container } = render(<Skeleton lines={2} width="300px" />);

    const linesContainer = container.querySelector(".skeleton-lines") as HTMLElement;
    expect(linesContainer.style.width).toBe("300px");
  });

  it("applies custom height to each line in multi-line", () => {
    const { container } = render(<Skeleton lines={2} height="20px" />);

    const skeletons = container.querySelectorAll(".skeleton") as NodeListOf<HTMLElement>;
    skeletons.forEach((skeleton) => {
      expect(skeleton.style.height).toBe("20px");
    });
  });
});
