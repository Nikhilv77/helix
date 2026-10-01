import { sessionRoomHref } from "@/features/interviews/ui/shared/interview-room-navigation";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Atom,
  BadgeCheck,
  CircleGauge,
  CodeXml,
  Cpu,
  FileCode2,
  Play,
  Rocket
} from "lucide-react";
import { DocumentTitle } from "@/components/document-title";
import { RoadmapSessionCard as SharedRoadmapSessionCard } from "@/components/workspace/shared/roadmap-session-card";
import {
  roadmapSessionHref,
  type InterviewRoadmapSession
} from "@/features/interviews/domain/interview-roadmap-sessions";
import type { InterviewHistoryItem } from "@/lib/shared/types";
import type { InterviewReportFamily } from "@/features/interviews/domain/evaluation-profile";
import { NextRoundTime } from "./next-round-time";

interface InterviewsViewProps {
  quota: { used: number; limit: number };
  /** When today's limit is used, the moment the next round can start. */
  nextSessionAt?: number | null;
  sessions: InterviewHistoryItem[];
  firstName: string;
  roadmapSessions: InterviewRoadmapSession[];
  /** Latest round score per report family, as shown on Reports. */
  latestScores?: Partial<Record<InterviewReportFamily, number>>;
}

/**
 * Keyed by roadmap session id, plus the blueprint kinds that do not share one.
 *
 * Session ids and blueprint kinds now agree everywhere except `problem-solving`,
 * whose session is `frontend-dsa`; the duplicate entries this map used to carry
 * were the old template slugs before they were renamed.
 */
const sessionIcons: Record<string, LucideIcon> = {
  dsa: CodeXml,
  "problem-solving": CodeXml,
  "core-technical": Atom,
  "technical-deep-dive": Cpu,
  "applied-engineering": Cpu,
  "architecture-system-design": CircleGauge,
  "resume-behavioral-defense": BadgeCheck,
  "technical-project": Cpu,
  "system-design": CircleGauge,
  "hiring-manager-final": Rocket
};

/** Which Reports family each roadmap round is scored under. */
const sessionFamilies: Record<string, InterviewReportFamily> = {
  dsa: "dsa",
  "problem-solving": "dsa",
  "core-technical": "core-technical-projects",
  "technical-deep-dive": "core-technical-projects",
  "applied-engineering": "core-technical-projects",
  "technical-project": "core-technical-projects",
  "architecture-system-design": "system-design",
  "system-design": "system-design",
  "resume-behavioral-defense": "resume-behavioral",
  "hiring-manager-final": "hr-behavioral"
};

function familyScore(
  session: InterviewRoadmapSession,
  scores: Partial<Record<InterviewReportFamily, number>>
): number | null {
  const family = sessionFamilies[session.kind ?? session.id] ?? sessionFamilies[session.id];
  return family ? (scores[family] ?? null) : null;
}

