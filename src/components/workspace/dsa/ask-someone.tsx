"use client";

import { Check, Loader2, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { hintsUsedFor } from "@/lib/dsa/hint-tracker";
import { HelperReadyToast } from "../help/helper-ready-toast";
import { HelpFlowNotice } from "../help/help-flow-notice";
import { HelpRating } from "../help/help-rating";
import { SafetyControls } from "../help/safety-controls";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CodeSelection, WorkspaceTestCase } from "@/lib/help/snapshot";
import type { HelpHistoryParticipant } from "@/lib/help/help-history";
import { peerHelpRoomHref } from "@/lib/help/help-room-navigation";
import { showCurrentPeerHelp } from "@/lib/help/help-ui-events";

type LiveRequest = { id: string; status: string | null; helper: HelpHistoryParticipant | null };
type HelpNotice =
  { kind: "cooldown"; title: string } | { kind: "error"; title: string; message: string };

const DELIVERY_SECONDS = 15;
const DEFAULT_COOLDOWN_MS = 10 * 60_000;

/**
 * The human-help escalation, sitting beside Run code.
 *
 * Deliberately quiet. Maya stays the default helper and this is the step past
 * her, so it reads as a secondary action rather than competing with the primary
 * one. It is also non-blocking by design: asking does not interrupt the editor,
 * because the answer to "can I keep working while I wait" has to be yes when
 * nobody may be available for hours.
 */
