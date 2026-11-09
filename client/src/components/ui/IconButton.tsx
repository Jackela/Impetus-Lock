import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./IconButton.css";

/**
 * Sizes of the shared IconButton primitive.
 *
 * - `sm` — 36px, for dense toolbars and inline rows
 * - `md` — 44px, the WCAG 2.1 minimum touch target (default)
 */
export type IconButtonSize = "sm" | "md";

/**
 * Visual variants of the shared IconButton primitive.
 *
 * Both are borderless by default; `ghost` is the default treatment.
 */
export type IconButtonVariant = "ghost" | "secondary";

/**
 * Props for the shared IconButton primitive.
 *
 * `ariaLabel` is required because the control renders only an icon — there is
 * no text content for assistive technology to fall back on.
 */
export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "aria-label" | "children"
> {
  /** Accessible name announced by screen readers. Required. */
  ariaLabel: string;
  /** Control height: 36px (`sm`) or 44px (`md`, default). */
  size?: IconButtonSize;
  /** Visual treatment; defaults to `"ghost"`. */
  variant?: IconButtonVariant;
  /** Native button type; defaults to `"button"`. */
  type?: "button" | "submit" | "reset";
  /** Additional CSS classes merged after the primitive's own classes. */
  className?: string;
  /** Optional test hook forwarded to the native button. */
  "data-testid"?: string;
  /** The icon to render; expected to be `aria-hidden` itself. */
  children: ReactNode;
}

/**
 * Square, icon-only button primitive for the Impetus Lock design system.
 *
 * A ghost button by default so toolbars stay quiet until hovered. Every
 * instance must carry an accessible name, enforced at the type level, and the
 * keyboard focus ring is always green (`--color-accent`) per the single-accent
 * rule.
 *
 * **Accessibility**:
 * - `aria-label` is required and always forwarded to the native button
 * - `title` mirrors the label as a hover tooltip when supplied by the caller
 * - `focus-visible` renders a 2px `--color-accent` ring with 2px offset
 *
 * @param props - Component props
 * @param props.ariaLabel - Accessible name (required)
 * @param props.size - Control height (sm = 36px, md = 44px)
 * @param props.variant - Visual treatment (ghost | secondary)
 * @param props.type - Native button type, defaults to "button"
 * @param props.className - Additional CSS classes
 * @param props.disabled - Whether the button is disabled
 * @param props.children - The icon element to render
 * @param props.rest - Remaining native button attributes
 * @returns The rendered icon-only button
 *
 * @example
 * ```tsx
 * <IconButton ariaLabel="Close statistics" onClick={onClose}>
 *   <CloseIcon />
 * </IconButton>
 * ```
 */
export function IconButton({
  ariaLabel,
  size = "md",
  variant = "ghost",
  type = "button",
  className = "",
  disabled = false,
  children,
  ...rest
}: IconButtonProps) {
  const classes = [
    "ui-icon-button",
    `ui-icon-button--${variant}`,
    `ui-icon-button--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button {...rest} type={type} className={classes} aria-label={ariaLabel} disabled={disabled}>
      {children}
    </button>
  );
}