export function InterviewsView({
  quota,
  nextSessionAt = null,
  sessions,
  firstName,
  roadmapSessions,
  latestScores = {}
}: InterviewsViewProps) {
  const remaining = Math.max(0, quota.limit - quota.used);
  const exhausted = remaining === 0;
  const isAvailable = (session: InterviewRoadmapSession) =>
    Boolean(roadmapSessionHref(session)) &&
    session.id !== "technical-project" &&
    !(exhausted && !session.resumeSessionId);
  // The next round to do: the first one not started yet, or once every round
  // has been tried, the one with the lowest latest score.
  const recommendedId =
    roadmapSessions.find(
      (session) => session.attemptStatus === "not_started" && isAvailable(session)
    )?.id ??
    roadmapSessions
      .filter((session) => isAvailable(session) && session.attemptStatus !== "in_progress")
      .map((session) => ({ id: session.id, score: familyScore(session, latestScores) }))
      .filter((entry): entry is { id: string; score: number } => entry.score !== null)
      .sort((left, right) => left.score - right.score)[0]?.id ??
    null;
  // Old generic sessions remain in history for reporting, but they no longer
  // have a valid room. Only the permanent round engines can be resumed.
  const active = sessions.find(
    (session) => session.status === "in_progress" && supportsResume(session)
  );
  const activeHref = active
    ? active.sessionId.startsWith("core-technical:")
      ? "/practice/core-technical"
      : active.sessionId.startsWith("applied-engineering:")
        ? "/practice/applied-engineering"
        : sessionRoomHref(active.sessionId, active.setup)
    : null;
  const introCopy = firstName
    ? `${firstName}, choose the interview session that feels most useful right now. Each round is shaped around your saved profile and a focused agenda, so you can practise with intent and leave knowing exactly what to sharpen next.`
    : "Choose the interview session that feels most useful right now. Each round is shaped around your saved profile and a focused agenda, so you can practise with intent and leave knowing exactly what to sharpen next.";
  const introWords = introCopy.split(" ");

  return (
    <main className="interviews-page relative isolate mx-auto w-full max-w-[76rem] overflow-x-clip px-4 pb-20 pt-10 sm:px-8 sm:pt-14 lg:px-10 lg:pt-16">
      <DocumentTitle title="Interviews" />
      <span
        aria-hidden="true"
        className="interviews-accent-glow interviews-accent-glow-top pointer-events-none absolute -top-24 left-1/2 -z-10 h-[24rem] w-[24rem] -translate-x-1/2 rounded-full sm:-top-32 sm:h-[34rem] sm:w-[48rem]"
      />

      <section className="mx-auto max-w-3xl text-center">
        <p
          aria-label={introCopy}
          className="font-display text-[clamp(1.1rem,1.25vw,1.4rem)] font-medium leading-[1.55] tracking-normal text-cream"
        >
          {introWords.map((word, index) => (
            <span
              key={`${word}-${index}`}
              aria-hidden="true"
              className="interviews-intro-word"
              style={{ "--interview-word-delay": `${index * 22}ms` } as CSSProperties}
            >
              {word}
            </span>
          ))}
        </p>
        {exhausted ? (
          <p className="mt-5 text-sm leading-6 text-cream/60">
            You&apos;ve used today&apos;s {quota.limit} interview rounds.{" "}
            {nextSessionAt ? (
              <>
                The next one opens <NextRoundTime at={nextSessionAt} />.
              </>
            ) : (
              "The next one opens within a day."
            )}{" "}
            Rounds already in progress can still be resumed.
          </p>
        ) : null}
        {active && activeHref ? (
          <Link
            href={activeHref}
            className="interviews-active-link interviews-active-row group mx-auto mt-7 flex max-w-xl items-center gap-4 rounded-2xl px-5 py-4 text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)]"
          >
            <span className="interview-roadmap-icon grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/[0.1] text-[var(--workspace-accent)]">
              <Play size={16} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-cream">Round in progress</span>
              <span className="mt-0.5 block text-[13px] text-cream/52">
                Pick up where you left off.
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-[var(--workspace-accent)]">
              Resume
              <ArrowRight
                size={16}
                strokeWidth={1.6}
                aria-hidden="true"
                className="transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </span>
          </Link>
        ) : null}
      </section>

      <section className="mt-12 sm:mt-14" aria-label="Interview sessions">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roadmapSessions.length ? (
            roadmapSessions.map((session, index) => (
              <RoadmapSessionCard
                key={session.id}
                session={session}
                limitReached={exhausted && !session.resumeSessionId}
                latestScore={familyScore(session, latestScores)}
                recommended={session.id === recommendedId}
                disabled={
                  (exhausted && !session.resumeSessionId) || session.id === "technical-project"
                }
                delay={index * 70}
              />
            ))
          ) : (
            <p className="interview-roadmap-card col-span-full rounded-2xl px-5 py-8 text-center text-sm leading-6 text-cream/60">
              Your teacher is still preparing your session plan. Please check back in a moment.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function supportsResume(session: InterviewHistoryItem): boolean {
  return Boolean(
    session.setup.resumeRound ||
    session.setup.fundamentalsRound ||
    session.setup.dsaQuestionSlugs?.length ||
    session.setup.dsaDesignRound?.kind === "dsa-design-round" ||
    session.setup.dsaBlockAssessment ||
    session.setup.storyPracticeAssessment
  );
}

function RoadmapSessionCard({
  session,
  limitReached,
  latestScore,
  recommended,
  disabled,
  delay
}: {
  session: InterviewRoadmapSession;
  limitReached: boolean;
  latestScore: number | null;
  recommended: boolean;
  disabled: boolean;
  delay: number;
}) {
  const href = roadmapSessionHref(session);
  const unavailable = disabled || !href;
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
  const actionLabel = limitReached
    ? "Daily limit reached"
    : unavailable
      ? "Coming soon"
      : session.resumeSessionId
        ? "Resume session"
        : session.updatedPracticeAvailable
          ? "Try updated session"
          : session.attemptStatus === "completed"
            ? "Practice again"
            : session.attemptStatus === "expired"
              ? "Start again"
              : session.id === "technical-project"
                ? "Coming soon"
                : "Start session";

  return (
    <SharedRoadmapSessionCard
      href={unavailable ? null : href}
      icon={SessionIcon}
      title={session.title}
      purpose={session.purpose}
      covers={session.covers}
      statusLabel={statusLabel}
      actionLabel={actionLabel}
      durationMinutes={session.durationMinutes}
      latestScore={session.attemptStatus === "not_started" ? null : latestScore}
      recommended={recommended && !unavailable}
      progressPercent={
        session.attemptStatus === "in_progress" && session.totalQuestions > 0
          ? Math.round((session.completedQuestions / session.totalQuestions) * 100)
          : null
      }
      difficulty={session.difficulty}
      disabled={unavailable}
      delay={delay}
    />
  );
}
