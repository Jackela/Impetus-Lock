import { useState, useEffect } from "react";

/** Supported application color theme names. */
export type Theme = "light" | "dark" | "elevenlabs";

const THEME_KEY = "impetus-theme";

/**
 * Button cycling through light, dark, and elevenlabs themes.
 *
 * Persists the choice to localStorage and applies it to the document root.
 *
 * @returns The rendered theme toggle button
 */
export function ThemeToggle() {
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
    <button onClick={cycleTheme} className="theme-toggle" aria-label={`Current theme: ${theme}`}>
      {theme === "dark" && "🌙"}
      {theme === "light" && "☀️"}
      {theme === "elevenlabs" && "✨"}
    </button>
  );
}
