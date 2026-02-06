import { useState } from "react";
import "./NewTaskButton.css";

/**
 * NewTaskButton - Floating Action Button (FAB) for creating tasks.
 *
 * A floating action button positioned in the bottom-right corner of the screen
 * that opens a modal or dialog for creating new tasks. Features smooth hover
 * animations and click ripple effect for modern UX.
 *
 * **Features**:
 * - FAB design pattern (circular, elevated, bottom-right positioning)
 * - Plus (+) icon that rotates on hover
 * - Smooth click animation with scale transform
 * - Accessibility compliant (aria-label, focus-visible states)
 * - Touch-friendly (44x44px minimum touch target)
 *
 * **Accessibility**:
 * - `aria-label`: Descriptive label for screen readers
 * - `focus-visible`: Clear focus indicator for keyboard navigation
 * - 44x44px minimum touch target (WCAG 2.1 AA compliant)
 *
 * @param props - Component props
 * @param props.onClick - Callback when button is clicked
 * @param props.disabled - Whether the button is disabled (default: false)
 * @param props.ariaLabel - Custom aria-label (default: "Create new task")
 * @param props.className - Additional CSS classes
 *
 * @example
 * ```tsx
 * <NewTaskButton
 *   onClick={() => setShowModal(true)}
 *   ariaLabel="Add a new task"
 * />
 * ```
 */
export function NewTaskButton({
  onClick,
  disabled = false,
  ariaLabel = "Create new task",
  className = "",
}: {
  onClick?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = () => {
    if (disabled) return;

    // Trigger click animation
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 200);

    onClick?.();
  };

  return (
    <button
      type="button"
      className={`new-task-button ${isAnimating ? "clicking" : ""} ${className}`.trim()}
      onClick={handleClick}
      disabled={disabled}
      aria-label={ariaLabel}
      data-testid="new-task-button"
      aria-disabled={disabled}
    >
      <svg
        className="new-task-button-icon"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </button>
  );
}
