"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { hasSavedThemePreference, useTheme } from "@/lib/theme/theme-context";

type HomeAmbience = "night" | "dusk" | "day" | "settled";

/** Time the night hero holds before the page brightens. */
const NIGHT_HOLD_MS = 600;

/**
 * Gives a first-time visitor's home page a one-time night-to-day entrance that
 * ends in the light theme. The light theme is shown, not saved, so it never
 * overrides a choice the visitor makes with the theme toggle.
 *
 * Order matters for a smooth fade: the night overlay goes up while the page is
 * still dark (no visible change), the theme switches to light underneath it
 * only after that frame is painted, and the overlay starts fading a frame later.
 */
export function HomeThemeArrival({ children }: { children: ReactNode }) {
  const { previewTheme } = useTheme();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [ambience, setAmbience] = useState<HomeAmbience>("night");

  useEffect(() => {
    // A theme the visitor picked themselves always wins, with no entrance.
    if (hasSavedThemePreference()) {
      setAmbience("settled");
      return;
    }

    // Deferred one tick so the theme provider has applied its startup theme
    // first; otherwise it would put the page back to dark.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const immediate = window.setTimeout(() => {
        previewTheme("light");
        setAmbience("settled");
      }, 0);
      return () => window.clearTimeout(immediate);
    }

    const timer = window.setTimeout(() => setAmbience("dusk"), NIGHT_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [previewTheme]);

  useEffect(() => {
    if (ambience !== "dusk") return;
    let second = 0;
    // The overlay is committed; wait for it to paint before switching themes.
    const first = window.requestAnimationFrame(() => {
      previewTheme("light");
      // Flush the light styles under the still-opaque overlay, then fade.
      wrapperRef.current?.getBoundingClientRect();
      second = window.requestAnimationFrame(() => setAmbience("day"));
    });
    return () => {
      window.cancelAnimationFrame(first);
      window.cancelAnimationFrame(second);
    };
  }, [ambience, previewTheme]);

  return (
    <div ref={wrapperRef} className="home-theme-arrival" data-home-ambience={ambience}>
      {children}
    </div>
  );
}
