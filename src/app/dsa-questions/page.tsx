import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Clock3, Layers3, ListChecks } from "lucide-react";
import type { DsaDifficulty, DsaQuestion } from "@/features/practice/dsa/domain/dsa";
import {
  countByDifficulty,
  dsaPhases,
  dsaQuestionCount,
  groupByPattern,
  phaseSlug
} from "@/features/practice/dsa/domain/dsa";
import { privatePageMetadata } from "@/lib/shared/seo";

export const metadata = privatePageMetadata(
  "DSA Question Library",
  "Explore Trailgrad's structured DSA question library by topic, pattern, and difficulty."
);

const DIFFICULTY_STYLE: Record<DsaDifficulty, string> = {
  easy: "dsa-library-difficulty-easy",
  medium: "dsa-library-difficulty-medium",
  hard: "dsa-library-difficulty-hard"
};

export default function DsaQuestionsPage() {
  const phases = dsaPhases();
  const total = dsaQuestionCount();
  const difficulties = countByDifficulty(phases.flatMap((phase) => phase.questions));

  return (
    <main className="dsa-library-page practice-page min-h-[calc(100svh-4.25rem)] w-full">
      <div className="mx-auto w-full max-w-[95rem] px-5 pb-20 pt-8 sm:px-8 lg:px-10">
        <header className="mb-9">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--workspace-accent)]">
            Practice library
          </p>
          <h1 className="mt-2 font-display text-[2.2rem] font-semibold tracking-[-0.035em] text-cream sm:text-[2.6rem]">
            DSA Questions
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-cream/58">
            Explore interview-ready problems organised by topic, pattern, and difficulty. Open any
            question to practise in the full coding workspace.
          </p>

          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat icon={<ListChecks size={15} />} label="Questions" value={total} />
            <Stat icon={<Layers3 size={15} />} label="Topics" value={phases.length} />
            <Stat label="Easy" value={difficulties.easy} tone="easy" />
            <Stat label="Medium" value={difficulties.medium} tone="medium" />
            <Stat label="Hard" value={difficulties.hard} tone="hard" />
          </dl>

          <div className="mt-7">
            <p className="mb-2.5 text-sm font-bold uppercase tracking-[0.12em] text-cream/38">
              Filter by topic
            </p>
            <nav aria-label="Jump to topic" className="flex flex-wrap gap-2">
              {phases.map((phase) => (
                <a
                  key={phase.phase}
                  href={`#${phaseSlug(phase.phase)}`}
                  className="dsa-library-topic-chip inline-flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-[var(--workspace-card)] px-3 py-1.5 text-sm font-semibold text-cream/62 transition hover:border-[var(--workspace-accent-border)] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
                >
                  {phase.phase.replace(/^Phase \d+ — /, "")}
                  <span className="font-mono text-sm text-cream/34">
                    {phase.questions.length}
                  </span>
                </a>
              ))}
            </nav>
          </div>
        </header>

        <div className="space-y-12">
          {phases.map((phase, phaseIndex) => {
            const counts = countByDifficulty(phase.questions);
            const groups = groupByPattern(phase.questions);
            const showHeadings = groups.length > 1;

            return (
              <section key={phase.phase} id={phaseSlug(phase.phase)} className="scroll-mt-6">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 font-mono text-sm font-semibold text-[var(--workspace-accent)]">
                    {String(phaseIndex + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h2 className="font-display text-[1.5rem] font-semibold tracking-[-0.025em] text-cream">
                      {phase.phase.replace(/^Phase \d+ — /, "")}
                    </h2>
                    <p className="mt-1.5 text-sm font-medium text-cream/42">
                      {phase.questions.length} questions · {counts.easy} easy · {counts.medium}{" "}
                      medium · {counts.hard} hard
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-6">
                  {groups.map((group) => (
                    <section key={group.pattern}>
                      {showHeadings ? (
                        <h3 className="flex flex-wrap items-baseline gap-x-3 border-b border-white/[0.09] pb-2.5 text-sm font-bold uppercase tracking-[0.12em] text-cream/56">
                          {group.pattern}
                          <span className="font-mono font-normal normal-case tracking-normal text-cream/30">
                            {group.questions.length}
                          </span>
                        </h3>
                      ) : null}

                      <ol className={showHeadings ? "mt-1" : "border-t border-white/[0.09]"}>
                        {group.questions.map((question) => (
                          <li
                            key={question.slug}
                            className="border-b border-white/[0.055] last:border-0"
                          >
                            <QuestionRow question={question} />
                          </li>
                        ))}
                      </ol>
                    </section>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function Stat({
  icon,
  label,
  value,
  tone
}: {
  icon?: ReactNode;
  label: string;
  value: number;
  tone?: DsaDifficulty;
}) {
  return (
    <div className="dsa-library-stat rounded-2xl border border-white/[0.07] bg-[var(--workspace-card)] px-5 py-4">
      <dt className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.11em] text-cream/40">
        {icon ? <span className="text-[var(--workspace-accent)]">{icon}</span> : null}
        {tone ? <span className={`dsa-library-stat-dot dsa-library-stat-dot-${tone}`} /> : null}
        {label}
      </dt>
      <dd className="mt-1.5 font-display text-[1.6rem] font-semibold tracking-[-0.025em] text-cream">
        {value}
      </dd>
    </div>
  );
}

function QuestionRow({ question }: { question: DsaQuestion }) {
  return (
    <Link
      href={`/dsa-questions/${question.slug}`}
      className="dsa-library-question-row group flex items-start gap-3 rounded-lg px-3 py-3 transition hover:bg-white/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--workspace-accent-border)] sm:items-center sm:gap-4"
    >
      <span className="mt-0.5 w-8 shrink-0 text-right font-mono text-sm text-cream/28 sm:mt-0">
        {question.recommendedOrder}
      </span>

      <span className="min-w-0 flex-1">
        <span className="dsa-library-question-title block text-sm font-semibold leading-5 text-cream/82 transition group-hover:text-cream">
          {question.title}
        </span>
        <span className="mt-0.5 block truncate text-sm text-cream/34">
          {question.subPatterns.join(" · ")}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-2 sm:gap-3">
        <span className="hidden items-center gap-1 font-mono text-sm text-cream/34 sm:inline-flex">
          <Clock3 size={11} aria-hidden="true" />
          {question.expectedTimeMinutes}m
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-sm font-bold capitalize ${DIFFICULTY_STYLE[question.difficulty]}`}
        >
          {question.difficulty}
        </span>
        <ArrowRight
          size={14}
          aria-hidden="true"
          className="text-cream/22 transition group-hover:translate-x-0.5 group-hover:text-[var(--workspace-accent)]"
        />
      </span>
    </Link>
  );
}
