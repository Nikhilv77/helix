import Link from "next/link";
import type { CSSProperties } from "react";
import { Atom, Check, CodeXml, Network, Server, Wrench } from "lucide-react";
import { LinkPendingIcon } from "@/components/workspace/shared/back-link-icon";
import { DocumentTitle } from "@/components/document-title";
import { PracticeWeeklyActivityChart } from "@/components/workspace/shared/practice-weekly-activity-chart";
import type { DsaRecommendation } from "@/features/practice/dsa/domain/dsa-recommendation";
import type {
  AppliedEngineeringPracticeEntry,
  StoryPracticeEntry,
  ArchitectureDesignPracticeEntry,
  CoreTechnicalPracticeEntry,
  PracticeDisplaySession,
  PracticeRoadmapHome
} from "@/features/practice/shared/domain/practice-roadmap";

export function PracticeSessionsView({
  practiceRoadmap,
  activity = [],
  dsaRecommendation = null,
  dsaBlockCompletedQuestions = 0,
  coreTechnicalEntry = null,
  coreTechnicalTotals = null,
  appliedEngineeringEntry = null,
  appliedEngineeringTotals = null,
  architectureDesignEntry = null,
  architectureDesignTotals = null,
  generationFailed = false,
  storyProgressFailed = false,
  storyEntries = []
}: {
  practiceRoadmap: PracticeRoadmapHome | null;
  activity?: Array<{ date: string; solved: number }>;
  dsaRecommendation?: DsaRecommendation | null;
  dsaBlockCompletedQuestions?: number;
  coreTechnicalEntry?: CoreTechnicalPracticeEntry | null;
  coreTechnicalTotals?: { totalQuestions: number; completedQuestions: number } | null;
  appliedEngineeringEntry?: AppliedEngineeringPracticeEntry | null;
  appliedEngineeringTotals?: { totalQuestions: number; completedQuestions: number } | null;
  architectureDesignEntry?: ArchitectureDesignPracticeEntry | null;
  architectureDesignTotals?: { totalQuestions: number; completedQuestions: number } | null;
  generationFailed?: boolean;
  storyProgressFailed?: boolean;
  storyEntries?: StoryPracticeEntry[];
}) {
  const sessions = practiceRoadmap?.sessions ?? [];
  // AI/ML shows only story entries (no roadmap); frontend and data show DSA
  // plus their story entries; backend and full-stack show the Node.js tracks.
  const displaySessions: PracticeDisplaySession[] = [
    ...sessions,
    ...(coreTechnicalEntry ? [coreTechnicalEntry] : []),
    ...(appliedEngineeringEntry ? [appliedEngineeringEntry] : []),
    ...(architectureDesignEntry ? [architectureDesignEntry] : []),
    ...storyEntries
  ].sort((left, right) => left.order - right.order);
  const totalQuestions =
    sessions.reduce((total, session) => total + session.totalQuestions, 0) +
    (coreTechnicalTotals?.totalQuestions ?? 0) +
    (appliedEngineeringTotals?.totalQuestions ?? 0) +
    (architectureDesignTotals?.totalQuestions ?? 0) +
    storyEntries.reduce((total, session) => total + session.totalQuestions, 0);
  const completedQuestions =
    sessions.reduce((total, session) => total + session.completedQuestions, 0) +
    (coreTechnicalTotals?.completedQuestions ?? 0) +
    (appliedEngineeringTotals?.completedQuestions ?? 0) +
    (architectureDesignTotals?.completedQuestions ?? 0) +
    storyEntries.reduce((total, session) => total + session.completedQuestions, 0);
  return (
    <main className="practice-page relative isolate mx-auto flex w-full max-w-[92rem] flex-col overflow-x-clip px-4 pb-20 pt-10 sm:px-8 sm:pt-14 lg:px-10 lg:pt-16">
      <DocumentTitle title="Practice" />

      <section
        className="interviews-intro-in order-2 mt-12 md:order-1 md:mt-0"
        aria-label="Practice overview"
      >
        {storyProgressFailed ? (
          <p role="alert" className="mb-5 rounded-xl bg-[#17181b] px-4 py-3 text-sm text-cream/75">
            Your saved practice progress is temporarily unavailable. Your answers are safe; refresh
            to try again.
          </p>
        ) : null}
        {/* With other tracks still listed, the empty-state message never shows, so a
            failed roadmap (DSA) needs its own notice above the cards. */}
        {generationFailed && displaySessions.length > 0 ? (
          <p role="alert" className="mb-5 rounded-xl bg-[#17181b] px-4 py-3 text-sm text-cream/75">
            We couldn’t prepare your practice path. Your saved progress is safe; refresh to try
            again.
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:gap-5 xl:grid-cols-4">
          <PracticeActivityCard
            activity={activity}
            hasCompletedQuestions={completedQuestions > 0}
          />
          <PracticeSummaryCard
            text={
              dsaRecommendation
                ? `${dsaRecommendation.focusLabel} block`
                : completedQuestions
                  ? "Keep your practice momentum going"
                  : "Start your practice momentum"
            }
            detail={
              dsaRecommendation
                ? `${dsaBlockCompletedQuestions}/${dsaRecommendation.questions.length} current block · ${formatDuration(dsaRecommendation.minutes)}. Finish this focused set to unlock your next adaptive block.`
                : totalQuestions
                  ? completedQuestions
                    ? `You’ve solved ${completedQuestions} question${completedQuestions === 1 ? "" : "s"} so far. ${Math.max(totalQuestions - completedQuestions, 0)} questions are waiting in your practice path.`
                    : `${totalQuestions} questions are waiting in your practice path. Your first completed question starts the momentum.`
                  : null
            }
          />
          <PracticeSummaryCard
            text={
              dsaRecommendation?.strengthLabel
                ? `${dsaRecommendation.strengthLabel} is a strength`
                : dsaRecommendation
                  ? `Built for ${dsaRecommendation.targetLabel}`
                  : "Your target sets the practice bar"
            }
            detail={
              dsaRecommendation?.strengthLabel
                ? "The plan keeps this skill active while you strengthen the next one."
                : "The patterns and difficulty match your interview target."
            }
          />
          <PracticeSummaryCard
            text={
              dsaRecommendation ? `Why ${dsaRecommendation.focusLabel}` : "Why this comes first"
            }
            detail={
              dsaRecommendation
                ? dsaRecommendation.rationale
                : "Your starting assessment identifies the best place to begin."
            }
          />
        </div>
      </section>

      <section className="order-1 md:order-2 md:mt-12 lg:mt-14" aria-label="Practice sessions">
        {displaySessions.length ? (
          <div
            className={`grid gap-4 sm:grid-cols-2 lg:gap-5 ${trackGridColumns(displaySessions.length)}`}
          >
            {displaySessions.map((session, index) => (
              <TrackTile
                key={session.key}
                delay={80 + index * 60}
                roomy={displaySessions.length <= 4}
                track={describeTrack(
                  session,
                  dsaRecommendation,
                  dsaBlockCompletedQuestions,
                  session.key === "core-technical"
                    ? coreTechnicalTotals
                    : session.key === "applied-engineering"
                      ? appliedEngineeringTotals
                      : session.key.endsWith("architecture-design")
                        ? architectureDesignTotals
                        : null
                )}
              />
            ))}
          </div>
        ) : (
          <p
            className="rounded-2xl bg-[#17181b] px-5 py-8 text-center text-sm leading-6 text-cream/60"
            role={generationFailed ? "alert" : "status"}
          >
            {generationFailed
              ? "We couldn’t prepare your practice path. Your saved progress is safe; refresh to try again."
              : "Your teacher is still preparing your practice path. Please check back in a moment."}
          </p>
        )}
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

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

interface TrackView {
  key: string;
  icon: typeof CodeXml;
  title: string;
  purpose: string;
  meta: string | null;
  href: string | null;
  statusLabel: string;
  actionLabel: string;
  /** Ring fill, 0–100; null when the track cannot be opened yet. */
  percent: number | null;
  complete: boolean;
}

function describeTrack(
  session: PracticeDisplaySession,
  dsaRecommendation: DsaRecommendation | null,
  dsaBlockCompletedQuestions: number,
  /** Every block's questions for tracks that are worked one block at a time. */
  allBlocks: { totalQuestions: number; completedQuestions: number } | null
): TrackView {
  const recommendation = session.key === "dsa" ? dsaRecommendation : null;
  // Progress is the whole track, never just the current block.
  const useAllBlocks = Boolean(allBlocks && allBlocks.totalQuestions > 0);
  const completedQuestions = useAllBlocks
    ? allBlocks!.completedQuestions
    : session.completedQuestions;
  const totalQuestions = useAllBlocks ? allBlocks!.totalQuestions : session.totalQuestions;
  const icon =
    session.key === "backend-core-technical"
      ? Server
      : session.key.endsWith("core-technical")
        ? Atom
        : session.key.endsWith("applied-engineering")
          ? Wrench
          : session.key.endsWith("architecture-design")
            ? Network
            : CodeXml;
  const href = session.availability === "available" ? (session.href ?? null) : null;
  const available = Boolean(href);
  const availabilityLabel = "availabilityLabel" in session ? session.availabilityLabel : null;
  const statusLabel = available
    ? recommendation
      ? `${session.completedQuestions} solved overall · ${dsaBlockCompletedQuestions}/${recommendation.questions.length} current block`
      : completedQuestions > 0
        ? `${completedQuestions}/${totalQuestions} complete`
        : `${totalQuestions} questions`
    : session.availability === "available"
      ? `${session.totalQuestions} questions · workspace coming next`
      : (availabilityLabel ?? "Question bank coming next");
  const actionLabel = available
    ? session.completedQuestions > 0
      ? "Continue session"
      : "Start session"
    : availabilityLabel
      ? "Unavailable"
      : "Coming soon";
  const meta = [
    session.durationMinutes ? `${session.durationMinutes} min` : null,
    session.difficulty
      ? session.difficulty.slice(0, 1).toUpperCase() + session.difficulty.slice(1)
      : null
  ].filter(Boolean);
  // DSA's ring is everything solved against the full question library.
  const [done, total] = recommendation?.availableQuestions
    ? [session.completedQuestions, recommendation.availableQuestions]
    : [completedQuestions, totalQuestions];
  const percent =
    available && total > 0 ? Math.min(100, Math.round((done / total) * 100)) : available ? 0 : null;

  return {
    key: session.key,
    icon,
    title: session.title,
    purpose: session.purpose,
    meta: meta.length ? meta.join(" · ") : null,
    href,
    statusLabel,
    actionLabel,
    percent,
    complete: total > 0 && done >= total
  };
}

/** One track as a small tile led by its progress ring. */
/** At most three tracks per row; any extra tracks start the next row. */
function trackGridColumns(count: number): string {
  return count <= 2 ? "" : "lg:grid-cols-3";
}

function TrackTile({ track, delay, roomy }: { track: TrackView; delay: number; roomy: boolean }) {
  const Icon = track.icon;
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <ProgressRing percent={track.percent} complete={track.complete} />
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/[0.1] text-cream/80">
          <Icon size={28} strokeWidth={1.5} aria-hidden="true" />
        </span>
      </div>
      <h2
        className={`mt-5 line-clamp-2 font-semibold ${roomy ? "text-[1.15rem]" : "text-[1.05rem]"} leading-snug tracking-[-0.01em] text-cream`}
      >
        {track.title}
      </h2>
      <p className="mt-2 line-clamp-2 text-[13.5px] leading-5 text-cream/58">{track.purpose}</p>
      {track.meta ? <p className="mt-3 text-[13px] text-cream/48">{track.meta}</p> : null}
      <p className="mt-1 text-[12.5px] leading-5 text-cream/42">{track.statusLabel}</p>
      <span
        className={`mt-auto inline-flex items-center gap-1.5 pt-5 text-[14px] font-semibold ${
          track.href ? "text-[var(--workspace-accent)]" : "text-cream/48"
        }`}
      >
        {track.actionLabel}
        {track.href ? (
          <LinkPendingIcon
            direction="forward"
            size={15}
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          />
        ) : null}
      </span>
    </>
  );
  const className = `practice-reveal group flex flex-col rounded-2xl bg-[#17181b] ${
    roomy ? "min-h-[21rem] p-6 sm:p-7" : "min-h-[19rem] p-5 sm:p-6"
  }`;
  const style = { "--practice-delay": `${delay}ms` } as CSSProperties;

  if (!track.href) {
    return (
      <article
        aria-disabled="true"
        aria-label={`${track.title}. ${track.statusLabel}. ${track.actionLabel}`}
        className={`${className} cursor-not-allowed opacity-50`}
        style={style}
      >
        {content}
      </article>
    );
  }

  return (
    <Link
      href={track.href}
      className={`${className} transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)] motion-reduce:transition-none`}
      style={style}
    >
      {content}
    </Link>
  );
}

/**
 * A thick track with a rounded accent arc. pathLength="100" lets the arc read
 * straight off the percent.
 */
function ProgressRing({ percent, complete }: { percent: number | null; complete: boolean }) {
  const value = complete ? 100 : (percent ?? 0);
  const arc = `${value} 100`;
  return (
    <span
      className="relative grid h-24 w-24 shrink-0 place-items-center"
      role="progressbar"
      aria-label="Track progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <svg
        viewBox="0 0 96 96"
        className="absolute inset-0 h-full w-full -rotate-90"
        aria-hidden="true"
      >
        <circle
          className="practice-ring-track"
          cx="48"
          cy="48"
          r="39"
          fill="none"
          strokeWidth="10"
        />
        {value > 0 ? (
          <circle
            cx="48"
            cy="48"
            r="39"
            fill="none"
            stroke="var(--workspace-accent)"
            strokeWidth="10"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray={arc}
          />
        ) : null}
      </svg>
      {complete ? (
        <Check
          size={30}
          strokeWidth={1.8}
          aria-hidden="true"
          className="text-[var(--workspace-accent)]"
        />
      ) : (
        <span
          className="text-[1.45rem] font-semibold leading-none tracking-[-0.02em] tabular-nums text-cream"
          aria-hidden="true"
        >
          {percent === null ? "–" : `${value}%`}
        </span>
      )}
    </span>
  );
}
