import type { ReactNode } from "react";
import Link from "next/link";
import type { DsaQuestion } from "@/lib/dsa";
import { auditBank, dsaQuestionCount, subPatternIndex } from "@/lib/dsa";
import { privatePageMetadata } from "@/lib/seo";

/**
 * Temporary internal audit of the DSA question bank. Every section here is a
 * check that should trend to zero — or to a list you have consciously accepted.
 * This is the page that catches bad metadata before it becomes database rows.
 */
export const metadata = privatePageMetadata(
  "DSA Bank Audit",
  "Internal data-quality checks over the DSA question bank."
);

export default function DsaAuditPage() {
  const audit = auditBank();
  const tags = subPatternIndex();
  const crossCutting = tags.filter((tag) => tag.phases.length >= 3);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <nav className="mb-6 text-xs text-white/45">
        <Link href="/dsa-questions" className="transition hover:text-white">
          ← Temp DSA Questions
        </Link>
      </nav>

      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-white sm:text-4xl">Bank audit</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/60">
          Data-quality checks over all {dsaQuestionCount()} questions. Each number below should be
          zero, or a list you have deliberately accepted.
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Vocabulary" value={tags.length} note="canonical tags" />
          <Stat
            label="Singleton tags"
            value={audit.singletonTags.length}
            note="used once"
            warn={audit.singletonTags.length > 0}
          />
          <Stat
            label="Graph orphans"
            value={audit.orphans.length}
            note="no edges"
            warn={audit.orphans.length > 0}
          />
          <Stat
            label="URL mismatches"
            value={audit.urlMismatches.length}
            note="slug vs link"
            warn={audit.urlMismatches.length > 0}
          />
        </dl>
      </header>

      <div className="space-y-6">
        <Check
          label="Dependency-graph orphans"
          hint="No prerequisites and nothing depends on them. Some are genuinely standalone; the rest are missing edges."
          count={audit.orphans.length}
        >
          <QuestionList items={audit.orphans} />
        </Check>

        <Check
          label="Difficulty vs time disagreement"
          hint="An easy question budgeted 25 minutes or more, or a hard one budgeted 25 or less. These are deliberate where the LeetCode label understates the real work."
          count={audit.timeMismatches.length}
        >
          <QuestionList items={audit.timeMismatches} showTime />
        </Check>

        <Check
          label="Slug does not match its LeetCode URL"
          hint="Usually means the problem was renamed upstream."
          count={audit.urlMismatches.length}
        >
          <QuestionList items={audit.urlMismatches} />
        </Check>

        <Check
          label="Sub-patterns used only once"
          hint="A controlled vocabulary should have few of these. Each is a candidate for merging into a broader tag."
          count={audit.singletonTags.length}
        >
          <ul className="space-y-1.5">
            {audit.singletonTags.map((tag) => (
              <li key={tag.tag} className="flex flex-wrap items-baseline gap-2 text-sm">
                <span className="font-mono text-xs text-white/70">{tag.tag}</span>
                <span className="text-white/35">→</span>
                {tag.questions.map((question) => (
                  <QuestionLink key={question.slug} question={question} />
                ))}
              </li>
            ))}
          </ul>
        </Check>

        <section className="surface-card rounded-xl p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-white">Cross-phase techniques</h2>
          <p className="mt-1 text-xs text-white/50">
            Sub-patterns appearing in three or more phases — the techniques that genuinely recur.
            This is the view a technique-first learner index would be built on.
          </p>
          <ul className="mt-4 space-y-1">
            {crossCutting.map((tag) => (
              <li
                key={tag.tag}
                className="flex items-baseline gap-3 border-b border-white/[0.06] py-1.5 last:border-0"
              >
                <span className="w-8 shrink-0 text-right font-mono text-xs text-white/40">
                  {tag.questions.length}
                </span>
                <span className="min-w-0 flex-1 font-mono text-xs text-white/75">{tag.tag}</span>
                <span className="shrink-0 text-[11px] text-white/35">
                  {tag.phases.length} phases
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  warn
}: {
  label: string;
  value: number;
  note: string;
  warn?: boolean;
}) {
  return (
    <div className="surface-card rounded-xl px-4 py-3">
      <dt className="text-[11px] uppercase tracking-[0.14em] text-white/45">{label}</dt>
      <dd
        className={`mt-1 font-display text-2xl font-semibold ${warn ? "text-amber-200" : "text-white"}`}
      >
        {value}
      </dd>
      <dd className="text-[11px] text-white/35">{note}</dd>
    </div>
  );
}

function Check({
  label,
  hint,
  count,
  children
}: {
  label: string;
  hint: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="surface-card rounded-xl p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">{label}</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${count === 0 ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200"}`}
        >
          {count === 0 ? "clean" : `${count} to review`}
        </span>
      </div>
      <p className="mt-1 text-xs text-white/50">{hint}</p>
      <div className="mt-4">
        {count === 0 ? <p className="text-xs text-white/40">Nothing flagged.</p> : children}
      </div>
    </section>
  );
}

function QuestionList({
  items,
  showTime
}: {
  items: Array<{ question: DsaQuestion; phase: string }>;
  showTime?: boolean;
}) {
  return (
    <ul className="space-y-1.5">
      {items.map(({ question, phase }) => (
        <li key={question.slug} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
          <QuestionLink question={question} />
          {showTime ? (
            <span className="font-mono text-[11px] text-white/45">
              {question.difficulty} · {question.expectedTimeMinutes}m
            </span>
          ) : null}
          <span className="text-[11px] text-white/30">{phase}</span>
        </li>
      ))}
    </ul>
  );
}

function QuestionLink({ question }: { question: DsaQuestion }) {
  return (
    <Link
      href={`/dsa-questions/${question.slug}`}
      className="text-white/80 underline decoration-white/20 underline-offset-2 transition hover:text-white"
    >
      {question.title}
    </Link>
  );
}
