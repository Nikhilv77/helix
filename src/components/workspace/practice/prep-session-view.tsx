import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  RotateCcw
} from "lucide-react";
import type {
  PrepPracticeQuestionSummary,
  PrepPracticeSession
} from "@/lib/practice/prep-practice";

/** The non-DSA sessions use the same calm, compact practice surface as DSA. */
export function PrepSessionView({ session }: { session: PrepPracticeSession }) {
  const next = session.recommendedQuestion;

  return (
    <main className="mx-auto w-full max-w-[86rem] px-4 pb-20 pt-7 sm:px-7 sm:pt-9 lg:px-8 lg:pt-8">
      <Link
        href="/practice"
        className="mb-5 inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-[12.5px] font-semibold text-cream/52 transition hover:bg-white/[0.055] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to Practice
      </Link>

      <section className="grid min-w-0 gap-7 xl:grid-cols-[minmax(0,1fr)_17rem] xl:items-start xl:gap-x-14">
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--workspace-accent)]">
                Practice session
              </p>
              <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.035em] text-cream sm:text-[36px]">
                {session.title}
              </h1>
              <p className="mt-2 max-w-3xl text-[15px] leading-6 text-cream/55">
                {session.purpose}
              </p>
            </div>
            <ProgressSummary session={session} />
          </div>

          <section className="mt-7 overflow-hidden rounded-[1.45rem] border border-white/[0.08] bg-[#17191b]">
            <div className="flex flex-col gap-5 p-5 sm:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--workspace-accent)]">
                {next ? "Continue where you left off" : "Session complete"}
              </p>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-[24px] font-semibold tracking-[-0.03em] text-cream">
                    {next?.title ?? "You finished this session"}
                  </h2>
                  <p className="mt-2 max-w-2xl text-[14px] leading-6 text-cream/55">
                    {next?.recommendationReason ??
                      "Return to any question below whenever you want a focused retry."}
                  </p>
                </div>
                {next ? (
                  <Link
                    href={next.href}
                    className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-cream px-4 text-[12.5px] font-semibold text-[#171a16] transition hover:bg-white"
                  >
                    Continue <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {session.covers.slice(0, 5).map((item) => (
                  <span
                    key={item}
                    className="rounded-md bg-white/[0.045] px-2.5 py-1 text-[11.5px] font-medium text-cream/48"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-8" aria-labelledby="session-path-heading">
            <h2
              id="session-path-heading"
              className="text-[12px] font-semibold uppercase tracking-[0.14em] text-cream/52"
            >
              Your path
            </h2>
            <div className="mt-4 space-y-3">
              {session.chapters.map((chapter, index) => (
                <ChapterBlock key={chapter.key} chapter={chapter} index={index} />
              ))}
            </div>
          </section>
        </div>

        <aside className="rounded-[1.4rem] border border-white/[0.08] bg-[#17191b] p-5 xl:sticky xl:top-24">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--workspace-accent)]">
            How to practice
          </p>
          <h2 className="mt-2 text-[21px] font-semibold tracking-[-0.025em] text-cream">
            Use this simple loop.
          </h2>
          <ol className="mt-5 space-y-4 text-[13px] leading-5 text-cream/60">
            {[
              "Read the prompt before looking for an answer.",
              "Write or say your reasoning in your own words.",
              "Use the review, then retry what needs work."
            ].map((item, index) => (
              <li key={item} className="flex gap-3">
                <span className="font-mono text-[11px] font-semibold text-[var(--workspace-accent)]">
                  0{index + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </aside>
      </section>
    </main>
  );
}

function ProgressSummary({ session }: { session: PrepPracticeSession }) {
  return (
    <div className="w-full max-w-[20rem] rounded-xl border border-white/[0.08] bg-[#17191b] p-4 sm:w-[20rem]">
      <p className="text-[14px] font-medium text-cream/76">
        You&apos;ve completed {session.completedQuestions} of {session.totalQuestions} questions.
      </p>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.09]">
        <span
          className="block h-full rounded-full bg-[var(--workspace-accent)]"
          style={{ width: `${session.progressPercent}%` }}
        />
      </div>
      <p className="mt-2 text-[11.5px] text-cream/38">
        {session.attemptedQuestions} attempted · {session.progressPercent}% complete
      </p>
    </div>
  );
}

function ChapterBlock({
  chapter,
  index
}: {
  chapter: PrepPracticeSession["chapters"][number];
  index: number;
}) {
  const completed = chapter.completedQuestions === chapter.totalQuestions;
  const percent = chapter.totalQuestions
    ? Math.round((chapter.completedQuestions / chapter.totalQuestions) * 100)
    : 0;
  return (
    <details
      className="group overflow-hidden rounded-[1.4rem] bg-[#17191b] transition-colors hover:bg-[#1a1b1e]"
      open={index === 0}
    >
      <summary className="flex min-h-[4.75rem] cursor-pointer list-none items-center gap-3.5 px-4 py-4 [&::-webkit-details-marker]:hidden sm:gap-4 sm:px-5">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.045] text-[13px] font-semibold ${completed ? "text-[var(--workspace-accent)]" : "text-cream/48"}`}
        >
          {completed ? <Check size={14} aria-hidden="true" /> : index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-[17px] font-semibold tracking-[-0.02em] text-cream sm:text-[18px]">
            {chapter.title}
          </span>
          <span className="mt-1.5 block text-[12px] text-cream/42">{chapter.purpose}</span>
        </span>
        <span className="hidden w-32 shrink-0 sm:block">
          <span className="flex items-baseline justify-between text-[13px] font-semibold tabular-nums">
            <span className="text-cream/72">{chapter.completedQuestions} complete</span>
            <span className="text-[var(--workspace-accent)]">{percent}%</span>
          </span>
          <span className="mt-2 block h-1 overflow-hidden rounded-full bg-white/[0.07]">
            <span
              className="block h-full rounded-full bg-[var(--workspace-accent)]"
              style={{ width: `${percent}%` }}
            />
          </span>
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="shrink-0 text-cream/40 transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <div className="grid gap-2.5 px-3 pb-3 sm:px-4 sm:pb-4 lg:grid-cols-2">
        {chapter.questions.map((question, questionIndex) => (
          <QuestionRow
            key={`${question.progressId}-${question.order}`}
            question={question}
            index={questionIndex}
          />
        ))}
      </div>
    </details>
  );
}

function QuestionRow({
  question,
  index
}: {
  question: PrepPracticeQuestionSummary;
  index: number;
}) {
  const completed = question.status === "COMPLETED";
  const retry = question.attemptCount > 0 && !completed;
  return (
    <Link
      href={question.href}
      className="group flex min-h-[5.25rem] items-center gap-3 rounded-xl bg-black/[0.28] p-3.5 transition hover:bg-black/[0.42]"
    >
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[12px] font-semibold ${completed ? "bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]" : "bg-white/[0.045] text-cream/45"}`}
      >
        {completed ? (
          <CheckCircle2 size={15} aria-hidden="true" />
        ) : retry ? (
          <RotateCcw size={14} aria-hidden="true" />
        ) : (
          index + 1
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span
            className={`truncate text-[14px] font-semibold ${completed ? "text-cream/55" : "text-cream/88"}`}
          >
            {question.title}
          </span>
          {completed ? (
            <span className="rounded-full bg-[var(--workspace-accent-soft)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.11em] text-[var(--workspace-accent)]">
              Solved
            </span>
          ) : null}
        </span>
        <span className="mt-1.5 flex items-center gap-2 text-[11.5px] text-cream/42">
          <span>{formatLabel(question.format)}</span>
          <span>·</span>
          <span className="capitalize">{question.difficulty}</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <Clock3 size={11} aria-hidden="true" />
            {question.expectedMinutes} min
          </span>
        </span>
      </span>
      <ArrowRight
        size={15}
        aria-hidden="true"
        className="shrink-0 text-cream/30 transition group-hover:translate-x-0.5 group-hover:text-cream/70"
      />
    </Link>
  );
}


/** Human wording for a format slug; `capitalize` alone gives "Find-the-flaw". */
function formatLabel(format: string): string {
  switch (format) {
    case "predict-run":
      return "Predict the output";
    case "find-the-flaw":
      return "Find the flaw";
    case "diagnose":
      return "Diagnose";
    case "mcq":
      return "Multiple choice";
    case "spoken":
      return "Spoken";
    case "diagram":
      return "Diagram";
    default:
      return "Written";
  }
}
