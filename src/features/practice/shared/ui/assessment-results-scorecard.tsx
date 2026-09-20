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

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/[0.09] bg-[#08090a]">
            <Image
              src={teacherPortrait}
              alt={`${teacherName}, your assessment teacher`}
              fill
              sizes="56px"
              quality={75}
              placeholder="blur"
              blurDataURL={DARK_PORTRAIT_PLACEHOLDER}
              className="scale-125 bg-[#08090a] object-cover object-[center_22%]"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(8,9,10,0.58)_100%)]" />
            <div className="absolute inset-y-2 right-0 w-px bg-[linear-gradient(180deg,transparent,var(--workspace-accent),transparent)] opacity-60" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--workspace-accent)]">
              Assessment complete
            </p>
            <h3
              ref={headingRef}
              tabIndex={headingRef ? -1 : undefined}
              className="mt-1 truncate font-display text-[1.65rem] font-semibold text-cream outline-none"
            >
              {title}
            </h3>
          </div>
        </div>

        <div className="relative min-w-[6rem] overflow-hidden rounded-2xl border border-[color:var(--workspace-accent-border)] bg-white/[0.025] px-4 py-2">
          <span className="absolute inset-y-3 left-0 w-px bg-[var(--workspace-accent)]" />
          <p className="text-sm font-medium text-cream/46">Overall</p>
          <p className="mt-1 flex items-end gap-1 leading-none">
            <span className="font-display text-4xl font-semibold tabular-nums text-cream">
              {overallScore}
            </span>
            <span className="pb-1 text-sm font-medium text-cream/46">/100</span>
          </p>
        </div>
      </div>

      <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl border border-white/[0.055] bg-white/[0.025] px-3 py-2.5"
          >
            <dt className="text-sm leading-5 text-cream/52">{metric.label}</dt>
            <dd className="mt-1 text-xl font-semibold leading-none tabular-nums text-cream">
              {metric.value}/100
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 grid gap-4 border-t border-white/[0.06] pt-4 lg:grid-cols-[1.2fr_0.9fr_1.25fr]">
        <div>
          <p className="text-base font-semibold leading-6 text-cream/78">{summary}</p>
          <div className="mt-2 space-y-1 text-sm leading-5 text-cream/46">
            {evidenceLines.map((line, index) => (
              <p key={`${index}:${line}`}>{line}</p>
            ))}
          </div>
        </div>
        <ResultList title="Strengths" items={strengths} accent />
        <ResultList title="Improvement areas" items={improvementAreas} />
      </div>

      {questionFeedback.length ? (
        <div className="mt-4 border-t border-white/[0.06] pt-3">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-cream/52">
              {questionFeedback.length} assessment questions
            </p>
            <button
              type="button"
              aria-expanded={questionsVisible}
              onClick={() => setQuestionsVisible((visible) => !visible)}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/[0.08] px-3 text-sm font-semibold text-cream/72 transition hover:bg-white/[0.04] hover:text-cream"
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
            <ol className="mt-3 grid gap-2 lg:grid-cols-2">
              {questionFeedback.map((item, index) => (
                <li
                  key={`${index}:${item.title}`}
                  className="rounded-xl border border-white/[0.055] bg-black/20 px-3.5 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold leading-5 text-cream/70">
                      <span className="mr-1.5 text-cream/32">{index + 1}.</span>
                      {item.title}
                    </p>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--workspace-accent)]">
                      {item.score}/100
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-5 text-cream/50">{item.feedback}</p>
                </li>
              ))}
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
      <ul className="mt-2 space-y-1.5 text-sm leading-5 text-cream/52">
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
