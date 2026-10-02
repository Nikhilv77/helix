"use client";

import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { useState, type ReactNode, type RefObject } from "react";
import { DARK_PORTRAIT_PLACEHOLDER } from "@/lib/avatars/portrait-placeholder";

type Metric = { label: string; value: number };
type QuestionFeedback = { title: string; score: number; feedback: string };

export function AssessmentResultsScorecard({
  teacherName,
  teacherPortrait,
  title,
  overallScore,
  summary,
  metrics,
  evidenceLines,
  strengths,
  improvementAreas,
  questionFeedback,
  headingRef,
  children
}: {
  teacherName: string;
  teacherPortrait: string;
  title: string;
  overallScore: number;
  summary: string;
  metrics: Metric[];
  evidenceLines: string[];
  strengths: string[];
  improvementAreas: string[];
  questionFeedback: QuestionFeedback[];
  headingRef?: RefObject<HTMLHeadingElement | null>;
  children?: ReactNode;
}) {
  const [questionsVisible, setQuestionsVisible] = useState(false);
  const [openPrompts, setOpenPrompts] = useState<ReadonlySet<number>>(() => new Set());
  const togglePrompt = (index: number) =>
    setOpenPrompts((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#08090a]">
            <Image
              src={teacherPortrait}
              alt={`${teacherName}, your assessment teacher`}
              fill
              sizes="48px"
              quality={75}
              placeholder="blur"
              blurDataURL={DARK_PORTRAIT_PLACEHOLDER}
              className="scale-125 bg-[#08090a] object-cover object-[center_22%]"
            />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[var(--workspace-accent)]">
              Assessment complete
            </p>
            <h3
              ref={headingRef}
              tabIndex={headingRef ? -1 : undefined}
              className="mt-0.5 truncate font-display text-[1.4rem] font-semibold text-cream outline-none"
            >
              {title}
            </h3>
          </div>
        </div>

        <p
          className="flex items-end gap-1 leading-none"
          aria-label={`Overall ${overallScore} out of 100`}
        >
          <span className="font-display text-[2.5rem] font-semibold tabular-nums text-cream">
            {overallScore}
          </span>
          <span className="pb-1.5 text-sm font-medium text-cream/46">/100 overall</span>
        </p>
      </div>

      <p className="mt-5 max-w-[46rem] text-[15px] leading-7 text-cream/66">{summary}</p>
      {evidenceLines.length ? (
        <p className="mt-2 max-w-[46rem] text-[12.5px] leading-5 text-cream/42">
          {evidenceLines.join(" · ")}
        </p>
      ) : null}

      <dl className="mt-6 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="truncate text-[13px] text-cream/55">{metric.label}</dt>
              <dd className="shrink-0 text-[13px] font-semibold tabular-nums text-cream/85">
                {`${metric.value}/100`}
              </dd>
            </div>
            <span className="interview-roadmap-progress mt-2 block h-1 overflow-hidden rounded-full bg-white/[0.08]">
              <span
                className="block h-full w-full origin-left rounded-full bg-[var(--workspace-accent)]"
                style={{ transform: `scaleX(${Math.min(100, Math.max(0, metric.value)) / 100})` }}
              />
            </span>
          </div>
        ))}
      </dl>

      <div className="interview-soft-rule mt-6 grid gap-6 pt-5 md:grid-cols-2">
        <ResultList title="Strengths" items={strengths} accent />
        <ResultList title="Improvement areas" items={improvementAreas} />
      </div>

      {questionFeedback.length ? (
        <div className="interview-soft-rule mt-6 pt-3">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-cream/52">
              {questionFeedback.length} assessment questions
            </p>
            <button
              type="button"
              aria-expanded={questionsVisible}
              onClick={() => setQuestionsVisible((visible) => !visible)}
              className="practice-soft-hover inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-cream/72 hover:text-cream"
            >
              {questionsVisible ? "Show less" : "View question feedback"}
              <ChevronDown
                size={15}
                className={`transition-transform ${questionsVisible ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>
          </div>

          {questionsVisible ? (
            <ol className="mt-2">
              {questionFeedback.map((item, index) => {
                const open = openPrompts.has(index);
                return (
                  <li
                    key={`${index}:${item.title}`}
                    className={`grid grid-cols-[1.75rem_minmax(0,1fr)_auto] gap-x-3 py-4 ${index ? "interview-soft-rule" : ""}`}
                  >
                    <span className="text-sm tabular-nums text-cream/38">{index + 1}</span>
                    <div className="min-w-0">
                      <p className="text-[14px] leading-6 text-cream/80">{item.feedback}</p>
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => togglePrompt(index)}
                        className="mt-1.5 block w-full text-left text-[13px] leading-5 text-cream/45 hover:text-cream/65"
                      >
                        <span className={open ? "" : "line-clamp-1"}>{item.title}</span>
                      </button>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--workspace-accent)]">
                      {item.score}/100
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : null}
        </div>
      ) : null}

      {children}
    </div>
  );
}

function ResultList({
  title,
  items,
  accent = false
}: {
  title: string;
  items: string[];
  accent?: boolean;
}) {
  return (
    <section aria-label={title}>
      <h4 className="text-sm font-semibold text-cream/66">{title}</h4>
      <ul className="mt-2.5 space-y-2 text-[14px] leading-5 text-cream/62">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <span className={accent ? "text-[var(--workspace-accent)]" : "text-[#efb38f]"}>•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
