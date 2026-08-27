"use client";

import { useEffect, useRef, useState } from "react";
import { Reveal } from "./visuals/reveal";

const helpSteps = [
  {
    number: "01",
    title: "You hit a wall. That’s where we start.",
    body: "Tell your tutor what you tried and where it stopped making sense. They meet you at the exact point you’re stuck."
  },
  {
    number: "02",
    title: "Get just enough help to move.",
    body: "Start with one precise hint, then take another shot while the idea is still yours."
  },
  {
    number: "03",
    title: "See the whole idea, not just the answer.",
    body: "When a hint isn’t enough, walk through the reasoning, trade-offs, and edge cases behind a solution."
  },
  {
    number: "04",
    title: "Talk it through with someone who gets it.",
    body: "Connect with a peer who has solved it before and learn together, without having to figure it all out alone."
  }
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function Stuck() {
  const sectionRef = useRef<HTMLElement>(null);
  const frameRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function updateProgress() {
      if (frameRef.current !== null) return;

      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        const section = sectionRef.current;
        if (!section) return;

        const rect = section.getBoundingClientRect();
        const travel = Math.max(1, rect.height - window.innerHeight);
        const next = clamp(-rect.top / travel, 0, 1);

        setProgress((current) => (Math.abs(current - next) > 0.004 ? next : current));
      });
    }

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);

    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  // Snap the copy to clear scroll zones. This also makes the final message
  // reachable before the very last pixel of the section.
  const activeStep = Math.min(helpSteps.length - 1, Math.round(progress * (helpSteps.length - 1)));

  return (
    <section
      ref={sectionRef}
      id="help"
      className="marketing-theme-section relative z-10 min-h-[185vh] px-5 sm:min-h-[170vh] sm:px-10"
    >
      <div className="sticky top-0 flex min-h-screen items-start pb-20 pt-28 sm:pb-24 sm:pt-36">
        <div className="mx-auto w-full max-w-[58rem]">
          <Reveal delay={80}>
            <div className="max-w-3xl">
              <h2
                className="display-heading help-heading max-w-3xl text-center text-cream"
                style={{ fontSize: "clamp(2rem, 4.4vw, 3.6rem)" }}
              >
                You&rsquo;re never completely stuck.
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-center text-lg leading-relaxed text-cream/70">
                Get a quick answer first. When you want a person, we connect you with someone who
                has already solved it.
              </p>
            </div>
          </Reveal>

          <Reveal delay={180} className="mt-16 sm:mt-24">
            <div aria-live="polite" className="relative min-h-[13rem] sm:min-h-[11rem]">
              {helpSteps.map((step, index) => {
                const isActive = index === activeStep;

                return (
                  <div
                    key={step.number}
                    aria-hidden={!isActive}
                    className={[
                      "absolute inset-0 max-w-3xl transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
                      isActive
                        ? "translate-y-0 opacity-100 blur-0"
                        : index < activeStep
                          ? "pointer-events-none -translate-y-8 opacity-0 blur-[6px]"
                          : "pointer-events-none translate-y-8 opacity-0 blur-[6px]"
                    ].join(" ")}
                  >
                    <p className="max-w-3xl text-2xl font-medium leading-[1.12] tracking-[-0.025em] text-cream sm:text-4xl">
                      <span>{step.title}</span> <span className="text-cream/58">{step.body}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
