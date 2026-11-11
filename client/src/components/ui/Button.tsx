import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./Button.css";

/**
 * Visual variants of the shared Button primitive.
 *
 * - `primary` — single green accent CTA
 * - `secondary` — outlined, low-emphasis action
 * - `ghost` — borderless action for toolbars
 * - `danger` — destructive action in `--color-danger`
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/**
 * Sizes of the shared Button primitive (36px / 44px minimum heights).
 */
export type ButtonSize = "sm" | "md";

/**
 * Props for the shared Button primitive.
 *
 * Extends the native button attributes so `aria-label`, `title`, `onClick`,
 * form attributes, and data attributes pass through unchanged. `type` is
 * narrowed to the three valid HTML button types and defaults to `"button"` so
 * a button never submits a surrounding form by accident.
 */
export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  /** Visual treatment; defaults to `"primary"`. */
  variant?: ButtonVariant;
  /** Control height; defaults to `"md"` (44px touch target). */
  size?: ButtonSize;
  /** Shows a spinner, marks `aria-busy`, and disables interaction. */
  loading?: boolean;
  /** Native button type; defaults to `"button"`. */
  type?: "button" | "submit" | "reset";
  /** Additional CSS classes merged after the primitive's own classes. */
  className?: string;
  /** Button content. */
  children?: ReactNode;
}

/**
 * Shared button primitive for the Impetus Lock design system.
 *
 * Single implementation of the DESIGN.md button contract: green primary accent,
 * outlined secondary, borderless ghost, and red destructive action. Rounded at
 * `--radius-md` (6px) — never pill shaped. Focus is always an accent ring so
 * keyboard users see one consistent affordance.
 *
 * **Accessibility**:
 * - `loading` sets `aria-busy` and blocks activation without hiding the label
 * - `disabled` also short-circuits clicks while `loading`
 * - `focus-visible` renders a 2px `--color-accent` ring with 2px offset
 *
 * @param props - Component props
 * @param props.variant - Visual treatment (primary | secondary | ghost | danger)
 * @param props.size - Control height (sm | md)
 * @param props.loading - Whether the action is in flight
 * @param props.type - Native button type, defaults to "button"
 * @param props.className - Additional CSS classes
 * @param props.disabled - Whether the button is disabled
 * @param props.children - Button content
 * @param props.rest - Remaining native button attributes
 * @returns The rendered button element
 *
 * @example
 * ```tsx
 * <Button variant="primary" loading={isSaving} aria-label="Save task">
 *   Save
 * </Button>
 * ```
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  type = "button",
  className = "",
  disabled = false,
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const classes = ["ui-button", `ui-button--${variant}`, `ui-button--${size}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...rest}
      type={type}
      className={classes}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      data-loading={loading ? "true" : undefined}
    >
      {loading ? <span className="ui-button__spinner" aria-hidden="true" /> : null}
      <span className="ui-button__label">{children}</span>
    </button>
  );
}
