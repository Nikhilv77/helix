"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  Clock3,
  HandHelping,
  Loader2,
  MessageCircleQuestion,
  Star,
  UsersRound
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

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
import { HelpInbox, type HelpInboxStats } from "./help-inbox";
import { SafetyControls } from "./safety-controls";

const STATUS_COPY: Record<HelpHistoryItem["status"], string> = {
  OPEN: "Waiting for a helper",
  CLAIMED: "Accepted",
  RESOLVED: "Resolved",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled"
};

export function HelpHub({
  initialOverview,
  initialHistory
}: {
  initialOverview: HelpOverview;
  initialHistory: HelpHistoryPage;
}) {
  const [overview, setOverview] = useState(initialOverview);
  const [side, setSide] = useState<HelpHistorySide>("received");
  const [history, setHistory] = useState(initialHistory);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const historyRequest = useRef(0);
  const activeRequestId = overview.activeConversation?.requestId ?? null;

  const loadHistory = useCallback(
    async (nextSide: HelpHistorySide, cursor: string | null = null) => {
      const requestId = ++historyRequest.current;
      if (cursor) setLoadingMore(true);
      else setLoading(true);
      setHistoryError(null);

      try {
        const query = new URLSearchParams({ side: nextSide });
        if (cursor) query.set("cursor", cursor);
        const response = await fetch(`/api/help/history?${query.toString()}`);
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success || !payload.data) {
          throw new Error(payload?.error?.message ?? "Could not load help history.");
        }
        if (requestId !== historyRequest.current) return;

        const nextPage = payload.data as HelpHistoryPage;
        setHistory((current) =>
          cursor
            ? { items: [...current.items, ...nextPage.items], nextCursor: nextPage.nextCursor }
            : nextPage
        );
      } catch (error) {
        if (requestId !== historyRequest.current) return;
        setHistoryError(error instanceof Error ? error.message : "Could not load help history.");
      } finally {
        if (requestId === historyRequest.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    []
  );

  const chooseSide = (nextSide: HelpHistorySide) => {
    if (nextSide === side) return;
    setSide(nextSide);
    void loadHistory(nextSide);
  };

  const refreshHistory = useCallback(() => {
    void loadHistory(side);
  }, [loadHistory, side]);

  const syncOpportunityStats = useCallback((stats: HelpInboxStats) => {
    setOverview((current) => ({
      ...current,
      peopleHelped: stats.helpedPeople,
      activeGiven: stats.claimed
    }));
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

  if (overview.activeConversation) {
    return <ActiveConversationView conversation={overview.activeConversation} />;
  }

  return (
    <main className="relative isolate mx-auto w-full max-w-[92rem] px-4 pb-24 pt-9 sm:px-8 sm:pt-12 lg:px-10">
      <DocumentTitle title="Help" />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-[30rem] w-[48rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(242,110,1,0.1),transparent_68%)]"
      />

      <header className="mx-auto max-w-3xl text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--workspace-accent)]">
          Peer help
        </p>
        <h1 className="mt-3 font-display text-[clamp(2rem,5vw,4.3rem)] font-semibold tracking-[-0.04em] text-cream">
          Ask. Talk. Keep moving.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-cream/55 sm:text-[15px]">
          Your received and given help stays here. New matching requests arrive as a small,
          actionable notification.
        </p>
      </header>

      <section aria-label="Help overview" className="mt-10 grid gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={MessageCircleQuestion}
          label="Help received"
          value={overview.helpReceived}
          detail={
            overview.activeReceived ? `${overview.activeReceived} active now` : "Questions asked"
          }
        />
        <SummaryCard
          icon={UsersRound}
          label="People helped"
          value={overview.peopleHelped}
          detail={overview.activeGiven ? `${overview.activeGiven} accepted now` : "Unique learners"}
        />
        <SummaryCard
          icon={Award}
          label="Helper badge"
          value={helperBadge(overview.positiveHelps).label}
          detail={
            overview.availabilityCredits
              ? `${helperBadge(overview.positiveHelps).detail} · ${overview.availabilityCredits} waiting credit${overview.availabilityCredits === 1 ? "" : "s"}`
              : helperBadge(overview.positiveHelps).detail
          }
        />
      </section>

      <TopHelpers helpers={overview.topHelpers} />

      <section className="mt-12" aria-labelledby="my-help-title">
        <div className="flex flex-col gap-5 border-b border-cream/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cream/35">
              Your activity
            </p>
            <h2 id="my-help-title" className="mt-1.5 text-2xl font-semibold text-cream">
              My help
            </h2>
          </div>
          <div
            role="tablist"
            aria-label="Help history"
            className="flex rounded-xl bg-cream/[0.045] p-1"
          >
            <HistoryTab active={side === "received"} onClick={() => chooseSide("received")}>
              Help received
            </HistoryTab>
            <HistoryTab active={side === "given"} onClick={() => chooseSide("given")}>
              Help given
            </HistoryTab>
          </div>
        </div>

        <div className="mt-4 min-h-48" aria-live="polite">
          {historyError ? (
            <div
              role="alert"
              className="rounded-2xl border border-[#ffb4b4]/20 bg-[#ffb4b4]/[0.05] px-5 py-4 text-sm text-[#ffb4b4]"
            >
              {historyError}
            </div>
          ) : loading ? (
            <div className="flex items-center gap-2 py-16 text-sm text-cream/40">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              Loading {side === "received" ? "help received" : "help given"}…
            </div>
          ) : history.items.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {history.items.map((item) => (
                <HistoryCard
                  key={item.id}
                  item={item}
                  side={side}
                  onSafetyAction={refreshHistory}
                />
              ))}
            </div>
          ) : (
            <EmptyHistory side={side} />
          )}
        </div>

        {history.nextCursor && !loading ? (
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void loadHistory(side, history.nextCursor)}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl border border-cream/12 px-4 text-[13px] font-semibold text-cream/65 transition hover:border-cream/22 hover:text-cream disabled:opacity-50"
          >
            {loadingMore ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
            Load more
          </button>
        ) : null}
      </section>

      <section className="mt-16" aria-labelledby="opportunities-title">
        <div className="max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cream/35">
            Live help
          </p>
          <h2 id="opportunities-title" className="mt-1.5 text-2xl font-semibold text-cream">
            Your accepted conversation
          </h2>
          <p className="mt-2 text-sm leading-6 text-cream/50">
            Accept or decline new requests from the small notification. Once accepted, the secure
            voice room appears here.
          </p>
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-cream/10 bg-[#141518]/70 p-4 shadow-[0_28px_80px_-48px_rgba(0,0,0,0.95)] sm:p-6">
          <HelpInbox onStatsChange={syncOpportunityStats} showOpen={false} />
        </div>
      </section>
    </main>
  );
}

function ActiveConversationView({
  conversation
}: {
  conversation: NonNullable<HelpOverview["activeConversation"]>;
}) {
  return (
    <main className="relative isolate mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-[76rem] place-items-center px-4 py-12 sm:px-8">
      <DocumentTitle title="Peer help" />
      <section className="w-full overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#151619]/90 shadow-[0_34px_110px_-48px_rgba(0,0,0,0.98)]">
        <div className="h-1 bg-[var(--workspace-accent)]" />
        <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex min-w-0 items-start gap-4">
            <PeerAvatar participant={conversation.peer} className="h-14 w-14 rounded-2xl" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-accent)]">
                {conversation.started ? "Meeting in progress" : "Private room ready"}
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-cream sm:text-3xl">
                Peer help with {conversation.peer.label}
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
            href={peerHelpRoomHref(conversation.requestId, "/help")}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-cream px-5 text-sm font-semibold text-[#17181a] transition hover:bg-white"
          >
            <UsersRound size={16} aria-hidden="true" />
            {conversation.started ? "Resume meeting" : "Join meeting"}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}

function TopHelpers({ helpers }: { helpers: TopPeerHelper[] }) {
  return (
    <section className="mt-12" aria-labelledby="top-helpers-title">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cream/35">
          Community
        </p>
        <h2 id="top-helpers-title" className="mt-1.5 text-2xl font-semibold text-cream">
          Top peer helpers
        </h2>
      </div>
      {helpers.length ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {helpers.map((helper, index) => (
            <article
              key={`${helper.participant.label}-${index}`}
              className="rounded-[1.2rem] border border-cream/10 bg-[#151619]/80 p-4"
            >
              <div className="flex items-center gap-3">
                <PeerAvatar participant={helper.participant} className="h-10 w-10 rounded-xl" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-cream/82">
                    {helper.participant.label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-cream/38">#{index + 1} this community</p>
                </div>
              </div>
              <p className="mt-4 text-[12px] text-cream/48">
                {helper.helpedCount} helped · {helper.thankedCount} thanked
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-2xl border border-dashed border-cream/12 px-5 py-8 text-sm text-cream/42">
          Top helpers will appear as peer conversations are completed.
        </p>
      )}
    </section>
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
        width={56}
        height={56}
        className={`${className} shrink-0 object-cover`}
      />
    );
  }
  return (
    <ProfileAvatar name={participant.label} className={`${className} shrink-0 object-cover`} />
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail
}: {
  icon: typeof HandHelping;
  label: string;
  value: number | string;
  detail: string;
}) {
  return (
    <article className="rounded-[1.2rem] border border-cream/10 bg-[#151619]/80 p-4 shadow-[0_18px_50px_-35px_rgba(0,0,0,0.9)] sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-medium text-cream/45">{label}</p>
          <p className="mt-2 font-mono text-3xl font-semibold tracking-[-0.04em] text-cream">
            {value}
          </p>
        </div>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]">
          <Icon size={17} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-[11.5px] text-cream/35">{detail}</p>
    </article>
  );
}

function HistoryTab({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        "rounded-lg px-3.5 py-2 text-[12.5px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]",
        active ? "bg-cream text-[#17181a]" : "text-cream/48 hover:text-cream/78"
      ].join(" ")}
    >
      {children}
    </button>
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
  return (
    <article className="rounded-[1.15rem] border border-cream/10 bg-[linear-gradient(145deg,#1a1b1e,#141517)] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-cream/38">
            <span className="rounded-full border border-cream/10 px-2 py-0.5 font-medium text-cream/55">
              {STATUS_COPY[item.status]}
            </span>
            <span>{item.question.topic}</span>
            <span>·</span>
            <span>{item.language}</span>
          </div>
          <Link
            href={item.question.href}
            className="mt-2 block truncate text-[16px] font-semibold text-cream transition hover:text-white hover:underline"
          >
            {item.question.title}
          </Link>
        </div>
        <Link
          href={item.question.href}
          aria-label={`Open ${item.question.title}`}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cream/10 text-cream/40 transition hover:border-cream/20 hover:text-cream"
        >
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-4 flex items-center gap-3 border-t border-cream/8 pt-4">
        <ParticipantAvatar item={item} />
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-cream/72">
            {item.participant?.label ?? (side === "received" ? "No helper accepted" : "Learner")}
          </p>
          {item.participant?.headline ? (
            <p className="mt-0.5 truncate text-[11.5px] text-cream/38">
              {item.participant.headline}
            </p>
          ) : null}
        </div>
        {side === "given" && item.learnerRating ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#efcf84]/10 px-2 py-1 text-[11px] font-semibold text-[#efcf84]">
            <Star size={11} fill="currentColor" aria-hidden="true" /> {item.learnerRating}/5
          </span>
        ) : null}
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-cream/38">
        <div className="flex gap-1.5">
          <dt>Asked</dt>
          <dd className="text-cream/58">{formatDate(item.askedAt)}</dd>
        </div>
        {item.claimedAt ? (
          <div className="flex gap-1.5">
            <dt>Accepted</dt>
            <dd className="text-cream/58">{formatDate(item.claimedAt)}</dd>
          </div>
        ) : null}
        {item.resolvedAt ? (
          <div className="flex gap-1.5">
            <dt>Resolved</dt>
            <dd className="text-cream/58">{formatDate(item.resolvedAt)}</dd>
          </div>
        ) : null}
        {item.sessionDurationMs !== null ? (
          <div className="flex items-center gap-1.5">
            <Clock3 size={11} aria-hidden="true" />
            <dt className="sr-only">Session duration</dt>
            <dd className="text-cream/58">{formatDuration(item.sessionDurationMs)}</dd>
          </div>
        ) : null}
      </dl>

      {item.canReportOrBlock ? (
        <div className="mt-4 border-t border-cream/8 pt-3">
          <SafetyControls requestId={item.id} onActioned={onSafetyAction} />
        </div>
      ) : null}
    </article>
  );
}

function ParticipantAvatar({ item }: { item: HelpHistoryItem }) {
  if (item.participant?.profileImage) {
    return (
      <Image
        src={item.participant.profileImage}
        alt=""
        width={36}
        height={36}
        className="h-9 w-9 rounded-full object-cover"
      />
    );
  }

  return (
    <ProfileAvatar
      name={item.participant?.label ?? "Trailgrad candidate"}
      className="h-9 w-9 shrink-0 rounded-full object-cover"
    />
  );
}

function EmptyHistory({ side }: { side: HelpHistorySide }) {
  return (
    <div className="rounded-[1.2rem] border border-dashed border-cream/12 px-5 py-12 text-center">
      <HandHelping size={24} className="mx-auto text-cream/25" aria-hidden="true" />
      <p className="mt-3 text-sm font-semibold text-cream/65">
        No {side === "received" ? "help received" : "help given"} yet
      </p>
      <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-5 text-cream/38">
        {side === "received"
          ? "When you ask for human help from a DSA question, its progress will stay here."
          : "Qualified requests you accept and resolve will build your private helper history."}
      </p>
    </div>
  );
}

function helperBadge(positiveHelps: number): { label: string; detail: string } {
  if (positiveHelps >= 25) return { label: "Practice Mentor", detail: "25+ helpful conversations" };
  if (positiveHelps >= 10) {
    return { label: "Reliable Helper", detail: `${25 - positiveHelps} more to Practice Mentor` };
  }
  if (positiveHelps >= 1) {
    return { label: "First Assist", detail: `${10 - positiveHelps} more to Reliable Helper` };
  }
  return { label: "New helper", detail: "One helpful conversation earns First Assist" };
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