export function AskSomeone({
  slug,
  title,
  language,
  code,
  testOutput,
  failingTests,
  runStatus = null,
  tests = null,
  selection,
  startedAt
}: {
  slug: string;
  title: string;
  language: string;
  code: string;
  testOutput: string | null;
  failingTests: number | null;
  runStatus?: string | null;
  tests?: WorkspaceTestCase[] | null;
  selection: CodeSelection | null;
  /** When this attempt began, so the request can report time spent. */
  startedAt: number;
}) {
  const router = useRouter();
  const [live, setLive] = useState<LiveRequest | null>(null);
  /** How many people have finished this problem. Null until the check returns. */
  const [helperCount, setHelperCount] = useState<number | null>(null);
  /** Set once a conversation ends, so the rating replaces the call controls. */
  const [rateFor, setRateFor] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<HelpNotice | null>(null);
  const [deliverySeconds, setDeliverySeconds] = useState<number | null>(null);
  const [invitationsSent, setInvitationsSent] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  // Read inside callbacks so a slow request still reports the code as it was
  // when the learner pressed the button, not a stale closure.
  const snapshot = useRef({
    code,
    language,
    testOutput,
    failingTests,
    runStatus,
    tests,
    selection
  });
  snapshot.current = { code, language, testOutput, failingTests, runStatus, tests, selection };

  // A request outlives the page, so resume its state rather than offering to
  // open a second one that the server would reject.
  useEffect(() => {
    let cancelled = false;

    void fetch(
      `/api/help/request?slug=${encodeURIComponent(slug)}&language=${encodeURIComponent(language)}`
    )
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (cancelled || !payload?.success || !payload.data) return;
        setHelperCount(payload.data.helperCount ?? 0);
        if (payload.data.id) {
          setLive({
            id: payload.data.id,
            status: payload.data.status,
            helper: payload.data.helper ?? null
          });
        } else if (payload.data.ratingRequestId) {
          setRateFor(payload.data.ratingRequestId);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [language, slug]);

  const refresh = useCallback(async () => {
    const response = await fetch(
      `/api/help/request?slug=${encodeURIComponent(slug)}&language=${encodeURIComponent(language)}`
    ).catch(() => null);
    const payload = await response?.json().catch(() => null);
    if (!payload?.success || !payload.data) return;
    setHelperCount(payload.data.helperCount ?? 0);
    const nextLive = payload.data.id
      ? {
          id: payload.data.id,
          status: payload.data.status,
          helper: payload.data.helper ?? null
        }
      : null;
    setLive(nextLive);
    if (!nextLive && payload.data.ratingRequestId) {
      setRateFor(payload.data.ratingRequestId);
    }
  }, [language, slug]);

  // Keep every live transition authoritative. A helper claim can return to OPEN
  // if they never enter the room, so CLAIMED must keep polling too.
  useEffect(() => {
    if (!live) return;
    const refreshOnFocus = () => void refresh();
    const timer = window.setInterval(refreshOnFocus, 15_000);
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [live?.status, refresh]);

  const isDelivering = live?.status === "OPEN" && deliverySeconds !== null;

  // Match the helper's delivery window with a small, honest countdown. The
  // learner can keep editing throughout; this is status, not a blocking modal.
  useEffect(() => {
    if (!isDelivering) return;
    const timer = window.setInterval(() => {
      setDeliverySeconds((current) => (current === null || current <= 1 ? null : current - 1));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [isDelivering]);

  const beginCooldown = useCallback((durationMs: number) => {
    const safeDuration = Math.max(1_000, durationMs);
    setCooldownUntil(Date.now() + safeDuration);
    setCooldownSeconds(Math.ceil(safeDuration / 1_000));
  }, []);

  useEffect(() => {
    if (cooldownUntil === null) return;

    const update = () => {
      const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1_000));
      setCooldownSeconds(remaining);
      if (remaining === 0) {
        setCooldownUntil(null);
        setNotice((current) => (current?.kind === "cooldown" ? null : current));
      }
    };
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  const ask = useCallback(async () => {
    if (pending || live || cooldownSeconds > 0) return;
    if (helperCount === 0) {
      setNotice({
        kind: "error",
        title: "No Trailmates are available",
        message: "Your invitation was not sent. Keep working with Maya and try again shortly."
      });
      return;
    }
    setPending(true);
    setNotice(null);

    try {
      const response = await fetch("/api/help/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          language: snapshot.current.language,
          code: snapshot.current.code,
          testOutput: snapshot.current.testOutput,
          failingTests: snapshot.current.failingTests,
          runStatus: snapshot.current.runStatus,
          tests: snapshot.current.tests,
          selection: snapshot.current.selection,
          // Read at click time, not render time: the coach may hand out more
          // hints between this component mounting and the button being pressed.
          hintsUsed: hintsUsedFor(slug),
          timeSpentMs: Math.max(0, Date.now() - startedAt)
        })
      });

      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        data?: {
          id: string;
          status: string;
          invitationsSent?: number;
          cooldownMs?: number;
        };
        error?: {
          code?: string;
          message?: string;
          details?: { retryAfterMs?: number };
        };
      } | null;

      if (!response.ok || !payload?.success || !payload.data) {
        if (
          payload?.error?.code === "HELP_ENGAGEMENT_ACTIVE" ||
          payload?.error?.code === "HELP_ALREADY_LIVE"
        ) {
          showCurrentPeerHelp();
          return;
        }
        if (payload?.error?.code === "HELP_REQUEST_RATE_LIMITED") {
          beginCooldown(payload.error.details?.retryAfterMs ?? DEFAULT_COOLDOWN_MS);
          setNotice({ kind: "cooldown", title: "Ask a mate is cooling down" });
          return;
        }
        if (
          payload?.error?.code === "HELP_NO_AVAILABLE_HELPERS" ||
          payload?.error?.code === "HELP_INVITATION_NOT_SENT"
        ) {
          setNotice({
            kind: "error",
            title:
              payload.error.code === "HELP_NO_AVAILABLE_HELPERS"
                ? "No Trailmates are available"
                : "We couldn’t send the invitation",
            message: payload.error.message ?? "No invitation was sent. Please try again."
          });
          return;
        }
        throw new Error(payload?.error?.message ?? "Could not send that request.");
      }

      beginCooldown(payload.data.cooldownMs ?? DEFAULT_COOLDOWN_MS);
      setInvitationsSent(Math.max(1, payload.data.invitationsSent ?? 1));
      setLive({ id: payload.data.id, status: payload.data.status, helper: null });
      setDeliverySeconds(DELIVERY_SECONDS);
    } catch (caught) {
      setNotice({
        kind: "error",
        title: "We couldn’t send the invitation",
        message: caught instanceof Error ? caught.message : "Could not send that request."
      });
    } finally {
      setPending(false);
    }
  }, [beginCooldown, cooldownSeconds, helperCount, live, pending, slug, startedAt]);

  const withdraw = useCallback(async () => {
    if (!live || pending) return;
    setPending(true);

    try {
      const response = await fetch(`/api/help/request?id=${encodeURIComponent(live.id)}`, {
        method: "DELETE"
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error?.message ?? "Could not withdraw that request.");
      }
      setLive(null);
      setDeliverySeconds(null);
      setInvitationsSent(0);
    } catch (caught) {
      setNotice({
        kind: "error",
        title: "We couldn’t withdraw the request",
        message: caught instanceof Error ? caught.message : "Could not withdraw that request."
      });
    } finally {
      setPending(false);
    }
  }, [live, pending]);

  const noticeToast = notice ? (
    <HelpFlowNotice
      eyebrow={notice.kind === "cooldown" ? "Please wait" : undefined}
      title={notice.title}
      message={
        notice.kind === "cooldown"
          ? `You can send another invitation in ${cooldownSeconds} ${
              cooldownSeconds === 1 ? "second" : "seconds"
            }.`
          : notice.message
      }
      onClose={() => setNotice(null)}
    />
  ) : null;

  if (rateFor) {
    return (
      <>
        <HelpRating requestId={rateFor} onCompleted={() => setRateFor(null)} />
        {noticeToast}
      </>
    );
  }

  if (live?.status === "CLAIMED") {
    return (
      <>
        <div className="flex w-full flex-wrap items-center gap-2.5">
          <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-cream/12 bg-cream/[0.05] px-3.5 text-[13px] font-medium text-cream/75">
            <Check size={13} aria-hidden="true" style={{ color: "var(--workspace-accent)" }} />
            {live.helper?.label ?? "Your Trailmate"} is ready
          </span>
          <SafetyControls requestId={live.id} onActioned={() => void refresh()} />
          <HelperReadyToast
            title={title}
            helper={live.helper ?? { label: "Your Trailmate", headline: null, profileImage: null }}
            onJoin={() =>
              router.push(peerHelpRoomHref(live.id, `/dsa-questions/${encodeURIComponent(slug)}`))
            }
          />
        </div>
        {noticeToast}
      </>
    );
  }

  if (live) {
    return (
      <>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-cream/12 bg-cream/[0.05] px-3.5 text-[13px] font-medium text-cream/75">
            {isDelivering ? (
              <>
                <Loader2
                  size={13}
                  className="animate-spin"
                  aria-hidden="true"
                  style={{ color: "var(--workspace-accent)" }}
                />
                <span>Delivering your request</span>
                <span
                  aria-label={`${deliverySeconds} seconds remaining`}
                  className="min-w-7 rounded-md bg-cream/[0.07] px-1.5 py-0.5 text-center text-[11px] tabular-nums text-cream/55"
                >
                  {deliverySeconds}s
                </span>
              </>
            ) : (
              <>
                <Check size={13} aria-hidden="true" style={{ color: "var(--workspace-accent)" }} />
                {invitationsSent === 1
                  ? "Invitation sent to 1 Trailmate — waiting"
                  : `Invitations sent to ${invitationsSent} Trailmates — waiting`}
              </>
            )}
          </span>
          <button
            type="button"
            onClick={() => void withdraw()}
            disabled={pending}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-[13px] text-cream/45 transition hover:text-cream/75 disabled:opacity-45"
          >
            <X size={12} aria-hidden="true" />
            Withdraw
          </button>
        </div>
        {noticeToast}
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => void ask()}
          disabled={pending || !code.trim() || cooldownSeconds > 0}
          title="Ask a Trailmate who has already solved this"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-cream/[0.05] px-3.5 text-[13px] font-medium text-cream/80 transition hover:bg-cream/[0.09] hover:text-cream disabled:pointer-events-none disabled:opacity-45"
        >
          {pending ? (
            <Loader2 size={13} className="animate-spin" aria-hidden="true" />
          ) : (
            <UserRound size={13} aria-hidden="true" />
          )}
          {cooldownSeconds > 0 ? `Ask again in ${formatCooldown(cooldownSeconds)}` : "Ask a mate"}
        </button>
      </div>
      {noticeToast}
    </>
  );
}

function formatCooldown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
