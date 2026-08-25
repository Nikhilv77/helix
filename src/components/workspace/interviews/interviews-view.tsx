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
  Play,
  Rocket
} from "lucide-react";
import { DocumentTitle } from "@/components/document-title";
import {
  interviewRoadmapSessions,
  roadmapSessionHref,
  type InterviewRoadmapSession
} from "@/lib/interviews/interview-roadmap-sessions";
import type { PersonalizedInterviewPlan } from "@/lib/interviews/personalized-plan";
import type { FrontendRoadmapHome } from "@/lib/roadmap/roadmap";
import type { CandidateProfile, InterviewHistoryItem } from "@/lib/shared/types";

interface InterviewsViewProps {
  quota: { used: number; limit: number };
  sessions: InterviewHistoryItem[];
  profile: CandidateProfile;
  personalizedPlan: PersonalizedInterviewPlan | null;
  roadmap: FrontendRoadmapHome | null;
}

const sessionIcons: Record<string, LucideIcon> = {
  "frontend-dsa": CodeXml,
  "javascript-react-core": Atom,
  "computer-fundamentals": Cpu,
  "production-ui-quality": CircleGauge,
  "resume-behavioral-defense": BadgeCheck,
  "final-frontend-mock": Rocket,
  "problem-solving": CodeXml,
  "core-technical": Atom,
  "applied-engineering": Cpu,
  "architecture-system-design": CircleGauge,
  "final-mock": Rocket
};

export function InterviewsView({
  quota,
  sessions,
  profile,
  personalizedPlan,
  roadmap
}: InterviewsViewProps) {
  const remaining = Math.max(0, quota.limit - quota.used);
  const exhausted = remaining === 0;
  const active = sessions.find((session) => session.status === "in_progress");
  const roadmapSessions = interviewRoadmapSessions({
    personalizedPlan,
    roadmap,
    history: sessions
  });
  const firstName = profile.resume?.fullName?.trim().split(/\s+/)[0] ?? "";
  const introCopy = firstName
    ? `${firstName}, choose the interview session that feels most useful right now. Each round is shaped around your saved profile and a focused agenda, so you can practise with intent and leave knowing exactly what to sharpen next.`
    : "Choose the interview session that feels most useful right now. Each round is shaped around your saved profile and a focused agenda, so you can practise with intent and leave knowing exactly what to sharpen next.";
  const introWords = introCopy.split(" ");

  return (
    <main className="relative isolate mx-auto w-full max-w-[92rem] overflow-x-clip px-4 pb-20 pt-10 sm:px-8 sm:pt-14 lg:px-10 lg:pt-16">
      <DocumentTitle title="Interviews" />
      <span
        aria-hidden="true"
        className="interviews-accent-glow interviews-accent-glow-top pointer-events-none absolute -top-32 left-1/2 -z-10 h-[34rem] w-[48rem] -translate-x-1/2 rounded-full"
      />

      <section className="interviews-intro-in mx-auto max-w-3xl text-center">
        <p className="font-display text-[clamp(1.1rem,1.25vw,1.4rem)] font-medium leading-[1.55] tracking-normal text-cream">
          {introWords.map((word, index) => (
            <span
              key={`${word}-${index}`}
              className="interviews-intro-word"
              style={{ "--interview-word-delay": `${index * 22}ms` } as CSSProperties}
            >
              {word}
            </span>
          ))}
        </p>
        {active ? (
          <Link
            href={`/interview/voice?session=${active.sessionId}`}
            className="interviews-active-link group mt-6 inline-flex items-center gap-3 rounded-2xl bg-[#17181b]/90 px-4 py-3 text-left transition hover:-translate-y-0.5 hover:bg-[#1c1e22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)]"
          >
            <Play
              size={17}
              aria-hidden="true"
              fill="currentColor"
              className="shrink-0 text-[var(--workspace-accent)]"
            />
            <span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-cream/52">
                Round in progress
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-cream/82">
                Resume your interview
                <ArrowRight
                  size={15}
                  aria-hidden="true"
                  className="transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </span>
            </span>
          </Link>
        ) : null}
      </section>

      <section className="relative isolate mt-12 sm:mt-14" aria-label="Interview sessions">
        <div className="relative z-10 grid gap-x-8 gap-y-12 md:grid-cols-2 xl:grid-cols-3">
          {roadmapSessions.length ? (
            roadmapSessions.map((session, index) => (
              <RoadmapSessionCard
                key={session.id}
                session={session}
                disabled={exhausted && !active}
                delay={index * 70}
              />
            ))
          ) : (
            <p className="col-span-full rounded-2xl bg-[#17181b] px-5 py-8 text-center text-sm leading-6 text-cream/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
              Your teacher is still preparing your session plan. Please check back in a moment.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function RoadmapSessionCard({
  session,
  disabled,
  delay
}: {
  session: InterviewRoadmapSession;
  disabled: boolean;
  delay: number;
}) {
  const SessionIcon = sessionIcons[session.kind ?? session.id] ?? FileCode2;
  const statusLabel =
    session.attemptStatus === "in_progress"
      ? `${session.completedQuestions}/${session.totalQuestions} complete`
      : session.updatedPracticeAvailable
        ? "Completed · Updated round"
        : session.attemptStatus === "completed"
          ? "Completed"
          : session.attemptStatus === "expired"
            ? "Previous attempt saved"
            : null;
  const actionLabel = session.resumeSessionId
    ? "Resume session"
    : session.updatedPracticeAvailable
      ? "Try updated session"
      : session.attemptStatus === "completed"
        ? "Practice again"
        : session.attemptStatus === "expired"
          ? "Start again"
          : "Start session";

  return (
    <Link
      href={disabled ? "#" : roadmapSessionHref(session)}
      aria-disabled={disabled}
      style={{ "--interview-delay": `${delay}ms` } as CSSProperties}
      className={[
        "interview-session-card group relative flex min-h-[28rem] flex-col rounded-[2rem] p-7 text-left transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/35 lg:p-8",
        disabled ? "pointer-events-none opacity-45" : ""
      ].join(" ")}
    >
      <span className="interview-session-icon flex h-20 w-20 items-center justify-center rounded-[1.45rem] lg:h-24 lg:w-24">
        <SessionIcon size={40} strokeWidth={1.45} aria-hidden="true" />
      </span>

      <h2 className="mt-16 max-w-[17rem] font-display text-[1.5rem] font-semibold leading-[1.2] tracking-normal text-cream sm:text-[1.65rem]">
        {session.title}
      </h2>
      <p className="mt-4 max-w-[19rem] text-base leading-7 text-cream/72">{session.purpose}</p>

      {statusLabel ? (
        <span className="mt-5 w-fit rounded-full border border-[color-mix(in_srgb,var(--workspace-accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--workspace-accent)_9%,transparent)] px-3 py-1.5 text-[11px] font-medium text-cream/68">
          {statusLabel}
        </span>
      ) : null}

      {session.durationMinutes || session.difficulty ? (
        <div className="mt-5 flex flex-wrap items-center gap-2">
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

      <div className="relative z-10 mt-auto pt-9">
        <span className="interview-session-link inline-flex items-center gap-2 text-base font-medium text-cream/88 transition-colors group-hover:text-cream">
          {actionLabel}
          <ArrowRight
            size={17}
            aria-hidden="true"
            className="transition-transform duration-300 group-hover:translate-x-1"
          />
        </span>
      </div>
    </Link>
  );
}
