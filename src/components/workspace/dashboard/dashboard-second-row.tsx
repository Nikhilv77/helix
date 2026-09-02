import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Braces, Mic2, Play } from "lucide-react";
import type {
  DashboardContinuation,
  DashboardInterviewContinuation,
  DashboardPracticeContinuation
} from "@/lib/dashboard/dashboard-overview";
import { DashboardScoreRing } from "./dashboard-score-ring";

export function DashboardSecondRow({ data }: { data: DashboardContinuation }) {
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
        <CardLabel icon={<Braces size={19} strokeWidth={1.8} aria-hidden="true" />}>
          Practice
        </CardLabel>

        <h2 className="mt-4 max-w-[27rem] text-[1.3rem] font-semibold leading-tight tracking-[-0.025em] text-cream">
          {practice.title}
        </h2>
        <p className="mt-2 max-w-[32rem] text-[13px] leading-5 text-cream/50">{practice.detail}</p>

        <div className="mt-auto pt-4">
          <DashboardAction href={practice.actionHref} label={practice.actionLabel} />
        </div>
      </div>

      <div className="m-2.5 mt-0 flex min-h-[11rem] rounded-[1.3rem] bg-black/20 p-4 sm:ml-0 sm:mt-2.5">
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
        <CardLabel icon={<Mic2 size={19} strokeWidth={1.8} aria-hidden="true" />}>
          Interviews
        </CardLabel>

        <h2 className="mt-4 max-w-[27rem] text-[1.3rem] font-semibold leading-tight tracking-[-0.025em] text-cream">
          {interviews.title}
        </h2>
        <p className="mt-2 max-w-[32rem] text-[13px] leading-5 text-cream/50">
          {interviews.detail}
        </p>

        <div className="mt-auto pt-4">
          <DashboardAction href={interviews.actionHref} label={interviews.actionLabel} />
        </div>
      </div>

      <div className="m-2.5 mt-0 flex min-h-[11rem] items-center justify-center rounded-[1.3rem] bg-black/20 p-4 sm:ml-0 sm:mt-2.5">
        <InterviewVisual interviews={interviews} />
      </div>
    </article>
  );
}

function CardLabel({ children, icon }: { children: string; icon: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-cream/[0.055] text-cream/68">
        {icon}
      </span>
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-cream/42">
        {children}
      </p>
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
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cream/34">
        A note from your teacher
      </p>
      <p className="mx-auto mt-4 max-w-[14.5rem] text-[12.5px] font-medium leading-5 text-cream/72">
        {practice.teacherAdvice}
      </p>

      <div className="mx-auto mt-5 w-full max-w-[14.5rem]">
        {hasProgress ? (
          <>
            <div className="flex items-end justify-between gap-3">
              <span className="text-[11px] font-medium text-cream/42">Practice path</span>
              <span className="font-mono text-[14px] font-semibold text-cream/72">
                {practice.progressPercent}%
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-cream/[0.07]">
              <span
                className="block h-full rounded-full bg-[var(--workspace-accent)]"
                style={{ width: `${practice.progressPercent}%` }}
              />
            </div>
            <p className="mt-2 text-[10.5px] text-cream/36">
              {practice.completedQuestions} of {practice.totalQuestions} questions complete
            </p>
          </>
        ) : (
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-cream/30">
            {practice.statusLabel}
          </p>
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
        <p className="mt-4 text-[12px] font-semibold text-cream/68">Latest score</p>
        <p className="mt-1 text-[11px] text-cream/34">
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
        <p className="mt-4 text-[13px] font-semibold text-cream/76">Round in progress</p>
        <p className="mt-1 text-[11px] text-cream/34">Your answers are saved</p>
      </div>
    );
  }

  if (interviews.state === "unavailable") {
    return (
      <div className="flex flex-col items-center text-center">
        <span className="grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full bg-cream/[0.055] text-cream/54">
          <Mic2 size={25} strokeWidth={1.6} aria-hidden="true" />
        </span>
        <p className="mt-4 text-[13px] font-semibold text-cream/76">Try again shortly</p>
        <p className="mt-1 text-[11px] text-cream/34">Your saved rounds are safe</p>
      </div>
    );
  }

  const steps = ["Choose your focus", "Answer naturally", "Review the evidence"];

  return (
    <div className="mx-auto w-full max-w-[14.5rem]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cream/32">
        How it works
      </p>
      <ol className="mt-4" aria-label="Interview steps">
        {steps.map((step, index) => (
          <li key={step} className="relative flex items-center gap-3 pb-3 last:pb-0">
            {index < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute left-[0.85rem] top-7 h-[calc(100%-1.25rem)] w-px bg-cream/[0.07]"
              />
            ) : null}
            <span
              className={`relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold ${
                index === 0
                  ? "bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]"
                  : "bg-[#202124] text-cream/40"
              }`}
            >
              {index + 1}
            </span>
            <p className="min-w-0 text-[11.5px] font-medium text-cream/62">{step}</p>
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
      className="group inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-cream px-3.5 text-[12.5px] font-semibold text-[#191a1d] transition hover:bg-cream/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)]"
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
