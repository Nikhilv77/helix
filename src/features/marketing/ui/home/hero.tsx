"use client";

import { Fragment, useRef } from "react";
import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { Reveal, useScrollProgress } from "@/shared/ui/motion/reveal";
import { PrimaryAction } from "./primary-action";
import { ProductFilm } from "./product-film";

const HEADING = "Learn, practise, and interview on the work you’ve actually done.";
const WORDS = HEADING.split(" ");

/**
 * The film is the hero, with one short line and the actions under it. The
 * hero is sticky: as you scroll it shrinks and fades while the second film
 * slides up over it.
 */
export function Hero() {
  const parallaxRef = useRef<HTMLDivElement>(null);
  useScrollProgress(parallaxRef);

  return (
    <section
      id="learn"
      className="marketing-theme-hero sticky top-0 z-0 flex flex-col justify-center overflow-hidden px-4 pb-10 pt-24 sm:px-10 sm:pb-12 sm:pt-24"
    >
      <div ref={parallaxRef} className="hero-parallax">
        <div
          className="stagger-fade relative z-10"
          data-phase="in"
          style={{ "--n": 0 } as CSSProperties}
        >
          <ProductFilm
            src="/videos/marketing/trailgrad-demo.mp4?v=4"
            mobileSrc="/videos/marketing/trailgrad-demo-mobile.mp4?v=2"
            poster="/videos/marketing/trailgrad-demo-poster.jpg?v=4"
            label="Trailgrad product film"
            description="A short silent film. Headlines say: your next interview, practised before it happens, built from your resume. Teachers Maya, Daniel, Olivia, Ryan, and Claire each appear with a line about how they teach, then: pick the teacher you learn best with. A follow-up question asks what happens to sign-in when Redis drops at peak. An answer is typed out, a score of 8 out of 10 appears with the note: now show how you measured it. Then DSA, system design, behavioural, and Resume Roast flash by, ending on: walk in ready."
            coveredAfterScroll={0.75}
          />
        </div>

        <div className="relative z-10 mx-auto mt-8 flex w-full max-w-[44rem] flex-col items-center text-center sm:mt-10">
          <h1
            className="stagger-line text-balance text-[1.6rem] font-semibold leading-tight tracking-[-0.03em] text-cream sm:text-[2.1rem]"
            data-phase="in"
            aria-label={HEADING}
          >
            {WORDS.map((word, index) => (
              <Fragment key={`${word}-${index}`}>
                {index > 0 ? " " : null}
                <span
                  aria-hidden="true"
                  className="stagger-word"
                  style={{ "--i": index + 3 } as CSSProperties}
                >
                  {word}
                </span>
              </Fragment>
            ))}
          </h1>

          <Reveal delay={720}>
            <div className="mt-7 flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
              <PrimaryAction className="glass-cta inline-flex min-h-[3.25rem] items-center gap-3 rounded-full px-7 text-[0.9375rem] font-semibold sm:text-base">
                Start free
                <ArrowRight size={18} aria-hidden="true" />
              </PrimaryAction>
              <a
                href="#interview"
                className="rounded-full px-2 py-1 text-[0.9375rem] font-medium text-cream/72 underline decoration-cream/25 underline-offset-[6px] outline-none transition-colors hover:text-cream hover:decoration-cream/60 focus-visible:ring-2 focus-visible:ring-cream/40"
              >
                See a round
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
