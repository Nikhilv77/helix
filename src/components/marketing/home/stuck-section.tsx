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
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    let nearby = false;

    function updateProgress() {
      if (!nearby || frameRef.current !== null) return;

      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        const section = sectionRef.current;
        if (!section) return;

        const rect = section.getBoundingClientRect();
        const travel = Math.max(1, rect.height - window.innerHeight);
        const progress = clamp(-rect.top / travel, 0, 1);
        const nextStep = Math.min(
          helpSteps.length - 1,
          Math.round(progress * (helpSteps.length - 1))
        );

        // Four state changes across the whole scene instead of a React render
        // on almost every scroll frame. This is especially noticeable on
        // mobile while the browser chrome is also resizing the viewport.
        setActiveStep((current) => (current === nextStep ? current : nextStep));
      });
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        nearby = Boolean(entry?.isIntersecting);
        if (nearby) updateProgress();
      },
      { rootMargin: "100% 0px", threshold: 0 }
    );

    const section = sectionRef.current;
    if (section) observer.observe(section);
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="help"
      className="marketing-theme-section relative z-10 min-h-[190svh] px-5 sm:min-h-[170svh] sm:px-10"
    >
      <div className="sticky top-0 flex min-h-[100svh] items-start pb-8 pt-16 sm:pb-24 sm:pt-36">
        <div className="mx-auto w-full max-w-[58rem]">
          <Reveal delay={80}>
            <div className="mx-auto max-w-3xl">
              <h2 className="marketing-section-title display-heading help-heading max-w-3xl text-center text-cream">
                You&rsquo;re never completely stuck.
              </h2>
              <p className="marketing-lede mx-auto mt-5 max-w-xl text-center text-cream/68 sm:mt-6">
                Get a quick answer first. When you want a person, we connect you with someone who
                has already solved it.
              </p>
            </div>
          </Reveal>

          <Reveal delay={180} className="mt-10 sm:mt-20">
            <div aria-hidden="true" className="mb-7 grid grid-cols-4 gap-2 sm:mb-9">
              {helpSteps.map((step, index) => (
                <span
                  key={step.number}
                  className={[
                    "h-[3px] rounded-full transition-colors duration-500",
                    index <= activeStep ? "accent-rail" : "bg-white/[0.12]"
                  ].join(" ")}
                />
              ))}
            </div>

            <div aria-live="polite" className="relative min-h-[13rem] sm:min-h-[12rem]">
              {helpSteps.map((step, index) => {
                const isActive = index === activeStep;

                return (
                  <div
                    key={step.number}
                    aria-hidden={!isActive}
                    className={[
                      "absolute inset-0 max-w-3xl transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
                      isActive
                        ? "translate-y-0 opacity-100 sm:blur-0"
                        : index < activeStep
                          ? "pointer-events-none -translate-y-6 opacity-0 sm:-translate-y-8 sm:blur-[6px]"
                          : "pointer-events-none translate-y-6 opacity-0 sm:translate-y-8 sm:blur-[6px]"
                    ].join(" ")}
                  >
                    <p className="text-[1.625rem] font-semibold leading-[1.15] tracking-[-0.028em] text-cream sm:text-4xl">
                      {step.title}
                    </p>
                    <p className="mt-4 max-w-[42rem] text-[1.0625rem] leading-[1.7] text-cream/60 sm:mt-5 sm:text-lg">
                      {step.body}
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
