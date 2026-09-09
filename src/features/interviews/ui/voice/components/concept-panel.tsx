"use client";

import { BookOpen, Check, X } from "lucide-react";
import type { InterviewConcept } from "@/lib/shared/types";
import type { FundamentalsAreaSummary } from "@/lib/fundamentals/areas";
import { INTERVIEW_PANEL_RULE, INTERVIEW_PANEL_SHELL } from "./panel-surface";

/**
 * The fundamentals room's left column.
 *
 * It holds the teaching moment. While a question is open it stays quiet and
 * shows the areas the round covers; once a question is answered it fills in
 * with the model Maya was listening for. That is the thing a practice round can
 * do that a real interview cannot, so it is given the whole column.
 */
export function ConceptPanel({
  /**
   * The card for the question just answered, resolved on the server so the
   * question bank — and its answer keys — never reaches the browser.
   */
  concept,
  /** Set for a graded multiple choice answer; null for spoken questions. */
  correct,
  areas
}: {
  concept: InterviewConcept | null;
  correct: boolean | null;
  areas: FundamentalsAreaSummary[];
}) {

  return (
    <section
      className={`${INTERVIEW_PANEL_SHELL} flex min-h-[22rem] min-w-0 flex-col overflow-hidden xl:min-h-0`}
    >
      <header
        className={`flex shrink-0 items-center gap-2.5 border-b ${INTERVIEW_PANEL_RULE} px-4 py-3`}
      >
        <BookOpen size={15} aria-hidden="true" className="shrink-0 text-cream/40" />
        <p className="truncate text-sm font-medium text-cream/72">
          {concept ? "What I was listening for" : "What this round covers"}
        </p>
        {correct !== null ? (
          <span
            className={`ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              correct
                ? "bg-[var(--workspace-accent)]/[0.16] text-[var(--workspace-accent)]"
                : "bg-[#dd5f5f]/[0.14] text-[#ffb4b4]"
            }`}
          >
            {correct ? (
              <Check size={11} strokeWidth={2.5} aria-hidden="true" />
            ) : (
              <X size={11} strokeWidth={2.5} aria-hidden="true" />
            )}
            {correct ? "Correct" : "Missed"}
          </span>
        ) : null}
      </header>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        {concept ? (
          <article key={concept.title} className="concept-card-in">
            {concept.areaTitle ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--workspace-accent)]">
                {concept.areaTitle}
              </p>
            ) : null}
            <h2 className="mt-2.5 text-balance font-display text-[1.3rem] font-semibold leading-[1.24] tracking-tight text-cream">
              {concept.title}
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-cream/64">{concept.summary}</p>

            <ul className="mt-5 space-y-3">
              {concept.points.map((point) => (
                <li key={point} className="flex gap-3 text-[15px] leading-7 text-cream/74">
                  <span
                    aria-hidden="true"
                    className="mt-[0.7rem] h-1 w-1 shrink-0 rounded-full bg-[var(--workspace-accent)] shadow-[0_0_8px_var(--workspace-accent)]"
                  />
                  <span>{point}</span>
                </li>
              ))}
            </ul>

            {concept.explanation ? (
              <p className="mt-6 border-l-2 border-[var(--workspace-accent)]/45 pl-3 text-sm leading-6 text-cream/48">
                {concept.explanation}
              </p>
            ) : null}
          </article>
        ) : (
          <div>
            <p className="text-[15px] leading-7 text-cream/56">
              Answer a question and the model I was listening for appears here — so you leave
              knowing the mechanism, not just whether you got it right.
            </p>
            <ul className="mt-6 space-y-4">
              {areas.map((area) => (
                <li key={area.id}>
                  <p className="text-sm font-semibold text-cream/82">{area.title}</p>
                  <p className="mt-1 text-sm leading-6 text-cream/44">{area.why}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
