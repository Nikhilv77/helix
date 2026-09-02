"use client";

import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import { Reveal, useViewportPresence } from "./visuals/reveal";
import { PrimaryAction } from "./primary-action";

/**
 * The closing ask, built to rhyme with the hero — same wordmark scale, same
 * glass CTA, same ember. The one difference is the light: it rises out of the
 * bottom at the top of the page and comes down from above at the end of it.
 */
export function Begin() {
  const sectionRef = useRef<HTMLElement>(null);
  const present = useViewportPresence(sectionRef);

  return (
    <section
      ref={sectionRef}
      id="flow"
      data-running={present}
      className="marketing-deferred-section marketing-theme-section relative z-10 overflow-hidden px-5 pb-24 pt-28 sm:px-10 sm:pb-36 sm:pt-40"
    >
      <span aria-hidden="true" className="begin-ember" />

      <div className="relative z-10 mx-auto flex w-full max-w-[46rem] flex-col items-center text-center">
        <Reveal>
          <h2 className="marketing-closing-title wordmark text-cream">
            Feel ready for the conversation.
          </h2>
        </Reveal>

        <Reveal delay={110}>
          <p className="marketing-lede mx-auto mt-6 max-w-2xl text-cream/76 sm:mt-7">
            Bring your experience, practise the story, and start your next conversation with a plan.
          </p>
        </Reveal>

        <Reveal delay={220}>
          <PrimaryAction className="glass-cta mt-9 inline-flex min-h-[3.25rem] items-center gap-3 rounded-xl px-7 text-[0.9375rem] font-semibold sm:mt-11 sm:text-base">
            Start free
            <ArrowRight size={18} aria-hidden="true" />
          </PrimaryAction>
        </Reveal>
      </div>
    </section>
  );
}
