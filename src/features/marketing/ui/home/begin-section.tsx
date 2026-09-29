"use client";

import { Fragment, useRef } from "react";
import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { useInView } from "@/shared/ui/motion/reveal";
import { PrimaryAction } from "./primary-action";

const HEADING = ["Walk", "in", "ready."];

/**
 * The closing ask ends on the films' last line. The words rise one after
 * another as it arrives, then the line and the action follow. Plain white, like the films above it.
 */
export function Begin() {
  const ref = useRef<HTMLDivElement>(null);
  const shown = useInView(ref);

  return (
    <section
      id="flow"
      className="marketing-deferred-section marketing-theme-section relative z-10 px-5 pb-28 pt-16 sm:px-10 sm:pb-40 sm:pt-24"
    >
      <div
        ref={ref}
        data-shown={shown}
        className="begin-stage mx-auto flex w-full max-w-[52rem] flex-col items-center text-center"
      >
        <h2 className="begin-title wordmark text-cream" aria-label={HEADING.join(" ")}>
          {HEADING.map((word, index) => (
            <Fragment key={word}>
              {index > 0 ? " " : null}
              <span className="begin-word-mask" aria-hidden="true">
                <span className="begin-word" style={{ "--i": index } as CSSProperties}>
                  {word}
                </span>
              </span>
            </Fragment>
          ))}
        </h2>

        <p
          className="begin-after marketing-lede mx-auto mt-8 max-w-[34rem] text-cream/66 sm:mt-10"
          style={{ "--i": 4 } as CSSProperties}
        >
          Pick a teacher, add your resume, and start your first round. Free to use.
        </p>

        <div className="begin-after mt-9 sm:mt-11" style={{ "--i": 5 } as CSSProperties}>
          <PrimaryAction className="glass-cta inline-flex min-h-[3.5rem] items-center gap-3 rounded-full px-8 text-base font-semibold">
            Start free
            <ArrowRight size={18} aria-hidden="true" />
          </PrimaryAction>
        </div>
      </div>
    </section>
  );
}
