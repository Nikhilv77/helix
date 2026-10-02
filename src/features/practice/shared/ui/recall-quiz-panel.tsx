"use client";

import { Check, ChevronRight, RotateCcw, X } from "lucide-react";
import { use, useState } from "react";
import type { RecallQuizItem } from "@/features/practice/shared/domain/recall-quiz";

const LETTERS = ["A", "B", "C", "D", "E"];

/**
 * An unscored recall check from the finished practice path. Answers are
 * checked in the browser and never sent anywhere, so it cannot change the
 * assessment result. Renders nothing when there is no quiz.
 */
export function RecallQuizPanel({ quiz }: { quiz: Promise<RecallQuizItem[]> }) {
  const items = use(quiz);
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<Record<string, number>>({});

  if (!items.length) return null;

  const finished = index >= items.length;
  const recalled = items.filter((item) => picks[item.id] === item.correctIndex).length;
  const item = finished ? null : items[index]!;
  const picked = item ? picks[item.id] : undefined;
  const answered = picked !== undefined;

  return (
    <section aria-label="Recall check" className="mt-8 overflow-hidden rounded-xl bg-[#17181b]">
      <header className="interview-soft-rule-bottom flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <p className="text-[13px] font-semibold text-[var(--workspace-accent)]">Recall check</p>
          <span className="text-[12px] text-cream/42">Not scored</span>
        </div>
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {items.map((entry, position) => {
            const pick = picks[entry.id];
            return (
              <span
                key={entry.id}
                className={`h-1.5 rounded-full transition-all ${
                  position === index
                    ? "w-5 bg-[var(--workspace-accent)]"
                    : pick === undefined
                      ? "w-2.5 bg-white/10"
                      : pick === entry.correctIndex
                        ? "w-2.5 bg-[var(--workspace-accent)] opacity-60"
                        : "w-2.5 bg-[#ffb4b4]/60"
                }`}
              />
            );
          })}
        </div>
      </header>

      {item ? (
        <div className="px-4 py-4">
          <p className="text-[12px] text-cream/42">
            {item.source} · {index + 1} of {items.length}
          </p>
          <p className="mt-2 text-sm font-medium leading-6 text-cream/86">{item.prompt}</p>
          <p className="mt-1 text-[12px] text-cream/42">{item.instruction}</p>

          <div className="mt-3 space-y-2" role="radiogroup" aria-label="Choices">
            {item.choices.map((choice, choiceIndex) => {
              const correct = choiceIndex === item.correctIndex;
              const chosen = choiceIndex === picked;
              const tone = !answered
                ? "bg-white/[0.03] text-cream/72 hover:bg-white/[0.06] hover:text-cream"
                : correct
                  ? "bg-[var(--workspace-accent-soft)] text-cream"
                  : chosen
                    ? "bg-[#ffb4b4]/[0.08] text-cream/80"
                    : "text-cream/40";
              return (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  disabled={answered}
                  onClick={() => setPicks((current) => ({ ...current, [item.id]: choiceIndex }))}
                  className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] leading-5 transition disabled:cursor-default ${tone}`}
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-white/[0.06] text-[12px] text-cream/55">
                    {answered && correct ? (
                      <Check size={11} aria-hidden="true" />
                    ) : answered && chosen ? (
                      <X size={11} aria-hidden="true" />
                    ) : (
                      LETTERS[choiceIndex]
                    )}
                  </span>
                  <span>{choice}</span>
                </button>
              );
            })}
          </div>

          {answered ? (
            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <p role="status" className="min-w-0 flex-1 text-[13px] leading-5 text-cream/60">
                <span className="font-semibold text-cream/85">
                  {picked === item.correctIndex ? "Right. " : "Not quite. "}
                </span>
                {item.explanation}
              </p>
              <button
                type="button"
                onClick={() => setIndex((current) => current + 1)}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-cream/80 transition hover:bg-white/[0.09] hover:text-cream"
              >
                {index + 1 < items.length ? "Next" : "See result"}
                <ChevronRight size={13} aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
          <p className="text-sm text-cream/70">
            You recalled{" "}
            <span className="font-semibold text-cream">
              {recalled} of {items.length}
            </span>
            . This does not count toward your assessment.
          </p>
          <button
            type="button"
            onClick={() => {
              setPicks({});
              setIndex(0);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-cream/80 transition hover:bg-white/[0.09] hover:text-cream"
          >
            <RotateCcw size={12} aria-hidden="true" />
            Try again
          </button>
        </div>
      )}
    </section>
  );
}
