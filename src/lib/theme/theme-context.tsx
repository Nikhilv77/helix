"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  /**
   * Holds the page in one theme without touching the saved choice, e.g. the
   * always-light marketing pages. Pass null to go back to the saved theme.
   */
  lockTheme: (theme: ResolvedTheme | null) => void;
}

const THEME_STORAGE_KEY = "trailgrad-theme";

/** Set on <html> by pages that render in a fixed theme; see `lockTheme`. */
export const THEME_LOCK_ATTRIBUTE = "data-theme-lock";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeScript() {
  const scriptContent = `
(function() {
  try {
    var stored = localStorage.getItem("${THEME_STORAGE_KEY}");
    // Visitors who have never picked a theme start in light.
    var theme = stored || "light";
    var resolved = theme === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme;
    var d = document.documentElement;
    // Public marketing pages are always light. "/" is public only when signed
    // out; Clerk's readable __client_uat cookie is 0 or missing then. Locking
    // here, before first paint, also lets CSS hide the app's loading skeleton.
    var path = location.pathname;
    var signedIn = /(?:^|; )__client_uat(?:_[^=]*)?=[1-9]/.test(document.cookie);
    if (/^\\/(blog|privacy|terms)(\\/|$)/.test(path) || (path === "/" && !signedIn)) {
      resolved = "light";
      d.setAttribute("${THEME_LOCK_ATTRIBUTE}", "light");
    }
    d.classList.remove("light", "dark");
    d.classList.add(resolved);
    d.setAttribute("data-theme", resolved);
  } catch (e) {}
})();
`;

  return <script id="trailgrad-theme-script" dangerouslySetInnerHTML={{ __html: scriptContent }} />;
}

export function ThemeProvider({
  children,
  defaultTheme = "light"
}: {
  children: ReactNode;
  defaultTheme?: Theme;
}) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const [mounted, setMounted] = useState(false);
  const lockRef = useRef<ResolvedTheme | null>(null);
  const themeRef = useRef<Theme>(defaultTheme);
  themeRef.current = theme;

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      const initialTheme = stored || defaultTheme;
      setThemeState(initialTheme);

      // A locked page's inline script already set <html>; keep it that way.
      const locked = document.documentElement.getAttribute(THEME_LOCK_ATTRIBUTE);
      if (locked === "light" || locked === "dark") lockRef.current = locked;

      const resolved =
        lockRef.current ?? (initialTheme === "system" ? getSystemTheme() : initialTheme);
      setResolvedTheme(resolved);

      const root = document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(resolved);
      root.setAttribute("data-theme", resolved);
    } catch {
      // Fallback if localStorage is inaccessible
    }
    setMounted(true);
  }, [defaultTheme]);

  // Update DOM when theme changes
  const applyTheme = useCallback((newTheme: Theme) => {
    const resolved = lockRef.current ?? (newTheme === "system" ? getSystemTheme() : newTheme);
    setResolvedTheme(resolved);

    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolved);
    root.setAttribute("data-theme", resolved);
  }, []);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      } catch {
        // Storage full or private mode
      }
      applyTheme(newTheme);
    },
    [applyTheme]
  );

  const lockTheme = useCallback(
    (locked: ResolvedTheme | null) => {
      lockRef.current = locked;
      const root = document.documentElement;
      if (locked) root.setAttribute(THEME_LOCK_ATTRIBUTE, locked);
      else root.removeAttribute(THEME_LOCK_ATTRIBUTE);
      applyTheme(themeRef.current);
    },
    [applyTheme]
  );

  const toggleTheme = useCallback(() => {
    const nextTheme: Theme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  }, [resolvedTheme, setTheme]);

  // Listen for system theme changes if system theme is active
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [theme, applyTheme]);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme: mounted ? resolvedTheme : "light",
      setTheme,
      toggleTheme,
      lockTheme
    }),
    [theme, resolvedTheme, mounted, setTheme, toggleTheme, lockTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

const DEFAULT_THEME_CONTEXT: ThemeContextValue = {
  theme: "light",
  resolvedTheme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
  lockTheme: () => {}
};

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    return DEFAULT_THEME_CONTEXT;
  }
  return context;
}
