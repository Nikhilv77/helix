import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock3,
  RotateCcw,
  Sparkles
} from "lucide-react";
import type {
  PrepPracticeQuestionSummary,
  PrepPracticeSession
} from "@/lib/practice/prep-practice";

export function PrepSessionView({ session }: { session: PrepPracticeSession }) {
  return (
    <main className="mx-auto w-full max-w-[94rem] px-4 pb-20 pt-8 sm:px-6 lg:px-8">
      <nav className="mb-7 flex items-center gap-2 text-sm text-cream/45" aria-label="Breadcrumb">
        <Link
          href="/practice"
          className="inline-flex items-center gap-2 transition hover:text-cream"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Practice
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-cream/75">{session.title}</span>
      </nav>

      <section className="workspace-accent-card-glow overflow-hidden rounded-[1.75rem] border border-[color-mix(in_srgb,var(--workspace-accent)_22%,transparent)] bg-graphite-900/72 p-6 shadow-[0_26px_90px_rgba(0,0,0,0.3)] sm:p-8">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--workspace-accent)_25%,transparent)] bg-[color-mix(in_srgb,var(--workspace-accent)_8%,transparent)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--workspace-accent)]">
              <Sparkles size={13} aria-hidden="true" /> Personalized practice
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-[-0.025em] text-cream sm:text-4xl">
              {session.title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-cream/62 sm:text-base">
              {session.purpose}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {session.covers.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/8 bg-white/[0.035] px-3 py-1.5 text-xs text-cream/55"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <div className="flex items-end justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.13em] text-cream/38">
                Progress
              </span>
              <span className="font-display text-2xl font-semibold text-cream">
                {session.progressPercent}%
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/7">
              <div
                className="h-full rounded-full bg-[var(--workspace-accent)] transition-all"
                style={{ width: `${session.progressPercent}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-cream/45">
              {session.completedQuestions} complete · {session.attemptedQuestions} attempted ·{" "}
              {session.totalQuestions} total
            </p>
          </div>
        </div>
      </section>

      {session.recommendedQuestion ? (
        <section className="mt-6 rounded-2xl border border-[color-mix(in_srgb,var(--workspace-accent)_20%,transparent)] bg-[color-mix(in_srgb,var(--workspace-accent)_6%,transparent)] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--workspace-accent)]">
            Recommended next
          </p>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold text-cream">
                {session.recommendedQuestion.title}
              </h2>
              <p className="mt-1 text-sm text-cream/52">
                {session.recommendedQuestion.recommendationReason}
              </p>
            </div>
            <Link
              href={session.recommendedQuestion.href}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--workspace-accent)] px-4 py-2.5 text-sm font-semibold text-graphite-950 transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--workspace-accent)]"
            >
              Continue <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </section>
      ) : (
        <section className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5 text-sm text-emerald-100/80">
          This session is complete. You can still open any question below and retry it.
        </section>
      )}

      <div className="mt-10 space-y-8">
        {session.chapters.map((chapter) => (
          <section key={chapter.key} aria-labelledby={`chapter-${chapter.key}`}>
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2
                  id={`chapter-${chapter.key}`}
                  className="font-display text-2xl font-semibold text-cream"
                >
                  {chapter.title}
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-cream/48">{chapter.purpose}</p>
              </div>
              <span className="text-xs font-medium text-cream/38">
                {chapter.completedQuestions}/{chapter.totalQuestions} complete
              </span>
            </div>
            <div className="grid gap-3">
              {chapter.questions.map((question) => (
                <QuestionRow key={`${question.progressId}-${question.order}`} question={question} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

function QuestionRow({ question }: { question: PrepPracticeQuestionSummary }) {
  const complete = question.status === "COMPLETED";
  const retry = question.attemptCount > 0 && !complete;
  return (
    <Link
      href={question.href}
      className="group grid gap-3 rounded-2xl border border-white/8 bg-graphite-900/60 px-4 py-4 transition hover:border-[color-mix(in_srgb,var(--workspace-accent)_28%,transparent)] hover:bg-graphite-900/82 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--workspace-accent)] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-5"
    >
      <span className={complete ? "text-emerald-300" : retry ? "text-amber-300" : "text-cream/25"}>
        {complete ? (
          <CheckCircle2 size={20} aria-hidden="true" />
        ) : retry ? (
          <RotateCcw size={19} aria-hidden="true" />
        ) : (
          <Circle size={19} aria-hidden="true" />
        )}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-cream/88 transition group-hover:text-cream">
            {question.title}
          </h3>
          <span className="rounded-full bg-white/[0.045] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.11em] text-cream/38">
            {question.format}
          </span>
          <span className="text-[11px] capitalize text-cream/35">{question.difficulty}</span>
        </div>
        <p className="mt-1 line-clamp-1 text-sm text-cream/43">{question.objective}</p>
      </div>
      <div className="flex items-center gap-3 text-xs text-cream/38">
        <span className="inline-flex items-center gap-1">
          <Clock3 size={13} aria-hidden="true" /> {question.expectedMinutes}m
        </span>
        <ArrowRight
          size={16}
          className="transition group-hover:translate-x-0.5 group-hover:text-[var(--workspace-accent)]"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}
