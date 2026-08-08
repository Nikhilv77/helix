import Link from "next/link";
import type { DsaDifficulty, DsaQuestion } from "@/lib/dsa";
import {
  countByDifficulty,
  dsaPhases,
  dsaQuestionCount,
  groupByPattern,
  phaseSlug
} from "@/lib/dsa";
import { privatePageMetadata } from "@/lib/seo";

/**
 * Temporary internal index for the DSA question bank. This page stays a
 * scannable list — one row per question, grouped by phase and then by primary
 * pattern; the full metadata lives on each question's own page. Deliberately
 * not linked from the workspace navigation.
 */
export const metadata = privatePageMetadata(
  "Temp DSA Questions",
  "Internal verification index for the DSA question bank."
);

const DIFFICULTY_STYLE: Record<DsaDifficulty, string> = {
  easy: "bg-[#8be6bd]/14 text-[#8be6bd]",
  medium: "bg-[#f4d58b]/14 text-[#f4d58b]",
  hard: "bg-[#f0a3a3]/14 text-[#f0a3a3]"
};

export default function TempDsaQuestionsPage() {
  const phases = dsaPhases();
  const total = dsaQuestionCount();
  const difficulties = countByDifficulty(phases.flatMap((phase) => phase.questions));

  return (
    <div className="mx-auto w-full max-w-[95rem] px-5 pb-16 pt-8 sm:px-8 lg:px-10">
      <header className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cream/45">
          Internal · not linked from navigation
        </p>
        <h1 className="mt-2 font-display text-[2.2rem] font-semibold tracking-tight text-cream sm:text-[2.6rem]">
          Temp DSA Questions
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-7 text-cream/65">
          Verification index over the generated question bank. Select a question to see all of its
          stored metadata, or run the{" "}
          <Link
            href="/dsa-questions/audit"
            className="font-semibold text-cream/85 underline decoration-cream/30 underline-offset-2 transition hover:text-cream"
          >
            data-quality audit
          </Link>
          .
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Total questions" value={total} />
          <Stat label="Phases" value={phases.length} />
          <Stat label="Easy" value={difficulties.easy} />
          <Stat label="Medium" value={difficulties.medium} />
          <Stat label="Hard" value={difficulties.hard} />
        </dl>

        <nav aria-label="Jump to phase" className="mt-6 flex flex-wrap gap-2">
          {phases.map((phase) => (
            <a
              key={phase.phase}
              href={`#${phaseSlug(phase.phase)}`}
              className="rounded-lg bg-[#2a4aa0] px-3 py-1.5 text-[12.5px] font-medium text-cream/70 transition hover:bg-[#2f56b8] hover:text-cream"
            >
              {phase.phase.replace(/^Phase \d+ — /, "")}
              <span className="ml-1.5 text-cream/40">{phase.questions.length}</span>
            </a>
          ))}
        </nav>
      </header>

      <div className="space-y-12">
        {phases.map((phase) => {
          const counts = countByDifficulty(phase.questions);
          return (
            <section key={phase.phase} id={phaseSlug(phase.phase)} className="scroll-mt-6">
              <h2 className="font-display text-[1.5rem] font-semibold tracking-tight text-cream">
                {phase.phase}
              </h2>
              <p className="mt-1.5 text-[13px] font-medium text-cream/45">
                {phase.questions.length} questions · {counts.easy} easy · {counts.medium} medium ·{" "}
                {counts.hard} hard
              </p>

              <div className="mt-5 space-y-6">
                {(() => {
                  const groups = groupByPattern(phase.questions);
                  // In 4 of 10 phases every question shares one pattern, so the
                  // heading would just repeat the phase name. Skip it there.
                  const showHeadings = groups.length > 1;
                  return groups.map((group) => (
                    <section key={group.pattern}>
                      {showHeadings ? (
                        <h3 className="flex flex-wrap items-baseline gap-x-3 border-b border-cream/[0.1] pb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-cream/60">
                          {group.pattern}
                          <span className="font-normal normal-case tracking-normal text-cream/35">
                            {group.questions.length}
                          </span>
                        </h3>
                      ) : null}

                      <ul className={showHeadings ? "mt-2" : ""}>
                        {group.questions.map((question) => (
                          <li key={question.slug}>
                            <QuestionRow question={question} />
                          </li>
                        ))}
                      </ul>
                    </section>
                  ));
                })()}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-[#2a4aa0] px-5 py-4">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.13em] text-cream/45">{label}</dt>
      <dd className="mt-1.5 font-display text-[1.6rem] font-semibold tracking-tight text-cream">{value}</dd>
    </div>
  );
}

function QuestionRow({ question }: { question: DsaQuestion }) {
  return (
    <Link
      href={`/dsa-questions/${question.slug}`}
      className="group flex items-start gap-3 rounded-xl px-3 py-2.5 transition hover:bg-cream/[0.06] sm:items-center sm:gap-4"
    >
      <span className="mt-0.5 w-7 shrink-0 text-right font-mono text-[11px] text-cream/30 sm:mt-0">
        {question.recommendedOrder}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium text-cream/85 group-hover:text-cream">
          {question.title}
        </span>
        <span className="mt-0.5 block truncate text-[11.5px] text-cream/35">
          {question.subPatterns.join(" · ")}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-2 sm:gap-3">
        <span className="hidden font-mono text-[11px] text-cream/35 sm:inline">
          {question.expectedTimeMinutes}m
        </span>
        <span
          className={`rounded-md px-2 py-0.5 text-[10.5px] font-semibold capitalize ${DIFFICULTY_STYLE[question.difficulty]}`}
        >
          {question.difficulty}
        </span>
        <span aria-hidden className="text-cream/25 transition group-hover:text-cream/60">
          →
        </span>
      </span>
    </Link>
  );
}
