import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import "./Modal.css";

/**
 * Width presets for the shared Modal primitive.
 *
 * - `sm` — 360px, confirmations
 * - `md` — 520px, short forms (default)
 * - `lg` — 760px, panels and long-form content
 */
export type ModalSize = "sm" | "md" | "lg";

/**
 * Open-dialog stack shared by every mounted `Modal`.
 *
 * Only the last entry is the top layer: it owns Escape, while dialogs below it
 * stay open. The stack is also the reference count for the `inert` /
 * `aria-hidden` background marking and the body scroll lock, so nested or
 * simultaneously open dialogs never release them early.
 */
const openDialogStack: symbol[] = [];

/**
 * Props for the shared Modal primitive.
 */
export interface ModalProps {
  /** Whether the dialog is mounted and interactive. */
  open: boolean;
  /** Called on Escape, or on backdrop press when enabled. */
  onClose: () => void;
  /** Accessible name for the dialog (`aria-label`). Required. */
  ariaLabel: string;
  /** Width preset; defaults to `"md"`. */
  size?: ModalSize;
  /** Whether pressing the backdrop closes the dialog; defaults to `false`. */
  closeOnBackdropClick?: boolean;
  /** Additional CSS classes merged onto the dialog surface. */
  className?: string;
  /** Optional `data-testid` placed on the dialog surface. */
  testId?: string;
  /** Dialog content. */
  children?: ReactNode;
}

/**
 * Shared modal dialog primitive for the Impetus Lock design system.
 *
 * Owns the mechanics that every dialog otherwise re-implements: a portaled
 * overlay on `--z-modal`, focus trapping through the existing `useFocusTrap`
 * hook, Escape-to-close, background `inert`/`aria-hidden`, and body scroll
 * lock. It renders no chrome of its own beyond the surface and sizing, so
 * callers compose their own header, body, and footer.
 *
 * Existing modals (CreateTaskModal, WelcomeModal, ExportModal, ...) are not
 * touched by this primitive; it is provided so new surfaces can stop
 * duplicating dialog behaviour.
 *
 * **Accessibility**:
 * - `role="dialog"` with `aria-modal="true"` and a required `aria-label`
 * - Tab / Shift+Tab cycle inside the dialog via `useFocusTrap`
 * - Escape closes only the top-most dialog; focus returns to the trigger when
 *   the dialog unmounts
 * - The app root is marked `inert` and `aria-hidden` while any dialog is open
 * - Body scroll is locked and restored to its previous value on close
 *
 * @param props - Component props
 * @param props.open - Whether the dialog is open
 * @param props.onClose - Callback invoked when the dialog requests closing
 * @param props.ariaLabel - Accessible name for the dialog
 * @param props.size - Width preset (sm | md | lg)
 * @param props.closeOnBackdropClick - Whether backdrop presses close the dialog
 * @param props.className - Additional CSS classes for the dialog surface
 * @param props.testId - Optional `data-testid` for the dialog surface
 * @param props.children - Dialog content
 * @returns The portaled dialog, or `null` when closed
 *
 * @example
 * ```tsx
 * <Modal open={open} onClose={() => setOpen(false)} ariaLabel="Writing statistics">
 *   <h2>Writing Statistics</h2>
 * </Modal>
 * ```
 */
export function Modal({
  open,
  onClose,
  ariaLabel,
  size = "md",
  closeOnBackdropClick = false,
  className = "",
  testId,
  children,
}: ModalProps) {
  const { ref } = useFocusTrap<HTMLDivElement>({ active: open });
  const dialogId = useRef<symbol>(Symbol("ui-modal"));

  // Register this dialog in the open stack so Escape and the background
  // `inert` marking stay layer-aware.
  useEffect(() => {
    if (!open) return;
    const id = dialogId.current;
    openDialogStack.push(id);
    return () => {
      const index = openDialogStack.indexOf(id);
      if (index >= 0) openDialogStack.splice(index, 1);
    };
  }, [open]);

  // Escape closes only the top-most dialog. Captured on document so it works
  // regardless of which descendant currently holds focus.
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (openDialogStack[openDialogStack.length - 1] !== dialogId.current) return;
      event.stopPropagation();
      onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Mark the application root inert so screen readers and Tab order cannot
  // reach the background while a dialog is open.
  useEffect(() => {
    if (!open) return;

    const root = document.getElementById("root");
    if (!root) return;

    root.setAttribute("inert", "");
    root.setAttribute("aria-hidden", "true");

    return () => {
      // Another dialog may still be open on top of this one.
      if (openDialogStack.length > 0) return;
      root.removeAttribute("inert");
      root.removeAttribute("aria-hidden");
    };
  }, [open]);

  // Lock background scrolling and restore the previous inline value on close.
  useEffect(() => {
    if (!open) return;

    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    return () => {
      if (openDialogStack.length > 0) return;
      body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  const dialogClasses = ["ui-modal", `ui-modal--${size}`, className].filter(Boolean).join(" ");

  return createPortal(
    <div
      className="ui-modal__overlay"
      onMouseDown={(event) => {
        if (!closeOnBackdropClick) return;
        if (event.target !== event.currentTarget) return;
        onClose();
      }}
    >
      <div
        ref={ref}
        className={dialogClasses}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        data-testid={testId}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
