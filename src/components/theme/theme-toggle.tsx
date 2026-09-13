"use client";

import { useTheme } from "@/lib/theme/theme-context";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle({ className = "", size = 18 }: { className?: string; size?: number }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Toggle theme"
        disabled
        className={[
          "inline-flex h-9 w-9 items-center justify-center rounded-xl text-cream/70 transition opacity-0",
          className
        ].join(" ")}
      >
        <span className="sr-only">Toggle theme</span>
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={[
        "relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-cream/20 bg-transparent text-cream/75 outline-none transition-[border-color,color,transform] duration-300 hover:scale-[1.04] hover:border-cream/35 hover:bg-cream/[0.035] hover:text-cream focus-visible:ring-2 focus-visible:ring-cream/40",
        className
      ].join(" ")}
    >
      {isDark ? (
        <Sun key="sun" size={size} className="theme-toggle-icon" />
      ) : (
        <Moon key="moon" size={size} className="theme-toggle-icon" />
      )}
      <span className="sr-only">{isDark ? "Switch to light theme" : "Switch to dark theme"}</span>
    </button>
  );
}
