import type { AriaRole } from "react";
import { IconButton, MoonIcon, SparkleIcon, SunIcon } from "../ui";
import { useTheme } from "../../contexts/ThemeContext";
import type { Theme } from "../../contexts/ThemeContext";

/** Human-readable label for each theme, shown next to the icon in menus. */
const THEME_LABEL: Record<Theme, string> = {
  dark: "Dark",
  light: "Light",
  elevenlabs: "Studio",
};

interface ThemeToggleProps {
  /** Optional role forwarded to the native button (e.g. `menuitem` in a menu). */
  role?: AriaRole;
  /** Additional CSS classes merged onto the control. */
  className?: string;
  /** Renders the current theme name next to the icon. */
  showLabel?: boolean;
}

/**
 * Button cycling through light, dark, and elevenlabs themes.
 *
 * The selected theme is owned by `ThemeProvider`, which applies it at startup
 * even before the overflow menu mounts. This control only renders and cycles it.
 *
 * @param props - Component props
 * @param props.role - Optional role for the native button
 * @param props.className - Additional CSS classes
 * @param props.showLabel - Whether to render the theme name next to the icon
 * @returns The rendered theme toggle button
 */
export function ThemeToggle({ role, className = "", showLabel = false }: ThemeToggleProps = {}) {
  const { theme, cycleTheme } = useTheme();

  return (
    <IconButton
      ariaLabel={`Current theme: ${theme}`}
      className={`theme-toggle ${className}`.trim()}
      role={role}
      size="sm"
      onClick={cycleTheme}
    >
      {theme === "dark" && <MoonIcon size={18} />}
      {theme === "light" && <SunIcon size={18} />}
      {theme === "elevenlabs" && <SparkleIcon size={18} />}
      {showLabel && <span className="theme-toggle__label">Theme: {THEME_LABEL[theme]}</span>}
    </IconButton>
  );
}
