"use client";

import Image from "next/image";
import { displayName } from "@/lib/shared/display-name";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  Check,
  ChevronRight,
  Clock3,
  HandHelping,
  Loader2,
  Star,
  UsersRound,
  X
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { DocumentTitle } from "@/components/document-title";
import { ProfileAvatar } from "@/features/profile/ui/profile-avatar";
import type {
  HelpHistoryItem,
  HelpHistoryPage,
  HelpHistoryParticipant,
  HelpHistorySide,
  HelpOverview,
  TopPeerHelper
} from "@/features/peer-help/contracts/help-history";
import { peerHelpRoomHref } from "@/features/peer-help/domain/help-room-navigation";
import { SafetyControls } from "./safety-controls";

const STATUS_COPY: Record<HelpHistoryItem["status"], string> = {
  OPEN: "Waiting for a peer",
  CLAIMED: "In progress",
  RESOLVED: "Completed",
  EXPIRED: "Expired",
  CANCELLED: "Withdrawn"
};

const BADGE_LEVELS = [
  { label: "New Trailmate", threshold: 0, description: "Your starting place in the community." },
  { label: "First Assist", threshold: 1, description: "One positive conversation." },
  {
    label: "Trusted Mate",
    threshold: 10,
    description: "Ten conversations that made a difference."
  },
  { label: "Trail Guide", threshold: 25, description: "Twenty-five positive conversations." }
] as const;

type HistoryCollection = Record<HelpHistorySide, HelpHistoryPage>;
type HistoryErrors = Record<HelpHistorySide, string | null>;

