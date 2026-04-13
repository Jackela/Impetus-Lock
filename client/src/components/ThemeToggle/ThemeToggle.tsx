import { useState, useEffect } from "react";

export type Theme = "light" | "dark" | "elevenlabs";

const THEME_KEY = "impetus-theme";

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
