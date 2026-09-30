import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Braces, Mic2, Play } from "lucide-react";
import type {
  DashboardContinuation,
  DashboardInterviewContinuation,
  DashboardPracticeContinuation
} from "@/features/dashboard/contracts/dashboard-overview";
import { DashboardScoreRing } from "./dashboard-score-ring";

export function ContinuationSection({ data }: { data: DashboardContinuation }) {
  return (
    <section
      aria-label="Continue preparing"
      className="dashboard-deferred-row dashboard-deferred-row-continuation mt-5 grid min-w-0 gap-4 lg:grid-cols-2 lg:gap-5"
    >
      <PracticeContinuationCard practice={data.practice} />
      <InterviewContinuationCard interviews={data.interviews} />
    </section>
  );
}

function PracticeContinuationCard({ practice }: { practice: DashboardPracticeContinuation }) {
  return (
    <article
      aria-label="Practice continuation"
      className="grid min-h-[14rem] min-w-0 overflow-hidden rounded-[1.65rem] bg-[#151619] sm:grid-cols-[minmax(0,1fr)_17rem]"
    >
      <div className="flex min-w-0 flex-col p-5">
        <CardLabel icon={<Braces size={16} strokeWidth={1.6} aria-hidden="true" />}>
          Practice
        </CardLabel>

        <h2 className="mt-4 max-w-[27rem] text-[1.3rem] font-semibold leading-tight tracking-[-0.025em] text-cream">
          {practice.title}
        </h2>
        <p className="mt-2 max-w-[32rem] text-[14px] leading-6 text-cream/55">{practice.detail}</p>

        <div className="mt-auto pt-4">
          <DashboardAction href={practice.actionHref} label={practice.actionLabel} />
        </div>
      </div>

      <div className="flex min-h-[11rem] px-5 pb-5 sm:pl-0 sm:pt-5">
        <TeacherAdvicePanel practice={practice} />
      </div>
    </article>
  );
}

function InterviewContinuationCard({ interviews }: { interviews: DashboardInterviewContinuation }) {
  return (
    <article
      aria-label="Interview continuation"
      className="grid min-h-[14rem] min-w-0 overflow-hidden rounded-[1.65rem] bg-[#151619] sm:grid-cols-[minmax(0,1fr)_17rem]"
    >
      <div className="flex min-w-0 flex-col p-5">
        <CardLabel icon={<Mic2 size={16} strokeWidth={1.6} aria-hidden="true" />}>
          Interviews
        </CardLabel>

        <h2 className="mt-4 max-w-[27rem] text-[1.3rem] font-semibold leading-tight tracking-[-0.025em] text-cream">
          {interviews.title}
        </h2>
        <p className="mt-2 max-w-[32rem] text-[14px] leading-6 text-cream/55">
          {interviews.detail}
        </p>

        <div className="mt-auto pt-4">
          <DashboardAction href={interviews.actionHref} label={interviews.actionLabel} />
        </div>
      </div>

      <div className="flex min-h-[11rem] items-center justify-center px-5 pb-5 sm:pl-0 sm:pt-5">
        <InterviewVisual interviews={interviews} />
      </div>
    </article>
  );
}

function CardLabel({ children, icon }: { children: string; icon: ReactNode }) {
  // A plain icon and a sentence-case name: no tile behind it, no caps.
  return (
    <div className="flex items-center gap-2 text-cream/50">
      {icon}
      <p className="text-[13px] font-medium text-cream/55">{children}</p>
    </div>
  );
}

