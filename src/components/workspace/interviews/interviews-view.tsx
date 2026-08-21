import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Clock3, FileText, Mic, Play } from "lucide-react";
import { DocumentTitle } from "@/components/document-title";
import { InterviewSignal } from "@/components/brand/blueprint-art";
import { MayaStage } from "@/components/workspace/shared/maya/maya-stage";
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

export function InterviewsView({ quota, sessions, profile, roadmap }: InterviewsViewProps) {
  const remaining = Math.max(0, quota.limit - quota.used);
  const exhausted = remaining === 0;
  const active = sessions.find((session) => session.status === "in_progress");
  const roadmapSessions = roadmap?.sessions.length ? roadmap.sessions : fallbackRoadmapSessions();
  const resumeSession = findResumeRoadmapSession(roadmapSessions);
  const firstName = profile.resume?.fullName?.trim().split(/\s+/)[0] ?? "";
  const resumeHref = resumeSession ? roadmapSessionHref(resumeSession.id) : "/interview?resume=1";
  const heroHref = active ? `/interview/voice?session=${active.sessionId}` : resumeHref;
  const introCopy = firstName
    ? `${firstName}, pick a session and Maya will start from that exact work. No domain picker, no generic setup, just the next useful round.`
    : "Pick a session and Maya will start from that exact work. No domain picker, no generic setup, just the next useful round.";

  return (
    <div className="mx-auto w-full max-w-[82rem] px-5 pb-16 sm:px-8 lg:px-10">
      <DocumentTitle title="Interviews" />

      <section className="profile-motion relative mt-6 overflow-hidden rounded-[1.25rem] border border-cream/20 bg-cream/[0.035] p-5 text-cream sm:p-6 lg:p-7">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,28rem)] lg:items-stretch">
          <div className="flex max-w-3xl flex-col justify-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cream/45">
              Session interviews
            </p>
            <h1 className="mt-2 font-display text-[1.9rem] font-semibold leading-[1.08] tracking-normal text-cream sm:text-[2.35rem]">
              Choose a session, then start.
            </h1>
            <p className="mt-3 max-w-2xl text-[14.5px] leading-6 text-cream/62">{introCopy}</p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <PrimaryInterviewLink href={heroHref} disabled={exhausted && !active}>
                {active ? (
                  <>
                    <Play size={17} aria-hidden="true" fill="currentColor" />
                    Resume interview
                  </>
                ) : (
                  <>
                    <Mic size={17} aria-hidden="true" />
                    Start interview
                  </>
                )}
              </PrimaryInterviewLink>
              <SecondaryInterviewLink href={resumeHref} disabled={exhausted && !active}>
                <FileText size={17} aria-hidden="true" />
                Resume round
              </SecondaryInterviewLink>
            </div>
          </div>

          <TopMayaPreview speaking={Boolean(active)} />
        </div>
      </section>

      <section className="relative mt-8">
        <div className="flex flex-col gap-2 border-b border-cream/20 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-cream/42">
              Roadmap sessions
            </p>
            <p className="mt-1 text-[14.5px] leading-6 text-cream/58">
              Pick the track for this round. Maya will use its agenda and your saved profile.
            </p>
          </div>
          {roadmap?.title ? (
            <p className="max-w-sm text-left text-[13px] leading-5 text-cream/38 sm:text-right">
              {roadmap.title}
            </p>
          ) : null}
        </div>

        <div className="overflow-hidden">
          {roadmapSessions.length ? (
            roadmapSessions.map((session) => (
              <RoadmapSessionRow
                key={session.id}
                session={session}
                disabled={exhausted && !active}
              />
            ))
          ) : (
            <div className="py-9 text-center text-cream/58">
              Maya is still preparing your session plan. You can start a profile-wide round now.
            </div>
          )}
        </div>

        <div className="mt-7 rounded-[1.1rem] border border-cream/20 px-5 py-4 text-cream sm:flex sm:items-center sm:justify-between sm:gap-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cream/42">
              Resume interview
            </p>
            <p className="mt-1 text-[14.5px] leading-6 text-cream/58">
              Want Maya to question your actual resume instead? Start from the evidence there.
            </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:shrink-0">
            <SecondaryInterviewLink href={resumeHref} disabled={exhausted && !active}>
              <FileText size={17} aria-hidden="true" />
              Start resume round
            </SecondaryInterviewLink>
          </div>
        </div>
      </section>
    </div>
  );
}

