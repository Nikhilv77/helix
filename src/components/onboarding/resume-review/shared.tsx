"use client";

import { useEffect, useState } from "react";

export const IDENTITY_SUMMARY_MS = 3200;
export const IDENTITY_FINAL_MS = 7600;
export const IDENTITY_PROGRESS_DELAY_MS = 1450;
export const IDENTITY_PROGRESS_DURATION_MS = 4300;
export const IDENTITY_CONTINUE_MS =
  IDENTITY_FINAL_MS + IDENTITY_PROGRESS_DELAY_MS + IDENTITY_PROGRESS_DURATION_MS + 300;
export const TRAIL_WORD_STAGGER_MS = 180;
export const TRAIL_SKILL_STAGGER_MS = 150;
export const TRAIL_FOCUS_STAGGER_MS = 280;
export const AUTO_SCROLL_IDLE_MS = 2000;
export const FINAL_AUTO_SCROLL_DELAY_MS = 180;
export const IDENTITY_DETAIL_WAVE = [34, 58, 82, 48, 92, 56, 78, 44, 64];

export function useWordReveal(text: string, active: boolean, delay = 0, stagger = TRAIL_WORD_STAGGER_MS) {
  const words = text.split(" ");
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(0);
    if (!active) return;

    let interval = 0;
    const timer = window.setTimeout(() => {
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
  }, [active, delay, stagger, words.length]);

  return {
    words,
    visibleCount,
    done: active && visibleCount >= words.length
  };
}

export function WordRevealLine({
  words,
  visibleCount,
  className
}: {
  words: string[];
  visibleCount: number;
  className: string;
}) {
  return (
    <span className={className}>
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          className={[
            "trail-word mr-[0.24em] last:mr-0",
            index < visibleCount ? "trail-word-visible" : ""
          ].join(" ")}
        >
          {word}
        </span>
      ))}
    </span>
  );
}