function TeacherAdvicePanel({ practice }: { practice: DashboardPracticeContinuation }) {
  const hasProgress = practice.totalQuestions > 0;

  return (
    <aside
      className="relative flex w-full min-w-0 flex-col items-center justify-center overflow-hidden py-2 text-center"
      aria-label="Teacher note"
    >
      <p className="text-[12px] text-cream/42">A note from your teacher</p>
      <p className="mx-auto mt-2.5 max-w-[14.5rem] text-[14px] font-medium leading-[1.55] text-cream/80">
        {practice.teacherAdvice}
      </p>

      <div className="mx-auto mt-5 w-full max-w-[14.5rem]">
        {hasProgress ? (
          <>
            <div className="flex items-end justify-between gap-3">
              <span className="text-[12px] text-cream/45">Practice path</span>
              <span className="text-[14px] font-semibold tabular-nums text-cream/80">
                {practice.progressPercent}%
              </span>
            </div>
            <div className="dashboard-progress-track mt-2 h-1.5 overflow-hidden rounded-full bg-cream/[0.07]">
              <span
                className="block h-full rounded-full bg-[var(--workspace-accent)]"
                style={{ width: `${practice.progressPercent}%` }}
              />
            </div>
            <p className="mt-2 text-[12px] tabular-nums text-cream/42">
              {practice.completedQuestions} of {practice.totalQuestions} questions complete
            </p>
          </>
        ) : (
          <p className="text-[12px] text-cream/42">{practice.statusLabel}</p>
        )}
      </div>
    </aside>
  );
}

function ProgressRing({ value, ariaLabel }: { value: number; ariaLabel: string }) {
  return (
    <DashboardScoreRing
      value={value}
      ariaLabel={ariaLabel}
      className="h-32 w-32"
      valueClassName="text-[1.75rem]"
    />
  );
}

function InterviewVisual({ interviews }: { interviews: DashboardInterviewContinuation }) {
  if (interviews.latestScore !== null) {
    return (
      <div className="flex flex-col items-center text-center">
        <ProgressRing
          value={interviews.latestScore}
          ariaLabel={`Latest interview score ${interviews.latestScore}%`}
        />
        <p className="mt-4 text-[13px] font-semibold text-cream/72">Latest score</p>
        <p className="mt-1 text-[12px] text-cream/42">
          {interviews.completedRounds} completed{" "}
          {interviews.completedRounds === 1 ? "round" : "rounds"}
        </p>
      </div>
    );
  }

  if (interviews.state === "resume") {
    return (
      <div className="flex flex-col items-center text-center">
        <span className="grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]">
          <Play size={24} fill="currentColor" strokeWidth={1.6} aria-hidden="true" />
        </span>
        <p className="mt-4 text-[14px] font-semibold text-cream/80">Round in progress</p>
        <p className="mt-1 text-[12px] text-cream/42">Your answers are saved</p>
      </div>
    );
  }

  if (interviews.state === "unavailable") {
    return (
      <div className="flex flex-col items-center text-center">
        <span className="grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full bg-cream/[0.055] text-cream/54">
          <Mic2 size={25} strokeWidth={1.6} aria-hidden="true" />
        </span>
        <p className="mt-4 text-[14px] font-semibold text-cream/80">Try again shortly</p>
        <p className="mt-1 text-[12px] text-cream/42">Your saved rounds are safe</p>
      </div>
    );
  }

  const steps = ["Choose your focus", "Answer naturally", "Review the evidence"];

  return (
    <div className="mx-auto w-full max-w-[14.5rem]">
      <p className="text-[12px] text-cream/42">How it works</p>
      {/* A plain numbered list: no circles or connecting lines, so it reads
          as part of the card. The first step carries the accent. */}
      <ol className="mt-3 space-y-2.5" aria-label="Interview steps">
        {steps.map((step, index) => (
          <li key={step} className="flex items-baseline gap-3">
            <span
              className={`w-3 shrink-0 text-[13px] font-semibold tabular-nums ${
                index === 0 ? "text-[var(--workspace-accent)]" : "text-cream/30"
              }`}
            >
              {index + 1}
            </span>
            <p
              className={`min-w-0 text-[14px] font-medium ${
                index === 0 ? "text-cream/85" : "text-cream/55"
              }`}
            >
              {step}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function DashboardAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-cream px-3.5 text-[13.5px] font-semibold text-[#191a1d] transition hover:bg-cream/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)]"
    >
      {label}
      <ArrowRight
        size={15}
        aria-hidden="true"
        className="transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}
