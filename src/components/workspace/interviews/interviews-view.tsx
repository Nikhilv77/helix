import Link from "next/link";
import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Atom,
  BadgeCheck,
  CircleGauge,
  CodeXml,
  FileCode2,
  Play,
  Rocket
} from "lucide-react";
import { DocumentTitle } from "@/components/document-title";
import { FRONTEND_SESSIONS } from "@/lib/roadmap/frontend-plan";
import type { FrontendRoadmapHome, FrontendRoadmapSession } from "@/lib/roadmap/roadmap";
import type { CandidateProfile, InterviewHistoryItem, WorkspaceInsights } from "@/lib/shared/types";

interface InterviewsViewProps {
  quota: { used: number; limit: number };
  sessions: InterviewHistoryItem[];
  profile: CandidateProfile;
  insights: WorkspaceInsights;
  roadmap: FrontendRoadmapHome | null;
  historyAvailable?: boolean;
}

type InterviewRoadmapSession = Pick<
  FrontendRoadmapSession,
  | "id"
  | "order"
  | "title"
  | "purpose"
  | "covers"
  | "totalQuestions"
  | "completedQuestions"
  | "progressPercent"
>;

const sessionIcons: Record<string, LucideIcon> = {
  "frontend-dsa": CodeXml,
  "javascript-react-core": Atom,
  "build-real-ui-features": FileCode2,
  "production-ui-quality": CircleGauge,
  "resume-behavioral-defense": BadgeCheck,
  "final-frontend-mock": Rocket
};

export function InterviewsView({ quota, sessions, profile, roadmap }: InterviewsViewProps) {
  const remaining = Math.max(0, quota.limit - quota.used);
  const exhausted = remaining === 0;
  const active = sessions.find((session) => session.status === "in_progress");
  const roadmapSessions = roadmap?.sessions.length ? roadmap.sessions : fallbackRoadmapSessions();
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
        <div className="relative z-10 grid gap-x-8 gap-y-12 md:grid-cols-2 xl:grid-cols-4">
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
              Maya is still preparing your session plan. Please check back in a moment.
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
  const SessionIcon = sessionIcons[session.id] ?? FileCode2;

  return (
    <Link
      href={disabled ? "#" : roadmapSessionHref(session.id)}
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

      <div className="relative z-10 mt-auto pt-9">
        <span className="interview-session-link inline-flex items-center gap-2 text-base font-medium text-cream/88 transition-colors group-hover:text-cream">
          Start session
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

function fallbackRoadmapSessions(): InterviewRoadmapSession[] {
  return FRONTEND_SESSIONS.map((session) => ({
    id: session.id,
    order: session.order,
    title: session.title,
    purpose: session.purpose,
    covers: session.covers,
    totalQuestions: session.id === "frontend-dsa" ? 123 : 0,
    completedQuestions: 0,
    progressPercent: 0
  }));
}

function roadmapSessionHref(id: string): string {
  if (id === "frontend-dsa") return "/interview/dsa";
  const params = new URLSearchParams({ roadmapSession: id });
  return `/interview?${params.toString()}`;
}
