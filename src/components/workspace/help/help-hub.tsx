"use client";

import Image from "next/image";
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
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { DocumentTitle } from "@/components/document-title";
import { ProfileAvatar } from "@/components/workspace/profile/profile-avatar";
import type {
  HelpHistoryItem,
  HelpHistoryPage,
  HelpHistoryParticipant,
  HelpHistorySide,
  HelpOverview,
  TopPeerHelper
} from "@/lib/help/help-history";
import { peerHelpRoomHref } from "@/lib/help/help-room-navigation";
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
    const refresh = async () => {
      const response = await fetch("/api/help/overview").catch(() => null);
      const payload = await response?.json().catch(() => null);
      if (response?.ok && payload?.success && payload.data) setOverview(payload.data);
    };
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(timer);
  }, [activeRequestId]);

  useEffect(() => {
    if (!badgeOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setBadgeOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [badgeOpen]);

  if (overview.activeConversation) {
    return <ActiveConversationView conversation={overview.activeConversation} />;
  }

  return (
    <main className="mx-auto w-full max-w-[88rem] px-4 pb-24 pt-8 sm:px-8 sm:pt-10 lg:px-10">
      <DocumentTitle title="Trailmate" />
      <h1 className="sr-only">Trailmate</h1>

      <UserRecognition overview={overview} onBadgeClick={() => setBadgeOpen(true)} />

      <TopHelpers helpers={overview.topHelpers} />

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
      <p className="mt-4 text-base font-semibold tracking-[-0.01em] text-cream">
        {overview.viewer.label}
      </p>
      <p className="mt-1 text-[12px] text-cream/42">
        Supported {overview.peopleHelped} {overview.peopleHelped === 1 ? "person" : "people"}
      </p>
      <button
        type="button"
        onClick={onBadgeClick}
        aria-haspopup="dialog"
        className="group mt-4 inline-flex items-center gap-2 rounded-full border border-white/[0.2] bg-black px-3.5 py-2 text-[12px] font-semibold text-cream/75 transition hover:border-white/35 hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/40"
      >
        <Award size={14} className="text-[#efcf84]" aria-hidden="true" />
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

function BadgeRankingToast({ overview, onClose }: { overview: HelpOverview; onClose: () => void }) {
  const current = helperBadge(overview.positiveHelps);
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex min-h-dvh items-center justify-center overflow-y-auto bg-black/[0.82] px-4 py-6"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="badge-ranking-title"
        className="my-auto w-full max-w-md rounded-[1.5rem] bg-[rgba(20,21,24,0.94)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_30px_100px_rgba(0,0,0,0.85)] backdrop-blur-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full border border-[#efcf84]/25 bg-[#efcf84]/[0.07] text-[#efcf84]">
              <Award size={19} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cream/35">
                Your badge
              </p>
              <h2 id="badge-ranking-title" className="mt-1 text-xl font-semibold text-cream">
                {current.label}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close badge ranking"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.09] text-cream/45 transition hover:border-white/20 hover:text-cream"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        <p className="mt-5 text-[13px] leading-5 text-cream/52">{current.detail}</p>

        <ol className="mt-5 space-y-1.5">
          {BADGE_LEVELS.map((level) => {
            const earned = overview.positiveHelps >= level.threshold;
            const active = level.label === current.label;
            return (
              <li
                key={level.label}
                className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 ${
                  active
                    ? "border-[#efcf84]/25 bg-[#efcf84]/[0.055]"
                    : "border-white/[0.13] bg-black"
                }`}
              >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[11px] font-semibold ${
                    earned
                      ? "border-cream/25 bg-cream text-black"
                      : "border-white/[0.1] text-cream/35"
                  }`}
                >
                  {earned ? <Check size={13} aria-hidden="true" /> : level.threshold}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[12.5px] font-semibold ${active ? "text-cream" : "text-cream/65"}`}
                  >
                    {level.label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-cream/35">{level.description}</p>
                </div>
                {active ? (
                  <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#efcf84]">
                    Current
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>

        {overview.availabilityCredits ? (
          <p className="mt-4 border-t border-white/[0.07] pt-4 text-[11px] leading-5 text-cream/35">
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

function ActiveConversationView({
  conversation
}: {
  conversation: NonNullable<HelpOverview["activeConversation"]>;
}) {
  return (
    <main className="mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-[76rem] place-items-center px-4 py-12 sm:px-8">
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

function TopHelpers({ helpers }: { helpers: TopPeerHelper[] }) {
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
                className="group rounded-[1.25rem] bg-[rgba(20,21,24,0.72)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_20px_60px_-40px_rgba(0,0,0,0.9)] backdrop-blur-xl transition hover:bg-[rgba(24,25,28,0.8)] sm:p-5"
              >
                <div className="flex items-start gap-3.5">
                  <PeerAvatar
                    participant={helper.participant}
                    className="h-12 w-12 rounded-full ring-1 ring-white/10"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-cream">
                          {helper.participant.label}
                        </p>
                        <p className="mt-1 line-clamp-2 min-h-8 text-[11.5px] leading-4 text-cream/38">
                          {helper.participant.headline ??
                            "A dependable peer in the practice community."}
                        </p>
                      </div>
                      <span className="grid h-7 min-w-7 shrink-0 place-items-center rounded-full border border-white/[0.11] px-2 text-[10px] font-semibold text-cream/55">
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
        </div>
      ) : (
        <CleanEmptyState message="Community rankings appear after completed peer sessions." />
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
      <p className="text-[13px] font-semibold text-cream/78">{value}</p>
      <p className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-cream/28">{label}</p>
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
        <CleanEmptyState
          message={
            side === "given"
              ? "The people you support will appear here."
              : "The people who support you will appear here."
          }
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
  eyebrow,
  id,
  title,
  description
}: {
  eyebrow: string;
  id: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-[9px] font-semibold uppercase tracking-[0.17em] text-cream/28">
        {eyebrow}
      </p>
      <h2
        id={id}
        className="mt-1.5 text-xl font-semibold tracking-[-0.02em] text-cream sm:text-2xl"
      >
        {title}
      </h2>
      <p className="mt-1.5 text-[12.5px] leading-5 text-cream/38">{description}</p>
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
    <article className="rounded-[1.25rem] bg-[rgba(16,17,20,0.78)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_20px_60px_-40px_rgba(0,0,0,0.9)] backdrop-blur-xl transition hover:bg-[rgba(20,21,24,0.86)] sm:p-5">
      <div className="flex items-start gap-4">
        <ParticipantAvatar item={item} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-cream">
            {participantLabel}
          </p>
          {item.participant?.headline ? (
            <p className="mt-1 line-clamp-2 text-[11.5px] leading-4 text-cream/42">
              {item.participant.headline}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full border border-white/[0.17] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.11em] text-cream/48">
          {relationship}
        </span>
      </div>

      <div className="mt-5 rounded-xl border border-white/[0.13] bg-white/[0.018] p-3.5">
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cream/30">
          Worked through
        </p>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-semibold text-cream/82">
              {item.question.title}
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[10.5px] text-cream/36">
              <span>{item.question.topic}</span>
              <span aria-hidden="true">·</span>
              <span>{item.language}</span>
            </p>
          </div>
          <Link
            href={item.question.href}
            aria-label={`Open ${item.question.title}`}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/[0.18] text-cream/48 transition hover:border-white/35 hover:text-cream"
          >
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[10.5px] text-cream/38">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5 text-cream/52">
            <Check size={11} aria-hidden="true" /> {STATUS_COPY[item.status]}
          </span>
          <span>{formatDate(item.resolvedAt ?? item.askedAt)}</span>
          {item.sessionDurationMs !== null ? (
            <span className="inline-flex items-center gap-1">
              <Clock3 size={10} aria-hidden="true" /> {formatDuration(item.sessionDurationMs)}
            </span>
          ) : null}
        </div>
        {item.learnerRating ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#efcf84]/[0.08] px-2 py-1 font-semibold text-[#efcf84]">
            <Star size={10} fill="currentColor" aria-hidden="true" />
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

function CleanEmptyState({ message }: { message: string }) {
  return (
    <p className="mt-5 rounded-[1.2rem] border border-dashed border-white/[0.17] bg-black px-5 py-9 text-center text-[12.5px] text-cream/42">
      {message}
    </p>
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
