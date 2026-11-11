import type { ReactNode } from "react";

/**
 * Shared props for every inline icon in the Impetus Lock icon set.
 *
 * Icons paint with `currentColor` and are always `aria-hidden`, so colour and
 * accessible naming come from the surrounding control.
 */
export interface IconProps {
  /** Rendered width and height in px; defaults to 24. */
  size?: number;
  /** Additional CSS classes applied to the `<svg>` element. */
  className?: string;
}

interface IconFrameProps extends IconProps {
  children: ReactNode;
}

/**
 * Internal stroke-based SVG frame shared by every icon.
 *
 * @param props - Frame props
 * @param props.size - Rendered width/height in px
 * @param props.className - Additional CSS classes
 * @param props.children - SVG path children
 * @returns The framed SVG element
 */
function IconFrame({ size = 24, className, children }: IconFrameProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/**
 * Trophy icon — earned achievement / award.
 *
 * @param props - Icon props
 * @param props.size - Rendered width/height in px
 * @param props.className - Additional CSS classes
 * @returns The trophy SVG element
 */
export function TrophyIcon({ size, className }: IconProps) {
  return (
    <IconFrame size={size} className={className}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5.5H6.25a2.25 2.25 0 0 0 0 4.5H8" />
      <path d="M16 5.5h1.75a2.25 2.25 0 0 1 0 4.5H16" />
      <path d="M12 13v4" />
      <path d="M9.5 21h5" />
      <path d="M10.25 17h3.5l.75 4h-5l.75-4Z" />
    </IconFrame>
  );
}

/**
 * Sun icon — light theme / daylight mode.
 *
 * @param props - Icon props
 * @param props.size - Rendered width/height in px
 * @param props.className - Additional CSS classes
 * @returns The sun SVG element
 */
export function SunIcon({ size, className }: IconProps) {
  return (
    <IconFrame size={size} className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2" />
      <path d="M12 19.5v2" />
      <path d="M2.5 12h2" />
      <path d="M19.5 12h2" />
      <path d="M5.1 5.1l1.4 1.4" />
      <path d="M17.5 17.5l1.4 1.4" />
      <path d="M18.9 5.1l-1.4 1.4" />
      <path d="M6.5 17.5l-1.4 1.4" />
    </IconFrame>
  );
}

/**
 * Moon icon — dark theme / night mode.
 *
 * @param props - Icon props
 * @param props.size - Rendered width/height in px
 * @param props.className - Additional CSS classes
 * @returns The moon SVG element
 */
export function MoonIcon({ size, className }: IconProps) {
  return (
    <IconFrame size={size} className={className}>
      <path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1Z" />
    </IconFrame>
  );
}

/**
 * Lock icon — immutable / locked content.
 *
 * @param props - Icon props
 * @param props.size - Rendered width/height in px
 * @param props.className - Additional CSS classes
 * @returns The lock SVG element
 */
export function LockIcon({ size, className }: IconProps) {
  return (
    <IconFrame size={size} className={className}>
      <rect x="4.75" y="10.75" width="14.5" height="9.5" rx="2.25" />
      <path d="M8.25 10.75V8a3.75 3.75 0 0 1 7.5 0v2.75" />
      <path d="M12 14.75v2" />
    </IconFrame>
  );
}

/**
 * Sparkle icon — AI intervention / muse inspiration.
 *
 * @param props - Icon props
 * @param props.size - Rendered width/height in px
 * @param props.className - Additional CSS classes
 * @returns The sparkle SVG element
 */
export function SparkleIcon({ size, className }: IconProps) {
  return (
    <IconFrame size={size} className={className}>
      <path d="M11 3.5l1.6 4.1 4.1 1.6-4.1 1.6L11 14.9 9.4 10.8 5.3 9.2l4.1-1.6L11 3.5Z" />
      <path d="M17.75 14.5l.8 2.05 2.05.8-2.05.8-.8 2.05-.8-2.05-2.05-.8 2.05-.8.8-2.05Z" />
    </IconFrame>
  );
}

/**
 * Check icon — confirmation / earned state.
 *
 * @param props - Icon props
 * @param props.size - Rendered width/height in px
 * @param props.className - Additional CSS classes
 * @returns The check SVG element
 */
export function CheckIcon({ size, className }: IconProps) {
  return (
    <IconFrame size={size} className={className}>
      <path d="M4.5 12.5l5 5 10-11" />
    </IconFrame>
  );
}

/**
 * Close icon — dismiss / cancel.
 *
 * @param props - Icon props
 * @param props.size - Rendered width/height in px
 * @param props.className - Additional CSS classes
 * @returns The close SVG element
 */
export function CloseIcon({ size, className }: IconProps) {
  return (
    <IconFrame size={size} className={className}>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </IconFrame>
  );
}

/**
 * List icon — task list / outline.
 *
 * @param props - Icon props
 * @param props.size - Rendered width/height in px
 * @param props.className - Additional CSS classes
 * @returns The list SVG element
 */
export function ListIcon({ size, className }: IconProps) {
  return (
    <IconFrame size={size} className={className}>
      <path d="M8.5 6.5h12" />
      <path d="M8.5 12h12" />
      <path d="M8.5 17.5h12" />
      <path d="M4 6.5h.01" />
      <path d="M4 12h.01" />
      <path d="M4 17.5h.01" />
    </IconFrame>
  );
}

/**
 * Layers icon — stacked surfaces / structure.
 *
 * @param props - Icon props
 * @param props.size - Rendered width/height in px
 * @param props.className - Additional CSS classes
 * @returns The layers SVG element
 */
export function LayersIcon({ size, className }: IconProps) {
  return (
    <IconFrame size={size} className={className}>
      <path d="M12 3l9 4.75-9 4.75L3 7.75 12 3Z" />
      <path d="M3 12.25l9 4.75 9-4.75" />
      <path d="M3 16.75L12 21.5l9-4.75" />
    </IconFrame>
  );
}

/**
 * Chart icon — statistics / usage metrics.
 *
 * @param props - Icon props
 * @param props.size - Rendered width/height in px
 * @param props.className - Additional CSS classes
 * @returns The chart SVG element
 */
export function ChartIcon({ size, className }: IconProps) {
  return (
    <IconFrame size={size} className={className}>
      <path d="M4 3.5v16.5h16.5" />
      <path d="M8 20v-5.5" />
      <path d="M12.5 20v-9" />
      <path d="M17 20v-3.5" />
    </IconFrame>
  );
}

/**
 * Menu icon — navigation drawer trigger.
 *
 * @param props - Icon props
 * @param props.size - Rendered width/height in px
 * @param props.className - Additional CSS classes
 * @returns The menu SVG element
 */
export function MenuIcon({ size, className }: IconProps) {
  return (
    <IconFrame size={size} className={className}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </IconFrame>
  );
}

/**
 * More icon — horizontal ellipsis for overflow / header menus.
 *
 * @param props - Icon props
 * @param props.size - Rendered width/height in px
 * @param props.className - Additional CSS classes
 * @returns The ellipsis SVG element
 */
export function MoreIcon({ size, className }: IconProps) {
  return (
    <IconFrame size={size} className={className}>
      <path d="M6 12h.01" />
      <path d="M12 12h.01" />
      <path d="M18 12h.01" />
    </IconFrame>
  );
}

/**
 * Download icon — export / save a copy.
 *
 * @param props - Icon props
 * @param props.size - Rendered width/height in px
 * @param props.className - Additional CSS classes
 * @returns The download SVG element
 */
export function DownloadIcon({ size, className }: IconProps) {
  return (
    <IconFrame size={size} className={className}>
      <path d="M12 3.5v11" />
      <path d="M7.5 10.5L12 15l4.5-4.5" />
      <path d="M4.5 19.5h15" />
    </IconFrame>
  );
}

/**
 * Signal icon — telemetry / anonymous usage reporting.
 *
 * @param props - Icon props
 * @param props.size - Rendered width/height in px
 * @param props.className - Additional CSS classes
 * @returns The signal SVG element
 */
export function SignalIcon({ size, className }: IconProps) {
  return (
    <IconFrame size={size} className={className}>
      <path d="M12 20v.01" />
      <path d="M8.5 16.5a5 5 0 0 1 7 0" />
      <path d="M5.5 13.5a9 9 0 0 1 13 0" />
      <path d="M2.5 10.5a13 13 0 0 1 19 0" />
    </IconFrame>
  );
}

/**
 * Key icon — API key / credential actions.
 *
 * @param props - Icon props
 * @param props.size - Rendered width/height in px
 * @param props.className - Additional CSS classes
 * @returns The key SVG element
 */
export function KeyIcon({ size, className }: IconProps) {
  return (
    <IconFrame size={size} className={className}>
      <circle cx="8" cy="15.5" r="3.25" />
      <path d="M10.4 13.3L19.5 4.5" />
      <path d="M16.5 7.5l2.25 2.25" />
      <path d="M19 5l2 2" />
    </IconFrame>
  );
}

/**
 * Sliders icon — settings / configuration.
 *
 * @param props - Icon props
 * @param props.size - Rendered width/height in px
 * @param props.className - Additional CSS classes
 * @returns The sliders SVG element
 */
export function SlidersIcon({ size, className }: IconProps) {
  return (
    <IconFrame size={size} className={className}>
      <path d="M4 8h10" />
      <path d="M18 8h2" />
      <path d="M4 16h4" />
      <path d="M12 16h8" />
      <circle cx="16" cy="8" r="2" />
      <circle cx="10" cy="16" r="2" />
    </IconFrame>
  );
}
