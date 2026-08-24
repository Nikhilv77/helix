"use client";

import { Check } from "lucide-react";
import type { CSSProperties } from "react";
import { levels } from "../flow/onboarding-data";
import type { Level } from "@/lib/shared/types";

const headingWords = ["Where", "are", "you", "starting", "from?"];

const levelCopy: Record<Level, { word: string; line: string }> = {
  fresher: {
    word: "Start",
    line: "You are building proof, language, and interview rhythm."
  },
  "0-2": {
    word: "Grow",
    line: "You have shipped some work and need sharper stories around it."
  },
  "3-5": {
    word: "Own",
    line: "You have real scope, tradeoffs, and decisions to defend."
  },
  "5-plus": {
    word: "Lead",
    line: "You need to show judgment, leverage, and systems-level thinking."
  }
};

function TypingText({
  text,
  delay,
  duration,
  className
}: {
  text: string;
  delay: number;
  duration: number;
  className?: string;
}) {
  return (
    <span className={["grid", className ?? ""].join(" ").trim()} aria-label={text}>
      <span aria-hidden="true" className="invisible col-start-1 row-start-1">
        {text}
      </span>
      <span
        aria-hidden="true"
        className="onboarding-type-visible col-start-1 row-start-1"
        style={
          {
            "--type-delay": `${delay}ms`,
            "--type-duration": `${duration}ms`
          } as CSSProperties
        }
      >
        {text}
      </span>
    </span>
  );
}

export function LevelStep({
  selected,
  onSelect
}: {
  selected: Level | null;
  onSelect: (level: Level) => void;
}) {
  return (
    <>
      <div className="text-center">
        <h1
          className="display-heading mx-auto flex max-w-4xl flex-wrap justify-center gap-x-3 gap-y-1 text-cream sm:gap-x-4"
          style={{ fontSize: "clamp(2.15rem, 4.8vw, 3.8rem)" }}
          aria-label="Where are you starting from?"
        >
          {headingWords.map((word, index) => (
            <span
              key={`${word}-${index}`}
              aria-hidden="true"
              className="onboarding-word"
              style={{ "--word-delay": `${index * 85}ms` } as CSSProperties}
            >
              {word}
            </span>
          ))}
        </h1>
      </div>

      <div className="mx-auto mt-10 grid w-full max-w-4xl gap-3.5">
        {levels.map((option, index) => {
          const active = selected === option.value;
          const copy = levelCopy[option.value];
          const baseDelay = 680 + index * 155;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(option.value)}
              className={[
                "onboarding-card-reveal",
                "group relative min-h-[6.4rem] overflow-hidden rounded-[1.45rem] border p-5 text-left outline-none transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-[#F26E01]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101113] sm:p-6",
                active
                  ? "border-[#F26E01]/32 bg-[linear-gradient(145deg,#1d1e22,#18191c)] shadow-[0_22px_64px_-48px_rgba(242,110,1,0.25)]"
                  : "border-white/12 bg-[linear-gradient(145deg,#1b1c20,#16171a)] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] hover:border-white/22 hover:bg-[#1d1e22]"
              ].join(" ")}
              style={
                {
                  "--card-delay": `${360 + index * 115}ms`
                } as CSSProperties
              }
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#F26E01]/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              />

              <span className="relative flex min-h-full items-center justify-between gap-6">
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-cream/58">
                    {option.label}
                  </span>
                  <TypingText
                    text={copy.word}
                    delay={baseDelay}
                    duration={560}
                    className="mt-1.5 text-[2rem] font-bold leading-none text-cream sm:text-[2.45rem]"
                  />
                  <TypingText
                    text={copy.line}
                    delay={baseDelay + 430}
                    duration={1250}
                    className="mt-2.5 max-w-2xl text-[14.5px] leading-6 text-cream/72 sm:text-[15px]"
                  />
                </span>

                <span className="hidden shrink-0 text-right sm:block">
                  <span className="text-[13px] font-medium text-cream/52">
                    {option.detail}
                  </span>
                </span>
              </span>

              <span
                aria-hidden="true"
                className={[
                  "absolute right-5 top-5 grid h-7 w-7 place-items-center rounded-full border transition",
                  active
                    ? "onboarding-accent-fill border-[#F26E01]/45 text-[#17181b]"
                    : "border-white/25"
                ].join(" ")}
              >
                {active ? <Check size={15} strokeWidth={3} /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
