"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, ChevronDown, Lightbulb, Sparkles, Target } from "lucide-react";
import { DsaQuestionNotes } from "@/components/interview/dsa/dsa-question-notes";
import { recordHintsUsed } from "@/lib/dsa/hint-tracker";
import type { DsaQuestion } from "@/lib/dsa/dsa";

type PanelTab = "description" | "hints" | "review" | "notes";

const TABS: Array<{ id: PanelTab; label: string }> = [
  { id: "description", label: "Description" },
  { id: "hints", label: "Hints" },
  { id: "review", label: "Review" },
  { id: "notes", label: "Notes" }
];

/** Compact, scrollable problem reference for the split coding workspace. */
export function DsaProblemPanel({ question }: { question: DsaQuestion }) {
  const [tab, setTab] = useState<PanelTab>("description");
  const [revealedHints, setRevealedHints] = useState(0);

  useEffect(() => {
    recordHintsUsed(question.slug, revealedHints);
  }, [question.slug, revealedHints]);

  useEffect(() => {
    setTab("description");
    setRevealedHints(0);
  }, [question.slug]);

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#141619]">
      <div
        role="tablist"
        aria-label="Question reference"
        className="thin-scroll flex shrink-0 items-center gap-1 overflow-x-auto border-b border-white/[0.07] px-2 pt-2"
      >
        {TABS.map((item) => {
          const selected = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(item.id)}
              className={[
                "relative h-10 shrink-0 rounded-t-lg px-3 text-[13px] font-semibold transition-colors",
                selected ? "text-cream" : "text-cream/42 hover:bg-white/[0.035] hover:text-cream/72"
              ].join(" ")}
            >
              {item.label}
              {item.id === "hints" && question.hints?.length ? (
                <span className="ml-1.5 text-[11px] tabular-nums text-cream/34">
                  {revealedHints}/{question.hints.length}
                </span>
              ) : null}
              {selected ? (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--workspace-accent)]" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        {tab === "description" ? <Description question={question} /> : null}
        {tab === "hints" ? (
          <Hints
            question={question}
            revealed={revealedHints}
            revealNext={() =>
              setRevealedHints((count) => Math.min(count + 1, question.hints?.length ?? 0))
            }
          />
        ) : null}
        {tab === "review" ? <Review question={question} /> : null}
        {tab === "notes" ? <DsaQuestionNotes slug={question.slug} /> : null}
      </div>
    </section>
  );
}

function Description({ question }: { question: DsaQuestion }) {
  return (
    <div className="space-y-7">
      <section>
        <h2 className="text-[13px] font-semibold text-cream/88">Problem</h2>
        <p className="mt-3 text-[14.5px] leading-7 text-cream/72">
          {question.problemStatement ?? question.promptSummary}
        </p>
      </section>

      {question.examples?.length ? (
        <section>
          <h2 className="text-[13px] font-semibold text-cream/88">Examples</h2>
          <div className="mt-3 space-y-3">
            {question.examples.map((example, index) => (
              <article key={`${example.input}-${index}`} className="rounded-xl bg-black/25 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cream/38">
                  Example {index + 1}
                </p>
                <dl className="mt-3 grid gap-x-3 gap-y-2 font-mono text-[12.5px] leading-5 sm:grid-cols-[4.25rem_1fr]">
                  <dt className="text-cream/34">Input</dt>
                  <dd className="overflow-x-auto text-cream/76">{example.input}</dd>
                  <dt className="text-cream/34">Output</dt>
                  <dd className="text-cream/76">{example.output}</dd>
                </dl>
                {example.explanation ? (
                  <p className="mt-3 text-[13px] leading-5 text-cream/48">{example.explanation}</p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {question.constraints?.length ? (
        <CompactList title="Constraints" items={question.constraints} mono />
      ) : null}

      {question.edgeCases?.length ? (
        <CompactList title="Edge cases" items={question.edgeCases} />
      ) : null}
    </div>
  );
}

function Hints({
  question,
  revealed,
  revealNext
}: {
  question: DsaQuestion;
  revealed: number;
  revealNext: () => void;
}) {
  const hints = question.hints ?? [];
  const allRevealed = revealed >= hints.length;

  return (
    <div>
      <div className="flex items-center gap-2.5">
        <Lightbulb size={16} aria-hidden="true" className="text-[var(--workspace-accent)]" />
        <div>
          <h2 className="text-[14px] font-semibold text-cream">Progressive hints</h2>
          <p className="mt-0.5 text-[12.5px] text-cream/42">Reveal only what you need.</p>
        </div>
      </div>

      {hints.length ? (
        <div className="mt-5 space-y-3">
          {hints.slice(0, revealed).map((hint, index) => (
            <div key={hint} className="fade-slide flex gap-3 rounded-xl bg-white/[0.035] p-4">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--workspace-accent-soft)] text-[12px] font-semibold text-[var(--workspace-accent)]">
                {index + 1}
              </span>
              <p className="text-[14px] leading-6 text-cream/72">{hint}</p>
            </div>
          ))}

          {!allRevealed ? (
            <button
              type="button"
              onClick={revealNext}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.035] text-[13px] font-semibold text-cream/72 transition hover:bg-white/[0.065] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
            >
              <Lightbulb size={14} aria-hidden="true" />
              {revealed === 0 ? "Show first hint" : `Show next hint · ${revealed}/${hints.length}`}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-5 text-[13px] text-cream/42">No hints are available for this question.</p>
      )}

      {question.keyInsight && allRevealed ? (
        <details className="group mt-4 overflow-hidden rounded-xl border border-[var(--workspace-accent-border)] bg-[var(--workspace-accent-soft)]">
          <summary className="flex cursor-pointer list-none items-center gap-2.5 p-4 [&::-webkit-details-marker]:hidden">
            <Target size={15} aria-hidden="true" className="text-[var(--workspace-accent)]" />
            <span className="min-w-0 flex-1 text-[13px] font-semibold text-cream">Key insight</span>
            <ChevronDown
              size={14}
              aria-hidden="true"
              className="text-cream/42 transition-transform group-open:rotate-180"
            />
          </summary>
          <p className="border-t border-white/[0.07] px-4 pb-4 pt-3 text-[13.5px] leading-6 text-cream/72">
            {question.keyInsight}
          </p>
        </details>
      ) : null}
    </div>
  );
}

function Review({ question }: { question: DsaQuestion }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--workspace-accent-border)] bg-[var(--workspace-accent-soft)] p-4">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-cream">
          <Sparkles size={15} aria-hidden="true" className="text-[var(--workspace-accent)]" />
          Intended approach
        </div>
        <p className="mt-3 text-[13.5px] leading-6 text-cream/72">{question.highLevelApproach}</p>
        <div className="mt-4 flex gap-2">
          <Metric label="Time" value={question.complexity.time} />
          <Metric label="Space" value={question.complexity.space} />
        </div>
      </div>

      {question.approaches?.map((approach, index) => (
        <ReviewDisclosure
          key={approach.name}
          title={`${index + 1}. ${approach.name}`}
          subtitle={`${approach.complexity.time} · ${approach.complexity.space}`}
        >
          <p>{approach.idea}</p>
          <ol className="mt-3 space-y-2">
            {approach.steps.map((step, stepIndex) => (
              <li key={step} className="flex gap-2.5">
                <span className="text-cream/30">{stepIndex + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-cream/45">{approach.tradeoff}</p>
        </ReviewDisclosure>
      ))}

      {question.commonMistakes.length ? (
        <ReviewDisclosure title="Common mistakes" icon="warning">
          <CompactList items={question.commonMistakes} />
        </ReviewDisclosure>
      ) : null}

      {question.interviewSignals.length ? (
        <ReviewDisclosure title="Interview signals">
          <CompactList items={question.interviewSignals} />
        </ReviewDisclosure>
      ) : null}

      {question.followUpPrompts.length ? (
        <ReviewDisclosure title="Follow-up questions">
          <CompactList items={question.followUpPrompts} />
        </ReviewDisclosure>
      ) : null}
    </div>
  );
}

function ReviewDisclosure({
  title,
  subtitle,
  icon,
  children
}: {
  title: string;
  subtitle?: string;
  icon?: "warning";
  children: ReactNode;
}) {
  return (
    <details className="group overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.025]">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 p-4 [&::-webkit-details-marker]:hidden">
        {icon === "warning" ? (
          <AlertTriangle size={14} aria-hidden="true" className="text-[var(--workspace-accent)]" />
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold text-cream/84">{title}</span>
          {subtitle ? (
            <span className="mt-1 block font-mono text-[11px] text-cream/36">{subtitle}</span>
          ) : null}
        </span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className="text-cream/36 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-white/[0.06] px-4 pb-4 pt-3 text-[13px] leading-6 text-cream/66">
        {children}
      </div>
    </details>
  );
}

function CompactList({
  title,
  items,
  mono = false
}: {
  title?: string;
  items: string[];
  mono?: boolean;
}) {
  return (
    <section>
      {title ? <h2 className="text-[13px] font-semibold text-cream/88">{title}</h2> : null}
      <ul className={title ? "mt-3 space-y-2.5" : "space-y-2.5"}>
        {items.map((item) => (
          <li key={item} className="flex gap-2.5">
            <span className="mt-[0.6rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--workspace-accent)]" />
            <span
              className={
                mono
                  ? "font-mono text-[12.5px] leading-5 text-cream/68"
                  : "text-[13.5px] leading-6 text-cream/66"
              }
            >
              {item}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg bg-black/20 px-2.5 py-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-cream/36">
        {label}
      </span>
      <span className="font-mono text-[12px] text-cream/76">{value}</span>
    </span>
  );
}