function TopMayaPreview({ speaking }: { speaking: boolean }) {
  return (
    <div className="relative h-full min-h-[17rem] overflow-hidden rounded-2xl bg-cream/[0.055] backdrop-blur-xl sm:min-h-[20rem] lg:min-h-[23rem]">
      <InterviewSignal className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[15rem] w-[20rem] -translate-x-1/2 -translate-y-1/2 opacity-30 sm:h-[18rem] sm:w-[24rem] lg:h-[21rem] lg:w-[28rem] lg:opacity-40" />

      <div
        className="absolute inset-x-[-10%] bottom-[-4%] top-[-10%] z-10 sm:inset-x-[-6%] lg:inset-x-[-5%] xl:inset-x-[-2%]"
        style={{
          maskImage: "linear-gradient(180deg,#000 0%,#000 88%,transparent 100%)",
          WebkitMaskImage: "linear-gradient(180deg,#000 0%,#000 88%,transparent 100%)"
        }}
      >
        <MayaStage speaking={speaking} />
      </div>
    </div>
  );
}

function PrimaryInterviewLink({
  href,
  disabled,
  children
}: {
  href: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={disabled ? "#" : href}
      aria-disabled={disabled}
      className={[
        "inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-cream px-6 text-[14.5px] font-semibold text-[#101010] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/60 sm:min-w-[12rem]",
        disabled ? "pointer-events-none opacity-45" : "hover:bg-white"
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function SecondaryInterviewLink({
  href,
  disabled,
  children
}: {
  href: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={disabled ? "#" : href}
      aria-disabled={disabled}
      className={[
        "inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-cream/20 bg-cream/[0.04] px-6 text-[14.5px] font-semibold text-cream/78 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/45 sm:min-w-[12rem]",
        disabled ? "pointer-events-none opacity-45" : "hover:bg-cream/[0.09] hover:text-cream"
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function RoadmapSessionRow({
  session,
  disabled
}: {
  session: InterviewRoadmapSession;
  disabled: boolean;
}) {
  return (
    <Link
      href={disabled ? "#" : roadmapSessionHref(session.id)}
      aria-disabled={disabled}
      className={[
        "group grid gap-4 border-b border-cream/20 py-5 transition last:border-b-0 sm:grid-cols-[3.25rem_minmax(0,1fr)_auto] sm:items-center",
        disabled ? "pointer-events-none opacity-45" : "hover:bg-cream/[0.035]"
      ].join(" ")}
    >
      <span className="font-mono text-[1.35rem] leading-none text-cream/32">
        {String(session.order).padStart(2, "0")}
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="font-display text-[1.22rem] font-semibold tracking-normal text-cream sm:text-[1.35rem]">
            {session.title}
          </h2>
          <span className="rounded-full border border-cream/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.13em] text-cream/50">
            {session.progressPercent}% done
          </span>
        </div>
        <p className="mt-2 max-w-3xl text-[14px] leading-6 text-cream/54">{session.purpose}</p>
        <p className="mt-1.5 max-w-3xl text-[12.5px] leading-5 text-cream/36">
          {session.covers.slice(0, 2).join(" · ")}
        </p>
      </div>

      <div className="flex items-center gap-4 text-[13px] font-semibold text-cream/62 sm:justify-end">
        <span className="inline-flex items-center gap-1.5">
          <Clock3 size={15} aria-hidden="true" />
          {session.completedQuestions}/{session.totalQuestions || "—"}
        </span>
        <span className="inline-flex items-center gap-2 text-cream transition group-hover:translate-x-0.5">
          Start <ArrowRight size={16} aria-hidden="true" />
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

function findResumeRoadmapSession(
  sessions: InterviewRoadmapSession[]
): InterviewRoadmapSession | null {
  return (
    sessions.find((session) => session.id === "resume-behavioral-defense") ??
    sessions.find((session) => session.title.toLowerCase().includes("resume")) ??
    null
  );
}

function roadmapSessionHref(id: string): string {
  if (id === "frontend-dsa") return "/interview/dsa";
  const params = new URLSearchParams({ roadmapSession: id });
  return `/interview?${params.toString()}`;
}
