"use client";

import { Fragment, useRef } from "react";
import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { Reveal, useRotator, useScrollProgress } from "./visuals/reveal";
import { PrimaryAction } from "./primary-action";

/**
 * Three claims in the order a candidate actually meets the product: what it is
 * built from, what practice feels like, what you walk out with.
 *
 * The first one is the page's real headline — it ships in the markup as the h1
 * and never changes, so the accessible name and the indexed text stay fixed
 * while the visible copy rotates. Everything below the h1 is decoration.
 */
const pitches = [
  {
    heading: "Coding interview prep, built around you.",
    sub: "Upload your resume once. Your tutor turns your experience into realistic questions, useful follow-ups, and a clear plan for what to work on next."
  },
  {
    heading: "Practice the way real interviews feel.",
    sub: "Talk through your thinking, handle follow-ups, and learn how to make a clear answer under pressure."
  },
  {
    heading: "Walk in ready to explain your work.",
    sub: "Get a simple recap after every round, plus one focused thing to improve before next time."
  }
] as const;

/** Steady time on screen once the last word has settled, then the way out. */
const HOLD_MS = 3600;
const EXIT_MS = 1050;

export function Hero() {
  const parallaxRef = useRef<HTMLDivElement>(null);
  const { index, phase } = useRotator({
    length: pitches.length,
    holdMs: HOLD_MS,
    exitMs: EXIT_MS
  });

  // Drives `--p` for the parallax fade. The hero is sticky, so the section
  // below scrolls over this one rather than pushing it.
  useScrollProgress(parallaxRef);

  return (
    <section
      id="learn"
      className="marketing-theme-hero sticky top-0 z-0 h-[100svh] min-h-[36rem] overflow-hidden px-5 pb-[20vh] pt-24 sm:px-10"
    >
      <div
        ref={parallaxRef}
        className="hero-parallax relative z-10 mx-auto flex h-full w-full max-w-[48rem] flex-col items-center justify-center text-center"
      >
        <h1 className="sr-only">{pitches[0].heading}</h1>

        {/*
         * Every pitch stays mounted in the same grid cell, so the cell is as
         * tall as the longest one and the button underneath never moves when
         * the copy swaps. The inactive ones use `invisible` rather than
         * `hidden` for exactly that reason.
         */}
        <div aria-hidden="true" className="grid w-full">
          {pitches.map((pitch, pitchIndex) => {
            const active = pitchIndex === index;
            const words = pitch.heading.split(" ");

            return (
              <div
                key={pitch.heading}
                className={[
                  "col-start-1 row-start-1 flex flex-col items-center",
                  active ? "" : "invisible"
                ].join(" ")}
              >
                <p
                  className="stagger-line wordmark text-cream"
                  data-phase={active ? phase : undefined}
                  style={{ fontSize: "clamp(2.2rem, 4.8vw, 3.8rem)", letterSpacing: "-0.035em" }}
                >
                  {words.map((word, wordIndex) => (
                    <Fragment key={`${word}-${wordIndex}`}>
                      {wordIndex > 0 ? " " : null}
                      <span className="stagger-word" style={{ "--i": wordIndex } as CSSProperties}>
                        {word}
                      </span>
                    </Fragment>
                  ))}
                </p>

                <p
                  className="stagger-fade mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-cream/80 sm:text-xl"
                  data-phase={active ? phase : undefined}
                  style={{ "--n": words.length } as CSSProperties}
                >
                  {pitch.sub}
                </p>
              </div>
            );
          })}
        </div>

        <Reveal delay={620}>
          <PrimaryAction className="glass-cta mt-11 inline-flex min-h-12 items-center gap-3 rounded-xl px-7 text-sm font-semibold sm:text-base">
            Get started
            <ArrowRight size={18} aria-hidden="true" />
          </PrimaryAction>
        </Reveal>
      </div>
    </section>
  );
}