export function HelpHub({
  initialOverview,
  initialReceivedHistory,
  initialGivenHistory
}: {
  initialOverview: HelpOverview;
  initialReceivedHistory: HelpHistoryPage;
  initialGivenHistory: HelpHistoryPage;
}) {
  const [overview, setOverview] = useState(initialOverview);
  const [histories, setHistories] = useState<HistoryCollection>({
    received: initialReceivedHistory,
    given: initialGivenHistory
  });
  const [loadingMore, setLoadingMore] = useState<HelpHistorySide | null>(null);
  const [historyErrors, setHistoryErrors] = useState<HistoryErrors>({
    received: null,
    given: null
  });
  const [badgeOpen, setBadgeOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const historyRequests = useRef<Record<HelpHistorySide, number>>({ received: 0, given: 0 });
  const activeRequestId = overview.activeConversation?.requestId ?? null;

  const loadHistory = useCallback(async (side: HelpHistorySide, cursor: string | null = null) => {
    const requestId = ++historyRequests.current[side];
    if (cursor) setLoadingMore(side);
    setHistoryErrors((current) => ({ ...current, [side]: null }));

    try {
      const query = new URLSearchParams({ side });
      query.set("status", "resolved");
      if (cursor) query.set("cursor", cursor);
      const response = await fetch(`/api/help/history?${query.toString()}`);
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error?.message ?? "Could not load Trailmate history.");
      }
      if (requestId !== historyRequests.current[side]) return;

      const nextPage = payload.data as HelpHistoryPage;
      setHistories((current) => ({
        ...current,
        [side]: cursor
          ? {
              items: [...current[side].items, ...nextPage.items],
              nextCursor: nextPage.nextCursor
            }
          : nextPage
      }));
    } catch (error) {
      if (requestId !== historyRequests.current[side]) return;
      setHistoryErrors((current) => ({
        ...current,
        [side]: error instanceof Error ? error.message : "Could not load Trailmate history."
      }));
    } finally {
      if (requestId === historyRequests.current[side]) setLoadingMore(null);
    }
  }, []);

  useEffect(() => {
    if (!activeRequestId) return;
    let controller: AbortController | null = null;
    const refresh = async () => {
      if (document.visibilityState !== "visible" || controller) return;
      controller = new AbortController();
      const response = await fetch("/api/help/overview", { signal: controller.signal }).catch(
        () => null
      );
      const payload = await response?.json().catch(() => null);
      if (response?.ok && payload?.success && payload.data) setOverview(payload.data);
      controller = null;
    };
    const refreshVisible = () => {
      if (document.visibilityState === "visible") void refresh();
      else controller?.abort();
    };
    const timer = window.setInterval(refreshVisible, 10_000);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
      controller?.abort();
    };
  }, [activeRequestId]);

  const modalOpen = badgeOpen || leaderboardOpen;
  useEffect(() => {
    if (!modalOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setBadgeOpen(false);
      setLeaderboardOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [modalOpen]);

  if (overview.activeConversation) {
    return <ActiveConversationView conversation={overview.activeConversation} />;
  }

  return (
    <main className="trailmate-page mx-auto w-full max-w-[88rem] px-4 pb-24 pt-8 sm:px-8 sm:pt-10 lg:px-10">
      <DocumentTitle title="Trailmate" />
      <h1 className="sr-only">Trailmate</h1>

      <UserRecognition overview={overview} onBadgeClick={() => setBadgeOpen(true)} />

      <TopHelpers
        helpers={overview.topHelpers}
        total={overview.topHelpersTotal ?? overview.topHelpers.length}
        onViewAll={() => setLeaderboardOpen(true)}
      />

      <RelationshipHistory
        id="people-helped"
        eyebrow="Your contribution"
        title="People you’ve supported"
        description="The peers you showed up for, and the problems you worked through together."
        side="given"
        page={histories.given}
        error={historyErrors.given}
        loadingMore={loadingMore === "given"}
        onLoadMore={() => void loadHistory("given", histories.given.nextCursor)}
        onSafetyAction={() => void loadHistory("given")}
      />

      <RelationshipHistory
        id="people-supported-you"
        eyebrow="Your circle"
        title="People who supported you"
        description="The peers who joined you when a problem needed another perspective."
        side="received"
        page={histories.received}
        error={historyErrors.received}
        loadingMore={loadingMore === "received"}
        onLoadMore={() => void loadHistory("received", histories.received.nextCursor)}
        onSafetyAction={() => void loadHistory("received")}
      />

      {badgeOpen ? (
        <BadgeRankingToast overview={overview} onClose={() => setBadgeOpen(false)} />
      ) : null}
      {leaderboardOpen ? <LeaderboardModal onClose={() => setLeaderboardOpen(false)} /> : null}
    </main>
  );
}

function UserRecognition({
  overview,
  onBadgeClick
}: {
  overview: HelpOverview;
  onBadgeClick: () => void;
}) {
  const badge = helperBadge(overview.positiveHelps);
  return (
    <header className="flex flex-col items-center border-b border-white/[0.14] pb-10 text-center sm:pb-12">
      <div className="relative grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-black shadow-[0_18px_50px_-24px_rgba(0,0,0,0.9)] sm:h-28 sm:w-28">
        <PeerAvatar participant={overview.viewer} className="h-full w-full rounded-full" />
      </div>
      <p className="mt-4 text-lg font-semibold tracking-[-0.01em] text-cream">
        {displayName(overview.viewer.label)}
      </p>
      <p className="mt-1 text-[13px] text-cream/45">
        {overview.peopleHelped
          ? `Supported ${overview.peopleHelped} ${overview.peopleHelped === 1 ? "person" : "people"}`
          : "Ready to help"}
      </p>
      <button
        type="button"
        onClick={onBadgeClick}
        aria-haspopup="dialog"
        className="group mt-4 inline-flex items-center gap-2 rounded-full border border-white/[0.2] bg-black px-3.5 py-2 text-[12px] font-semibold text-cream/75 transition hover:border-white/35 hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/40"
      >
        <Award size={14} strokeWidth={1.8} className="text-white/85" aria-hidden="true" />
        {badge.label}
        <ChevronRight
          size={13}
          className="text-cream/35 transition group-hover:translate-x-0.5 group-hover:text-cream/60"
          aria-hidden="true"
        />
      </button>
    </header>
  );
}

/**
 * The Trailmate dialogs share the delete-account dialog's look: a clean white
 * card (graphite in dark mode) over a soft dimmed backdrop, an outlined icon
 * tile, a small accent label, a large title, and plain rows inside. No blur:
 * blurring the whole page behind a dialog is costly on low-end devices.
 */
const MODAL_BACKDROP =
  "fixed inset-0 z-[9999] flex min-h-dvh items-center justify-center overflow-y-auto bg-[#10141c]/55 px-4 py-6 dark:bg-black/65";
const MODAL_CARD =
  "my-auto w-full rounded-[1.5rem] bg-white text-[#20232a] shadow-[0_30px_90px_-24px_rgba(8,12,20,0.4)] outline-none dark:bg-[#202124] dark:text-[#f4f1eb] dark:shadow-[0_32px_100px_-22px_rgba(0,0,0,0.8)]";
const MODAL_MUTED = "text-[#667085] dark:text-[#b4b4ba]";

function ModalHeader({
  icon: Icon,
  label,
  title,
  titleId,
  closeLabel,
  onClose
}: {
  icon: typeof Award;
  label: string;
  title: string;
  titleId: string;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <span className="grid h-11 w-11 place-items-center rounded-xl border border-[#20232a]/[0.1] text-[#475569] dark:border-white/[0.1] dark:text-[#c2c2c7]">
          <Icon size={18} strokeWidth={1.6} aria-hidden="true" />
        </span>
        <p className="mt-5 text-[13px] font-medium text-[var(--workspace-accent)]">{label}</p>
        <h2
          id={titleId}
          className="mt-1 text-[1.55rem] font-semibold leading-tight tracking-[-0.035em]"
        >
          {title}
        </h2>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#667085] transition-colors hover:bg-[#f1f3f5] hover:text-[#20232a] dark:text-[#b4b4ba] dark:hover:bg-white/[0.07] dark:hover:text-white"
      >
        <X size={17} strokeWidth={1.6} aria-hidden="true" />
      </button>
    </div>
  );
}

function BadgeRankingToast({ overview, onClose }: { overview: HelpOverview; onClose: () => void }) {
  const current = helperBadge(overview.positiveHelps);
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={MODAL_BACKDROP}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="badge-ranking-title"
        className={`${MODAL_CARD} max-w-[27rem] p-6 sm:p-7`}
      >
        <ModalHeader
          icon={Award}
          label="Your badge"
          title={current.label}
          titleId="badge-ranking-title"
          closeLabel="Close badge ranking"
          onClose={onClose}
        />
        <p className={`mt-3 text-[0.9rem] leading-[1.6] ${MODAL_MUTED}`}>{current.detail}</p>

        <ol className="mt-6 space-y-1">
          {BADGE_LEVELS.map((level) => {
            const earned = overview.positiveHelps >= level.threshold;
            const active = level.label === current.label;
            return (
              <li
                key={level.label}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                  active ? "bg-[var(--workspace-accent-soft)]" : ""
                }`}
              >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold tabular-nums ${
                    earned
                      ? "bg-[var(--workspace-accent)] text-white"
                      : "border border-[#20232a]/[0.12] text-[#667085] dark:border-white/[0.12] dark:text-[#b4b4ba]"
                  }`}
                >
                  {earned ? (
                    <Check size={13} strokeWidth={2.2} aria-hidden="true" />
                  ) : (
                    level.threshold
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold">{level.label}</p>
                  <p className={`mt-0.5 text-[12.5px] ${MODAL_MUTED}`}>{level.description}</p>
                </div>
                {active ? (
                  <span className="text-[12px] font-medium text-[var(--workspace-accent)]">
                    Current
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>

        {overview.availabilityCredits ? (
          <p className={`mt-5 text-[12.5px] leading-5 ${MODAL_MUTED}`}>
            You also have {overview.availabilityCredits} waiting credit
            {overview.availabilityCredits === 1 ? "" : "s"} for showing up when a learner did not
            join.
          </p>
        ) : null}
      </section>
    </div>,
    document.body
  );
}

export function ActiveConversationView({
  conversation
}: {
  conversation: NonNullable<HelpOverview["activeConversation"]>;
}) {
  return (
    <main className="trailmate-page mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-[76rem] place-items-center px-4 py-12 sm:px-8">
      <DocumentTitle title="Trailmate" />
      <section className="w-full rounded-[1.5rem] border border-white/[0.18] bg-black p-6 sm:p-9">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex min-w-0 items-start gap-4">
            <PeerAvatar participant={conversation.peer} className="h-14 w-14 rounded-full" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cream/38">
                {conversation.started ? "Session in progress" : "Private room ready"}
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-cream sm:text-3xl">
                With {conversation.peer.label}
              </h1>
              <p className="mt-2 text-sm leading-6 text-cream/48">
                {conversation.title} · {conversation.language}
              </p>
              {conversation.peer.headline ? (
                <p className="mt-3 max-w-xl text-sm leading-6 text-cream/58">
                  {conversation.peer.headline}
                </p>
              ) : null}
            </div>
          </div>
          <Link
            href={peerHelpRoomHref(conversation.requestId, "/trailmate")}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-cream px-5 text-sm font-semibold text-[#17181a] transition hover:bg-white"
          >
            <UsersRound size={16} aria-hidden="true" />
            {conversation.started ? "Resume session" : "Join session"}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}

function TopHelpers({
  helpers,
  total,
  onViewAll
}: {
  helpers: TopPeerHelper[];
  total: number;
  onViewAll: () => void;
}) {
  return (
    <section className="mt-12 sm:mt-14" aria-labelledby="top-helpers-title">
      <SectionHeading
        eyebrow="Community"
        id="top-helpers-title"
        title="Top Trailmates"
        description="People consistently making practice easier for others."
      />
      {helpers.length ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {helpers.map((helper, index) => {
            const appreciation = helper.helpedCount
              ? Math.round((helper.thankedCount / helper.helpedCount) * 100)
              : 0;
            return (
              <article
                key={`${helper.participant.label}-${index}`}
                className="trailmate-ranking-card group rounded-[1.25rem] bg-[#17181b] p-4 transition-colors hover:bg-[#1b1c20] sm:p-5"
              >
                <div className="flex items-start gap-3.5">
                  <PeerAvatar
                    participant={helper.participant}
                    className="h-12 w-12 rounded-full ring-1 ring-white/10"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-cream">
                          {displayName(helper.participant.label)}
                        </p>
                        <p className="mt-1 line-clamp-2 min-h-10 text-[13px] leading-5 text-cream/50">
                          {helper.participant.headline ??
                            "A dependable peer in the practice community."}
                        </p>
                      </div>
                      <span className="shrink-0 pt-0.5 text-[13px] font-semibold tabular-nums text-cream/40">
                        #{index + 1}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 border-t border-white/[0.14] pt-4">
                  <HelperStat value={helper.helpedCount} label="People" />
                  <HelperStat value={helper.thankedCount} label="Thanks" bordered />
                  <HelperStat value={`${appreciation}%`} label="Impact" bordered />
                </div>
              </article>
            );
          })}
          {total > helpers.length ? <ViewAllTile total={total} onClick={onViewAll} /> : null}
        </div>
      ) : (
        <PreviewEmptyState
          preview={<RankingPreview />}
          title="Nobody’s on the board yet"
          message="Help one person through a problem and you could be the first Top Trailmate."
          footnote="First Assist → Trusted Mate → Trail Guide"
        />
      )}
    </section>
  );
}

function HelperStat({
  value,
  label,
  bordered = false
}: {
  value: number | string;
  label: string;
  bordered?: boolean;
}) {
  return (
    <div className={`text-center ${bordered ? "border-l border-white/[0.13]" : ""}`}>
      <p className="text-[1.1rem] font-semibold tabular-nums tracking-[-0.01em] text-cream/85">
        {value}
      </p>
      <p className="mt-0.5 text-[12px] text-cream/42">{label}</p>
    </div>
  );
}

function RelationshipHistory({
  id,
  eyebrow,
  title,
  description,
  side,
  page,
  error,
  loadingMore,
  onLoadMore,
  onSafetyAction
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  side: HelpHistorySide;
  page: HelpHistoryPage;
  error: string | null;
  loadingMore: boolean;
  onLoadMore: () => void;
  onSafetyAction: () => void;
}) {
  return (
    <section className="mt-14 sm:mt-16" aria-labelledby={id}>
      <SectionHeading eyebrow={eyebrow} id={id} title={title} description={description} />

      {error ? (
        <div
          role="alert"
          className="mt-5 rounded-2xl border border-[#ffb4b4]/35 bg-black px-5 py-4 text-sm text-[#ffb4b4]"
        >
          {error}
        </div>
      ) : page.items.length ? (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {page.items.map((item) => (
            <HistoryCard key={item.id} item={item} side={side} onSafetyAction={onSafetyAction} />
          ))}
        </div>
      ) : (
        <PreviewEmptyState
          preview={<HistoryPreview />}
          title={
            side === "given"
              ? "The people you support will appear here"
              : "The people who support you will appear here"
          }
          message={
            side === "given"
              ? "Mates are invited to questions they’ve already solved, so every question you solve is one more you can help with."
              : "Stuck on a question? Use Ask a mate beside Run code, and someone who solved it can join you."
          }
          action={{ href: "/practice", label: "Go to practice" }}
        />
      )}

      {page.nextCursor ? (
        <button
          type="button"
          disabled={loadingMore}
          onClick={onLoadMore}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.18] bg-black px-4 text-[12px] font-semibold text-cream/60 transition hover:border-white/30 hover:text-cream disabled:opacity-50"
        >
          {loadingMore ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
          Show more
        </button>
      ) : null}
    </section>
  );
}

function SectionHeading({
  id,
  title,
  description
}: {
  /** Kept for callers; no longer shown above the heading. */
  eyebrow?: string;
  id: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      <h2 id={id} className="text-2xl font-semibold tracking-[-0.02em] text-cream">
        {title}
      </h2>
      <p className="mt-1.5 text-[14px] leading-6 text-cream/55">{description}</p>
    </div>
  );
}

function HistoryCard({
  item,
  side,
  onSafetyAction
}: {
  item: HelpHistoryItem;
  side: HelpHistorySide;
  onSafetyAction: () => void;
}) {
  const participantLabel = item.participant?.label ?? "Trailgrad candidate";
  const relationship = side === "given" ? "You supported" : "Supported you";
  return (
    <article className="trailmate-history-card rounded-[1.25rem] bg-[#17181b] p-4 transition-colors hover:bg-[#1b1c20] sm:p-5">
      <div className="flex items-start gap-4">
        <ParticipantAvatar item={item} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-cream">
            {displayName(participantLabel)}
          </p>
          {item.participant?.headline ? (
            <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-cream/50">
              {item.participant.headline}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 pt-0.5 text-[12px] text-cream/42">{relationship}</span>
      </div>

      {/* The question, set off by a hairline like the stats row above, not a box. */}
      <div className="mt-4 border-t border-white/[0.13] pt-4">
        <p className="text-[12px] text-cream/42">Worked through</p>
        <Link
          href={item.question.href}
          aria-label={`Open ${item.question.title}`}
          className="group/question mt-1 flex items-center justify-between gap-4 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-cream/30"
        >
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold text-cream/88">
              {item.question.title}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-3 text-[12px] text-cream/42">
              <span>{item.question.topic}</span>
              <span>{item.language}</span>
            </span>
          </span>
          <ArrowRight
            size={16}
            strokeWidth={1.6}
            aria-hidden="true"
            className="shrink-0 text-cream/40 transition group-hover/question:translate-x-0.5 group-hover/question:text-cream"
          />
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12px] text-cream/42">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5 text-cream/52">
            <Check size={12} aria-hidden="true" /> {STATUS_COPY[item.status]}
          </span>
          <span>{formatDate(item.resolvedAt ?? item.askedAt)}</span>
          {item.sessionDurationMs !== null ? (
            <span className="inline-flex items-center gap-1">
              <Clock3 size={12} aria-hidden="true" /> {formatDuration(item.sessionDurationMs)}
            </span>
          ) : null}
        </div>
        {item.learnerRating ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#efcf84]/[0.08] px-2 py-1 font-semibold text-[#efcf84]">
            <Star size={11} fill="currentColor" aria-hidden="true" />
            {side === "given" ? `${item.learnerRating}/5` : "Thanked"}
          </span>
        ) : null}
      </div>

      {item.canReportOrBlock ? (
        <div className="mt-4 border-t border-white/[0.12] pt-3">
          <SafetyControls requestId={item.id} onActioned={onSafetyAction} />
        </div>
      ) : null}
    </article>
  );
}

function PeerAvatar({
  participant,
  className
}: {
  participant: HelpHistoryParticipant;
  className: string;
}) {
  if (participant.profileImage) {
    return (
      <Image
        src={participant.profileImage}
        alt=""
        width={112}
        height={112}
        className={`${className} shrink-0 object-cover`}
      />
    );
  }
  return (
    <ProfileAvatar name={participant.label} className={`${className} shrink-0 object-cover`} />
  );
}

function ParticipantAvatar({ item }: { item: HelpHistoryItem }) {
  if (item.participant) {
    return (
      <PeerAvatar
        participant={item.participant}
        className="h-12 w-12 rounded-full ring-1 ring-white/20"
      />
    );
  }

  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/[0.18] text-cream/30">
      <HandHelping size={17} aria-hidden="true" />
    </span>
  );
}

/** Fills the grid's last slot and opens the full leaderboard. */
function ViewAllTile({ total, onClick }: { total: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className="trailmate-ranking-card group flex min-h-[10.5rem] flex-col items-center justify-center rounded-[1.25rem] bg-[#17181b] p-4 text-center transition-colors hover:bg-[#1b1c20] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/40 sm:p-5"
    >
      <span className="grid h-12 w-12 place-items-center rounded-full border border-white/[0.14] text-cream/60 transition group-hover:border-white/30 group-hover:text-cream">
        <UsersRound size={18} aria-hidden="true" />
      </span>
      <span className="mt-4 text-[15px] font-semibold text-cream">View all Top Trailmates</span>
      <span className="mt-1 inline-flex items-center gap-1 text-[13px] text-cream/45">
        See the top {Math.min(total, 100)}
        <ChevronRight
          size={13}
          className="transition group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
    </button>
  );
}

type LeaderboardState =
  { status: "loading" } | { status: "ready"; helpers: TopPeerHelper[] } | { status: "error" };

/** The top 100, in the same modal language as the badge ranking. */
function LeaderboardModal({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<LeaderboardState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    void fetch("/api/help/leaderboard", { signal: controller.signal })
      .then((response) => response.json().then((payload) => ({ response, payload })))
      .then(({ response, payload }) => {
        if (!response.ok || !payload?.success) throw new Error("leaderboard");
        setState({ status: "ready", helpers: payload.data.helpers as TopPeerHelper[] });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ status: "error" });
      });
    return () => controller.abort();
  }, [attempt]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={MODAL_BACKDROP}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="leaderboard-title"
        tabIndex={-1}
        ref={(node) => node?.focus({ preventScroll: true })}
        className={`${MODAL_CARD} flex max-h-[min(42rem,calc(100dvh-3rem))] max-w-xl flex-col`}
      >
        <div className="shrink-0 px-6 pt-6 sm:px-7 sm:pt-7">
          <ModalHeader
            icon={UsersRound}
            label="Community"
            title="Top Trailmates"
            titleId="leaderboard-title"
            closeLabel="Close Top Trailmates"
            onClose={onClose}
          />
          <p className={`mt-3 text-[0.9rem] leading-[1.6] ${MODAL_MUTED}`}>
            Ranked by how often people thanked them, then by how many they helped.
          </p>
        </div>

        <div className="thin-scroll mt-4 min-h-0 flex-1 overflow-y-auto px-3 pb-4 sm:px-4">
          {state.status === "ready" ? (
            <ol className="space-y-0.5">
              {state.helpers.map((helper, index) => (
                <LeaderboardRow
                  key={`${helper.participant.label}-${index}`}
                  helper={helper}
                  rank={index + 1}
                />
              ))}
            </ol>
          ) : state.status === "error" ? (
            <div className="px-3 py-10 text-center">
              <p className={`text-[14px] ${MODAL_MUTED}`}>The leaderboard didn’t load.</p>
              <button
                type="button"
                onClick={() => setAttempt((current) => current + 1)}
                className="mt-4 inline-flex h-10 items-center rounded-xl px-4 text-sm font-medium text-[var(--workspace-accent)] transition-colors hover:bg-[var(--workspace-accent-soft)]"
              >
                Try again
              </button>
            </div>
          ) : (
            <ol aria-label="Loading Top Trailmates" className="space-y-0.5">
              {Array.from({ length: 6 }, (_, index) => (
                <li key={index} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="skeleton h-4 w-5 !rounded" />
                  <span className="skeleton h-9 w-9 !rounded-full" />
                  <span className="flex-1 space-y-2">
                    <span className="skeleton block h-2.5 w-32" />
                    <span className="skeleton block h-2 w-48" />
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {state.status === "ready" ? (
          <p className={`shrink-0 px-6 pb-5 pt-3 text-[12.5px] sm:px-7 ${MODAL_MUTED}`}>
            Showing the top {state.helpers.length}
          </p>
        ) : null}
      </section>
    </div>,
    document.body
  );
}

function LeaderboardRow({ helper, rank }: { helper: TopPeerHelper; rank: number }) {
  const impact = helper.helpedCount
    ? Math.round((helper.thankedCount / helper.helpedCount) * 100)
    : 0;
  const podium = rank <= 3;
  return (
    <li className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[#f5f6f8] dark:hover:bg-white/[0.04]">
      <span
        className={`w-6 shrink-0 text-center text-[13px] font-semibold tabular-nums ${
          podium ? "text-[var(--workspace-accent)]" : MODAL_MUTED
        }`}
      >
        {rank}
      </span>
      <PeerAvatar participant={helper.participant} className="h-9 w-9 rounded-full" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold">
          {displayName(helper.participant.label)}
        </p>
        <p className={`mt-0.5 hidden truncate text-[12.5px] sm:block ${MODAL_MUTED}`}>
          {helper.participant.headline ?? "A dependable peer in the practice community."}
        </p>
      </div>
      <dl className="flex shrink-0 items-center gap-4 text-right">
        <LeaderboardStat label="People" value={helper.helpedCount} />
        <LeaderboardStat label="Thanks" value={helper.thankedCount} />
        <LeaderboardStat label="Impact" value={`${impact}%`} className="hidden sm:block" />
      </dl>
    </li>
  );
}

function LeaderboardStat({
  label,
  value,
  className = ""
}: {
  label: string;
  value: number | string;
  className?: string;
}) {
  return (
    <div className={`min-w-10 ${className}`}>
      <dt className={`text-[11.5px] ${MODAL_MUTED}`}>{label}</dt>
      <dd className="mt-0.5 text-[14px] font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * An empty section drawn as a faded outline of what will fill it, with the
 * next step on top. The outline uses the real card classes, so it follows
 * both themes, and a mask fades it so it never reads as real data.
 */
function PreviewEmptyState({
  preview,
  title,
  message,
  footnote,
  action
}: {
  preview: ReactNode;
  title: string;
  message: string;
  footnote?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="relative mt-5">
      <div
        aria-hidden="true"
        className="pointer-events-none select-none opacity-60"
        style={{
          maskImage: "linear-gradient(to bottom, black 0%, transparent 92%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 92%)"
        }}
      >
        {preview}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
        <span
          aria-hidden="true"
          className="trailmate-empty-veil pointer-events-none absolute left-1/2 top-1/2 h-[140%] w-[min(48rem,100%)] -translate-x-1/2 -translate-y-1/2"
        />
        <div className="relative flex flex-col items-center">
          <p className="text-[15px] font-semibold tracking-[-0.01em] text-cream">{title}</p>
          <p className="mt-1.5 max-w-md text-[12.5px] leading-5 text-cream/48">{message}</p>
          {footnote ? (
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-cream/32">
              {footnote}
            </p>
          ) : null}
          {action ? (
            <Link
              href={action.href}
              className="trailmate-empty-action group mt-4 inline-flex items-center gap-2 rounded-full border border-white/[0.2] bg-black px-3.5 py-2 text-[12px] font-semibold text-cream/75 transition hover:border-white/35 hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/40"
            >
              {action.label}
              <ChevronRight
                size={13}
                className="text-cream/35 transition group-hover:translate-x-0.5 group-hover:text-cream/60"
                aria-hidden="true"
              />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** A text-shaped bar for the empty-state outlines. */
function PreviewBar({ className }: { className: string }) {
  return (
    <span className={`trailmate-preview-shape block rounded-full bg-white/[0.07] ${className}`} />
  );
}

function RankingPreview() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className={`trailmate-ranking-card rounded-[1.25rem] bg-[rgba(20,21,24,0.72)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_20px_60px_-40px_rgba(0,0,0,0.9)] sm:p-5 ${
            index === 1 ? "hidden md:block" : index === 2 ? "hidden xl:block" : ""
          }`}
        >
          <div className="flex items-start gap-3.5">
            <span className="trailmate-preview-shape h-12 w-12 shrink-0 rounded-full bg-white/[0.06] ring-1 ring-white/10" />
            <div className="min-w-0 flex-1 pt-1">
              <PreviewBar className="h-3 w-28" />
              <PreviewBar className="mt-2.5 h-2 w-40" />
            </div>
            <span className="h-7 w-7 shrink-0 rounded-full border border-white/[0.11]" />
          </div>
          <div className="mt-5 grid grid-cols-3 border-t border-white/[0.14] pt-4">
            {[0, 1, 2].map((stat) => (
              <div
                key={stat}
                className={`flex flex-col items-center gap-1.5 ${stat ? "border-l border-white/[0.13]" : ""}`}
              >
                <PreviewBar className="h-2.5 w-7" />
                <PreviewBar className="h-1.5 w-10" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryPreview() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {[0, 1].map((index) => (
        <div
          key={index}
          className={`trailmate-history-card rounded-[1.25rem] bg-[rgba(16,17,20,0.78)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_20px_60px_-40px_rgba(0,0,0,0.9)] sm:p-5 ${
            index === 1 ? "hidden lg:block" : ""
          }`}
        >
          <div className="flex items-start gap-4">
            <span className="trailmate-preview-shape h-12 w-12 shrink-0 rounded-full bg-white/[0.06] ring-1 ring-white/20" />
            <div className="min-w-0 flex-1 pt-1">
              <PreviewBar className="h-3 w-32" />
              <PreviewBar className="mt-2.5 h-2 w-48" />
            </div>
            <span className="hidden h-5 w-20 shrink-0 rounded-full border border-white/[0.17] sm:block" />
          </div>
          <div className="mt-5 rounded-xl border border-white/[0.13] bg-white/[0.018] p-3.5">
            <PreviewBar className="h-1.5 w-20" />
            <div className="mt-3 flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <PreviewBar className="h-3 w-36" />
                <PreviewBar className="mt-2 h-2 w-24" />
              </div>
              <span className="h-9 w-9 shrink-0 rounded-full border border-white/[0.18]" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <PreviewBar className="h-2 w-20" />
            <PreviewBar className="h-2 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

function helperBadge(positiveHelps: number): { label: string; detail: string } {
  if (positiveHelps >= 25) {
    return { label: "Trail Guide", detail: "Highest community rank earned." };
  }
  if (positiveHelps >= 10) {
    return {
      label: "Trusted Mate",
      detail: `${25 - positiveHelps} more positive ${25 - positiveHelps === 1 ? "conversation" : "conversations"} to Trail Guide.`
    };
  }
  if (positiveHelps >= 1) {
    return {
      label: "First Assist",
      detail: `${10 - positiveHelps} more positive ${10 - positiveHelps === 1 ? "conversation" : "conversations"} to Trusted Mate.`
    };
  }
  return { label: "New Trailmate", detail: "One positive conversation earns First Assist." };
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(timestamp));
}

function formatDuration(milliseconds: number): string {
  const minutes = Math.max(1, Math.round(milliseconds / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}
