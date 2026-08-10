"use client";

import { Check } from "lucide-react";
import type { CSSProperties } from "react";
import { levels } from "@/components/onboarding/onboarding-data";
import { ContinueBar } from "@/components/onboarding/onboarding-ui";
import type { Level } from "@/lib/types";

const headingWords = ["Where", "are", "you", "starting", "from?"];

const levelCopy: Record<Level, { word: string; line: string; tilt: number }> = {
  fresher: {
    word: "Start",
    line: "You are building proof, language, and interview rhythm.",
    tilt: -0.7
  },
  "0-2": {
    word: "Grow",
    line: "You have shipped some work and need sharper stories around it.",
    tilt: 0.35
  },
  "3-5": {
    word: "Own",
    line: "You have real scope, tradeoffs, and decisions to defend.",
    tilt: -0.25
  },
  "5-plus": {
    word: "Lead",
    line: "You need to show judgment, leverage, and systems-level thinking.",
    tilt: 0.55
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
  onSelect,
  onContinue
}: {
  selected: Level | null;
  onSelect: (level: Level) => void;
  onContinue: () => void;
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
                "group relative min-h-[6.4rem] overflow-hidden rounded-[1.45rem] border p-5 text-left outline-none backdrop-blur-sm transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-cream/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#3657b4] sm:p-6",
                active
                  ? "border-cream/60 bg-cream/[0.065] shadow-[0_20px_58px_-44px_rgba(241,234,216,0.55)]"
                  : "border-cream/75 bg-cream/[0.035] hover:border-cream hover:bg-cream/[0.08]"
              ].join(" ")}
              style={
                {
                  "--card-delay": `${360 + index * 115}ms`,
                  "--card-tilt": `${copy.tilt}deg`
                } as CSSProperties
              }
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(241,234,216,0.08)_1px,transparent_1px)] bg-[length:5.5rem_100%] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
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
                    ? "border-cream/70 bg-cream/85 text-[#13234f]"
                    : "border-cream/45"
                ].join(" ")}
              >
                {active ? <Check size={15} strokeWidth={3} /> : null}
              </span>
            </button>
          );
        })}
      </div>

      <ContinueBar visible={Boolean(selected)} onContinue={onContinue} />
    </>
  );
}
