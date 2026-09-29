"use client";

import { useEffect, useRef, useState } from "react";

/**
 * One heading and one line, centred. As the section scrolls up the screen the
 * pair changes from the section's promise to each step of help in order.
 */
const frames = [
  {
    title: "You’re never completely stuck.",
    body: "Help comes in the order you need it, from a single hint to a person who has already solved the problem."
  },
  {
    title: "Say where it stopped making sense.",
    body: "Tell your tutor what you tried. They start from exactly that point."
  },
  {
    title: "Get just enough to move.",
    body: "One precise hint, then another attempt while the idea is still yours."
  },
  {
    title: "See the whole idea.",
    body: "Walk through the reasoning, trade-offs, and edge cases behind a solution."
  },
  {
    title: "Work it through with a peer.",
    body: "Ask a Trailmate who has solved it before, and learn it together."
  }
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function Stuck() {
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const section = sectionRef.current;
      if (!section) return;
      // The section scrolls normally; the text changes as its centre moves from
      // 80% down the screen to 25% down it.
      const rect = section.getBoundingClientRect();
      const centre = rect.top + rect.height / 2;
      const viewport = window.innerHeight;
      const progress = clamp((viewport * 0.8 - centre) / (viewport * 0.55), 0, 0.999);
      const next = clamp(Math.floor(progress * frames.length), 0, frames.length - 1);
      setActive((current) => (current === next ? current : next));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="help"
      data-ember="left"
      className="marketing-theme-section relative z-10 px-5 py-24 sm:px-10 sm:py-32"
    >
      <div className="flex items-center justify-center">
        {/* Every frame stays in one grid cell, so the height never jumps. */}
        <div className="grid w-full max-w-3xl text-center" aria-live="polite">
          {frames.map((item, index) => {
            const state = index === active ? "on" : index < active ? "past" : "next";
            return (
              <div
                key={item.title}
                aria-hidden={state !== "on"}
                data-state={state}
                className="help-frame col-start-1 row-start-1 flex flex-col items-center"
              >
                <h2 className="marketing-section-title display-heading help-heading max-w-3xl text-center text-cream">
                  {item.title}
                </h2>
                <p className="marketing-lede mx-auto mt-5 max-w-xl text-center text-cream/68 sm:mt-6">
                  {item.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
