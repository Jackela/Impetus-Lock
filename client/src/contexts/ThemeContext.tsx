import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

/** Supported application color theme names. */
export type Theme = "light" | "dark" | "elevenlabs";

const THEME_KEY = "impetus-theme";

/**
 * Shared theme state exposed to every consumer.
 */
export interface ThemeContextValue {
  /** Currently selected theme. */
  theme: Theme;
  /** Advances to the next theme in the dark → light → studio cycle. */
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Reads the persisted theme, falling back to dark for unknown or unavailable
 * storage values.
 *
 * @returns The stored theme when valid, otherwise `"dark"`.
 */
function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark" || stored === "elevenlabs") return stored;
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
  return "dark";
}

/**
 * Applies the persisted theme on startup and keeps the document root and
 * localStorage in sync. Mounted above the authenticated shell so a saved
 * preference takes effect before the user opens any menu.
 *
 * @param props - Provider props
 * @param props.children - Application subtree
 * @returns The themed application subtree
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Persisting is best-effort; the in-memory theme still applies.
    }
  }, [theme]);

  const cycleTheme = useCallback(() => {
    setTheme((prev) => {
      if (prev === "dark") return "light";
      if (prev === "light") return "elevenlabs";
      return "dark";
    });
  }, []);

  const value = useMemo(() => ({ theme, cycleTheme }), [theme, cycleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Accesses the shared theme state. Must be called under `ThemeProvider`.
 *
 * @returns The current theme and the cycle action.
 */
export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used within a ThemeProvider");
  return value;
}
