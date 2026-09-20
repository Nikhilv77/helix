"use client";

import { useEffect, useState, type ReactNode } from "react";

type HomeAmbience = "dawn" | "night" | "settled";

const DAWN_HOLD_MS = 300;

/**
 * Gives the signed-out home hero a one-time daylight-to-night entrance without
 * changing the application theme or the visitor's saved preference.
 */
export function HomeThemeArrival({ children }: { children: ReactNode }) {
  const [ambience, setAmbience] = useState<HomeAmbience>("dawn");

  useEffect(() => {
    // An explicit light preference wins. The entrance is only a visual lead-in
    // to the default dark landing experience, never a global theme mutation.
    if (document.documentElement.dataset.theme === "light") {
      setAmbience("settled");
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setAmbience("night");
      return;
    }

    const timer = window.setTimeout(() => setAmbience("night"), DAWN_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="home-theme-arrival" data-home-ambience={ambience}>
      {children}
    </div>
  );
}
