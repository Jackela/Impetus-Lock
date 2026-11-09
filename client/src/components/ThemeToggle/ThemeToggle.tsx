import { useState, useEffect } from "react";
import type { AriaRole } from "react";
import { IconButton, MoonIcon, SparkleIcon, SunIcon } from "../ui";

/** Supported application color theme names. */
export type Theme = "light" | "dark" | "elevenlabs";

/** Human-readable label for each theme, shown next to the icon in menus. */
const THEME_LABEL: Record<Theme, string> = {
  dark: "Dark",
  light: "Light",
  elevenlabs: "Studio",
};

const THEME_KEY = "impetus-theme";

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
 * Persists the choice to localStorage and applies it to the document root.
 * Rendered with the shared `IconButton` primitive so focus, hover, and touch
 * sizing come from the design system.
 *
 * @param props - Component props
 * @param props.role - Optional role for the native button
 * @param props.className - Additional CSS classes
 * @param props.showLabel - Whether to render the theme name next to the icon
 * @returns The rendered theme toggle button
 */
export function ThemeToggle({ role, className = "", showLabel = false }: ThemeToggleProps = {}) {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem(THEME_KEY) as Theme) || "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const cycleTheme = () => {
    setTheme((prev) => {
      if (prev === "dark") return "light";
      if (prev === "light") return "elevenlabs";
      return "dark";
    });
  };

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
