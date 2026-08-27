"use client";

import { ArrowRight } from "lucide-react";
import { Reveal } from "./visuals/reveal";
import { PrimaryAction } from "./primary-action";

/**
 * The closing ask, built to rhyme with the hero — same wordmark scale, same
 * glass CTA, same ember. The one difference is the light: it rises out of the
 * bottom at the top of the page and comes down from above at the end of it.
 */
export function Begin() {
  return (
    <section
      id="flow"
      className="marketing-theme-section relative z-10 overflow-hidden px-5 pb-28 pt-32 sm:px-10 sm:pb-36 sm:pt-40"
    >
      <span aria-hidden="true" className="begin-ember" />

      <div className="relative z-10 mx-auto flex w-full max-w-[46rem] flex-col items-center text-center">
        <Reveal>
          <h2
            className="wordmark text-cream"
            style={{ fontSize: "clamp(2.4rem, 6.2vw, 4.4rem)", letterSpacing: "-0.035em" }}
          >
            Feel ready for the conversation.
          </h2>
        </Reveal>

        <Reveal delay={110}>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-cream/80 sm:text-xl">
            Bring your experience, practise the story, and start your next conversation with a plan.
          </p>
        </Reveal>

        <Reveal delay={220}>
          <PrimaryAction className="glass-cta mt-11 inline-flex min-h-12 items-center gap-3 rounded-xl px-7 text-sm font-semibold sm:text-base">
            Start free
            <ArrowRight size={18} aria-hidden="true" />
          </PrimaryAction>
        </Reveal>
      </div>
    </section>
  );
}
