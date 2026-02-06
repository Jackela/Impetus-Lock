import "./Skeleton.css";

/**
 * Props for the Skeleton component.
 */
export interface SkeletonProps {
  /** CSS class name for custom styling */
  className?: string;
  /** Width of the skeleton (CSS value) */
  width?: string;
  /** Height of the skeleton (CSS value) */
  height?: string;
  /** Number of skeleton lines to render */
  lines?: number;
  /** Whether to show animation */
  animate?: boolean;
  /** Shape variant */
  variant?: "text" | "circle" | "rect";
}

/**
 * Skeleton component for displaying loading placeholder content.
 *
 * Shows animated placeholder elements while content is loading.
 * Supports different shapes (text, circle, rect) and multiple lines.
 *
 * @example
 * ```tsx
 * <Skeleton lines={3} />
 * <Skeleton variant="circle" width={40} height={40} />
 * <Skeleton variant="rect" width="100%" height={200} />
 * ```
 */
export function Skeleton({
  className = "",
  width,
  height,
  lines = 1,
  animate = true,
  variant = "text",
}: SkeletonProps): JSX.Element {
  const skeletonClass = [
    "skeleton",
    `skeleton--${variant}`,
    animate ? "skeleton--animate" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const baseProps = {
    className: skeletonClass,
    style: { width, height } as React.CSSProperties,
  };

  if (variant === "text" && lines > 1) {
    return (
      <div className="skeleton-lines" style={{ width }}>
        {Array.from({ length: lines }).map((_, index) => (
          <div key={index} className={skeletonClass} style={{ height }} />
        ))}
      </div>
    );
  }

  return <div {...baseProps} aria-hidden="true" />;
}
