import Link from "next/link";
import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Atom,
  BadgeCheck,
  CircleGauge,
  Clock3,
  CodeXml,
  Cpu,
  FileCode2,
  Rocket
} from "lucide-react";
import { DocumentTitle } from "@/components/document-title";
import { PracticeWeeklyActivityChart } from "@/components/workspace/shared/practice-weekly-activity-chart";
import type { PracticeRoadmapHome, PracticeRoadmapSession } from "@/lib/practice/practice-roadmap";
import type { WorkspaceInsights } from "@/lib/shared/types";

const sessionIcons: Record<string, LucideIcon> = {
  "dsa": CodeXml,
  "resume-behavioral-defense": BadgeCheck,
  "core-technical": Atom,
  "applied-engineering": Cpu,
  "architecture-system-design": CircleGauge,
  "final-mock": Rocket
};

export function PracticeSessionsView({
  practiceRoadmap,
  insights = null,
  activity = [],
  generationFailed = false
}: {
  practiceRoadmap: PracticeRoadmapHome | null;
  insights?: WorkspaceInsights | null;
  activity?: Array<{ date: string; solved: number }>;
  generationFailed?: boolean;
}) {
  const sessions = practiceRoadmap?.sessions ?? [];
  const totalQuestions = sessions.reduce((total, session) => total + session.totalQuestions, 0);
  const completedQuestions = sessions.reduce(
    (total, session) => total + session.completedQuestions,
    0
  );
  return (
    <main className="relative isolate mx-auto flex w-full max-w-[92rem] flex-col overflow-x-clip px-4 pb-20 pt-10 sm:px-8 sm:pt-14 lg:px-10 lg:pt-16">
      <DocumentTitle title="Practice" />

      <section
        className="interviews-intro-in order-2 mt-12 md:order-1 md:mt-0"
        aria-label="Practice overview"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:gap-5 xl:grid-cols-4">
          <PracticeActivityCard
            activity={activity}
            hasCompletedQuestions={completedQuestions > 0}
          />
          <PracticeSummaryCard
            text={
              completedQuestions
                ? "Keep your practice momentum going"
                : "Start your practice momentum"
            }
            detail={
              totalQuestions
                ? completedQuestions
                  ? `You’ve solved ${completedQuestions} question${completedQuestions === 1 ? "" : "s"} so far. ${Math.max(totalQuestions - completedQuestions, 0)} questions are waiting in your practice path.`
                  : `${totalQuestions} questions are waiting in your practice path. Your first completed question starts the momentum.`
                : null
            }
          />
          <PracticeSummaryCard
            text={
              insights?.strongest
                ? `Strongest point: ${insights.strongest.label}`
                : "Finish an interview to see your strongest point"
            }
            detail={
              insights?.strongest
                ? "This is the signal you demonstrate most consistently."
                : "Your interview reports will surface the strength you show most consistently."
            }
          />
          <PracticeSummaryCard
            text={
              insights?.recommendedFocus
                ? `Weakest point: ${insights.recommendedFocus.label}`
                : "Finish an interview to see your weakest point"
            }
            detail={
              insights?.recommendedFocus
                ? "Keep working on this to make your answers land more clearly."
                : "Your interview reports will highlight the point to focus on next."
            }
          />
        </div>
      </section>

      <section
        className="relative isolate order-1 md:order-2 md:mt-12 lg:mt-14"
        aria-label="Practice sessions"
      >
        <div className="relative z-10 grid gap-y-4">
          {sessions.length ? (
            sessions.map((session, index) => (
              <PracticeSessionCard key={session.key} session={session} delay={index * 70} />
            ))
          ) : (
            <p
              className="col-span-full rounded-2xl bg-[#17181b] px-5 py-8 text-center text-sm leading-6 text-cream/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
              role={generationFailed ? "alert" : "status"}
            >
              {generationFailed
                ? "We couldn’t prepare your practice path. Your saved progress is safe; refresh to try again."
                : "Your teacher is still preparing your practice path. Please check back in a moment."}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function PracticeActivityCard({
  activity,
  hasCompletedQuestions
}: {
  activity: Array<{ date: string; solved: number }>;
  hasCompletedQuestions: boolean;
}) {
  if (!hasCompletedQuestions) {
    return (
      <div className="flex min-h-52 flex-col items-start justify-center gap-3 rounded-[1.45rem] bg-[#17181b] px-5 py-6 sm:px-6">
        <p className="font-display text-lg font-semibold leading-snug text-cream">
          Your weekly rhythm starts with one solved question.
        </p>
        <p className="text-sm leading-5 text-cream/54">
          Finish any Practice question and your activity will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-52 items-center rounded-[1.45rem] bg-[#17181b] px-5 py-6 sm:px-6">
      <PracticeWeeklyActivityChart activity={activity} />
    </div>
  );
}

function PracticeSummaryCard({ text, detail = null }: { text: string; detail?: string | null }) {
  return (
    <div className="flex min-h-52 flex-col items-start justify-center gap-5 rounded-[1.45rem] bg-[#17181b] px-5 py-6 sm:px-6">
      <p className="font-display text-lg font-semibold leading-snug text-cream">{text}</p>
      {detail ? <p className="text-sm leading-5 text-cream/54">{detail}</p> : null}
    </div>
  );
}

function PracticeSessionCard({
  session,
  delay
}: {
  session: PracticeRoadmapSession;
  delay: number;
}) {
  const SessionIcon = sessionIcons[session.key] ?? FileCode2;
  const href = session.href;
  const available = session.availability === "available" && Boolean(href);
  const statusLabel = available
    ? session.completedQuestions > 0
      ? `${session.completedQuestions}/${session.totalQuestions} complete`
      : `${session.totalQuestions} questions`
    : session.availability === "available"
      ? `${session.totalQuestions} questions · workspace coming next`
      : "Question bank coming next";
  const actionLabel = available
    ? session.completedQuestions > 0
      ? "Continue session"
      : "Start session"
    : "Coming soon";

  const unavailable = !available || !href;
  const content = (
    <>
      <span className="interview-session-icon flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.45rem] lg:h-24 lg:w-24">
        <SessionIcon size={40} strokeWidth={1.45} aria-hidden="true" />
      </span>

      <div className="min-w-0">
        <h2 className="max-w-[28rem] font-display text-[1.5rem] font-semibold leading-[1.2] tracking-normal text-cream sm:text-[1.65rem]">
          {session.title}
        </h2>
        <p className="mt-4 max-w-[42rem] text-base leading-7 text-cream/72">{session.purpose}</p>

        {statusLabel ? (
          <span className="mt-5 inline-block rounded-full border border-[color-mix(in_srgb,var(--workspace-accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--workspace-accent)_9%,transparent)] px-3 py-1.5 text-[11px] font-medium text-cream/68">
            {statusLabel}
          </span>
        ) : null}

        {session.covers.length ? (
          <ul className="mt-5 flex flex-wrap gap-2" aria-label="Session topics">
            {session.covers.slice(0, 4).map((topic) => (
              <li
                key={topic}
                className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[11px] text-cream/48"
              >
                {topic}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-end gap-5 md:flex-col md:items-end md:justify-between md:self-stretch">
        {session.durationMinutes || session.difficulty ? (
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            {session.durationMinutes ? (
              <span className="pill inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-cream/55">
                <Clock3 size={11} aria-hidden="true" /> {session.durationMinutes} min
              </span>
            ) : null}
            {session.difficulty ? (
              <span className="pill px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-cream/55">
                {session.difficulty}
              </span>
            ) : null}
          </div>
        ) : null}

        <span className="interview-session-link inline-flex items-center gap-2 text-base font-medium text-cream/88 transition-colors group-hover:text-cream">
          {actionLabel}
          {!unavailable ? (
            <ArrowRight
              size={17}
              aria-hidden="true"
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          ) : null}
        </span>
      </div>
    </>
  );
  const className = [
    "interview-session-card group relative grid min-h-[13rem] gap-6 rounded-[2rem] p-7 text-left transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/35 md:grid-cols-[5rem_minmax(0,1fr)_auto] md:gap-7 lg:grid-cols-[6rem_minmax(0,1fr)_auto] lg:p-8",
    unavailable ? "cursor-not-allowed opacity-45" : ""
  ].join(" ");
  const style = { "--interview-delay": `${delay}ms` } as CSSProperties;

  if (unavailable || !href) {
    return (
      <article aria-disabled="true" className={className} style={style}>
        {content}
      </article>
    );
  }

  return (
    <Link href={href} className={className} style={style}>
      {content}
    </Link>
  );
}
