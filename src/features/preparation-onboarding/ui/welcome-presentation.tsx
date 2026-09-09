"use client";

import { useEffect, useState } from "react";
import { welcomePerformanceProfile, type WelcomePerformanceProfile } from "./welcome-performance";

export const WELCOME_TITLE_STAGGER_MS = 92;
export const WELCOME_BODY_STAGGER_MS = 26;

export function useWordReveal(
  text: string,
  active: boolean,
  delay = 0,
  stagger = WELCOME_TITLE_STAGGER_MS
) {
  const words = text.split(" ");
  const [visibleCount, setVisibleCount] = useState(0);
  useEffect(() => {
    setVisibleCount(0);
    if (!active) return;
    let interval = 0;
    const timer = window.setTimeout(() => {
      if (stagger <= 0) return setVisibleCount(words.length);
      let index = 0;
      interval = window.setInterval(() => {
        index += 1;
        setVisibleCount(Math.min(index, words.length));
        if (index >= words.length) window.clearInterval(interval);
      }, stagger);
    }, delay);
    return () => {
      window.clearTimeout(timer);
      if (interval) window.clearInterval(interval);
    };
  }, [active, delay, stagger, text, words.length]);
  return { words, visibleCount };
}

export function WordRevealLine({
  words,
  visibleCount,
  className,
  wordClassName = ""
}: {
  words: string[];
  visibleCount: number;
  className?: string;
  wordClassName?: string;
}) {
  return (
    <span className={className}>
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          className={[
            "trail-word mr-[0.24em] last:mr-0",
            index < visibleCount ? "trail-word-visible" : "",
            wordClassName
          ].join(" ")}
        >
          {word}
        </span>
      ))}
    </span>
  );
}

export function readWelcomePerformanceProfile(): WelcomePerformanceProfile {
  const device = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  return welcomePerformanceProfile({
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
    deviceMemory: device.deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
    saveData: device.connection?.saveData
  });
}
