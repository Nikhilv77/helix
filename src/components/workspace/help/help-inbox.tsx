"use client";

import Link from "next/link";
import { Clock, Loader2, MessageSquare, UserRound } from "lucide-react";
import { HelpCall } from "./help-call";
import { LearnerWorkspaceView } from "./learner-workspace-view";
import { SafetyControls } from "./safety-controls";
import type { HelpSnapshot, WorkspaceState } from "@/lib/help/snapshot";
import { useCallback, useEffect, useState } from "react";

interface InboxRequest {
  id: string;
  slug: string;
  title: string;
  questionPrompt: string | null;
  difficulty: string | null;
  language: string;
  status: string;
  headline: string | null;
  blockedOn: string | null;
  understands: string[];
  opener: string | null;
  estimatedMinutes: number | null;
  failingTests: number | null;
  hintsUsed: number;
  timeSpentMs: number;
  askedAt: number;
  capturedWorkspace: WorkspaceState | null;
}

type Action = "claim" | "decline" | "release" | "resolve";
const INBOX_POLL_MS = 30_000;

export interface HelpInboxStats {
  available: number;
  claimed: number;
  helpedPeople: number;
}

function waitedFor(askedAt: number): string {
  const minutes = Math.max(1, Math.round((Date.now() - askedAt) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

export function HelpInbox({
  onStatsChange
}: {
  onStatsChange?: (stats: HelpInboxStats) => void;
} = {}) {
  const [open, setOpen] = useState<InboxRequest[]>([]);
  const [claimed, setClaimed] = useState<InboxRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetRequestId, setTargetRequestId] = useState<string | null>(null);

  useEffect(() => {
    setTargetRequestId(new URLSearchParams(window.location.search).get("request"));
  }, []);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/help/inbox");
      const payload = await response.json().catch(() => null);
      if (!payload?.success || !payload.data) return;
      const nextOpen = payload.data.open ?? [];
      const nextClaimed = payload.data.claimed ?? [];
      setOpen(nextOpen);
      setClaimed(nextClaimed);
      onStatsChange?.({
        available: nextOpen.length,
        claimed: nextClaimed.length,
        helpedPeople: payload.data.helpedPeopleCount ?? 0
      });
    } catch {
      setError("Could not load the help inbox.");
    } finally {
      setLoading(false);
    }
  }, [onStatsChange]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), INBOX_POLL_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  useEffect(() => {
    if (loading || !targetRequestId) return;
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(`help-request-${targetRequestId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [claimed, loading, open, targetRequestId]);

  const act = useCallback(
    async (id: string, action: Action) => {
      setBusy(id);
      setError(null);

      try {
        const response = await fetch(`/api/help/request/${encodeURIComponent(id)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action })
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.success) {
          // "Someone else got there first" is the common one and is not a bug —
          // it is the claim race resolving, so it reads as information.
          throw new Error(payload?.error?.message ?? "That did not work.");
        }

        await load();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "That did not work.");
        await load();
      } finally {
        setBusy(null);
      }
    },
    [load]
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-1 py-10 text-[13px] text-cream/45">
        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        Loading requests
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error ? (
        <p className="rounded-xl border border-[#ffb4b4]/25 bg-[#ffb4b4]/[0.06] px-4 py-3 text-[13px] text-[#ffb4b4]">
          {error}
        </p>
      ) : null}

      {claimed.length > 0 ? (
        <section>
          <h2 className="text-[15px] font-semibold text-cream">You said you would help</h2>
          <div className="mt-3 space-y-3">
            {claimed.map((item) => (
              <RequestCard
                key={item.id}
                request={item}
                busy={busy === item.id}
                primary={{ label: "Mark as helped", action: "resolve" }}
                secondary={{ label: "Hand back", action: "release" }}
                onAct={act}
                onCallEnded={() => void load()}
                highlighted={targetRequestId === item.id}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="text-[15px] font-semibold text-cream">People you may be able to help</h2>

        {open.length === 0 ? (
          <p className="mt-3 rounded-xl border border-cream/10 bg-cream/[0.03] px-4 py-8 text-center text-[13px] text-cream/45">
            Nothing right now. This fills up when your problem-solving evidence matches a request.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {open.map((item) => (
              <RequestCard
                key={item.id}
                request={item}
                busy={busy === item.id}
                primary={{ label: "Help them", action: "claim" }}
                secondary={{ label: "Not this one", action: "decline" }}
                onAct={act}
                onCallEnded={() => void load()}
                highlighted={targetRequestId === item.id}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RequestCard({
  request,
  busy,
  primary,
  secondary,
  onAct,
  onCallEnded,
  highlighted = false
}: {
  request: InboxRequest;
  busy: boolean;
  primary: { label: string; action: Action };
  secondary?: { label: string; action: Action };
  onAct: (id: string, action: Action) => void;
  onCallEnded: () => void;
  highlighted?: boolean;
}) {
  const [snapshot, setSnapshot] = useState<HelpSnapshot | null>(null);

  return (
    <article
      id={`help-request-${request.id}`}
      className={[
        "rounded-[1.15rem] border bg-[linear-gradient(150deg,#1b1c20,#161719)] p-4 transition sm:p-5",
        highlighted
          ? "border-[var(--workspace-accent)] shadow-[0_0_0_1px_var(--workspace-accent)]"
          : "border-cream/10"
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-cream/50">
        <Link
          href={`/dsa-questions/${request.slug}`}
          className="text-[14.5px] font-bold text-cream hover:underline"
        >
          {request.title}
        </Link>
        {request.difficulty ? <span>· {request.difficulty}</span> : null}
        <span>· {request.language}</span>
        <span className="inline-flex items-center gap-1">
          · <Clock size={11} aria-hidden="true" /> {waitedFor(request.askedAt)}
        </span>
        {request.estimatedMinutes ? <span>· ~{request.estimatedMinutes} min</span> : null}
      </div>

      {request.headline ? (
        <p className="mt-2.5 text-[14px] leading-6 text-cream/85">{request.headline}</p>
      ) : (
        <p className="mt-2.5 text-[13.5px] italic leading-6 text-cream/45">
          No summary was generated for this one.
        </p>
      )}

      {request.questionPrompt ? (
        <details className="mt-2.5 rounded-xl border border-cream/8 bg-cream/[0.025] px-3 py-2.5">
          <summary className="cursor-pointer text-[12px] font-medium text-cream/45">
            Question context
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-5 text-cream/60">
            {request.questionPrompt}
          </p>
        </details>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-cream/40">
        {request.timeSpentMs > 0 ? (
          <span>{Math.max(1, Math.round(request.timeSpentMs / 60_000))}m before asking</span>
        ) : null}
        {request.failingTests !== null ? (
          <span>
            {request.failingTests} failing {request.failingTests === 1 ? "test" : "tests"}
          </span>
        ) : null}
        {request.hintsUsed > 0 ? (
          <span>
            {request.hintsUsed} AI {request.hintsUsed === 1 ? "hint" : "hints"} tried
          </span>
        ) : null}
      </div>

      {request.blockedOn ? (
        <p className="mt-2 text-[13px] leading-5 text-cream/60">
          <span className="text-cream/40">Blocked on: </span>
          {request.blockedOn}
        </p>
      ) : null}

      {request.understands.length > 0 ? (
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {request.understands.map((item) => (
            <li
              key={item}
              className="rounded-full border border-cream/10 bg-cream/[0.04] px-2.5 py-1 text-[11.5px] text-cream/55"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : null}

      {request.opener && request.status === "CLAIMED" ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-cream/8 bg-cream/[0.03] px-3 py-2.5 text-[12.5px] leading-5 text-cream/60">
          <MessageSquare size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
          {request.opener}
        </p>
      ) : null}

      {request.status === "CLAIMED" ? (
        <div className="mt-3.5 space-y-3">
          <HelpCall requestId={request.id} onSnapshot={setSnapshot} onEnded={onCallEnded} />
          <LearnerWorkspaceView snapshot={snapshot} captured={request.capturedWorkspace} />
          <SafetyControls requestId={request.id} onActioned={onCallEnded} />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => onAct(request.id, primary.action)}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-cream px-3.5 text-[13px] font-semibold text-[#171a16] transition hover:bg-white disabled:pointer-events-none disabled:opacity-45"
        >
          {busy ? (
            <Loader2 size={12} className="animate-spin" aria-hidden="true" />
          ) : (
            <UserRound size={12} aria-hidden="true" />
          )}
          {primary.label}
        </button>

        {secondary ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onAct(request.id, secondary.action)}
            className="inline-flex h-9 items-center rounded-xl px-3 text-[13px] text-cream/45 transition hover:text-cream/75 disabled:opacity-45"
          >
            {secondary.label}
          </button>
        ) : null}
      </div>
    </article>
  );
}
