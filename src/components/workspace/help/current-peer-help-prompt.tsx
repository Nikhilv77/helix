"use client";

import Image from "next/image";
import { ArrowRight, HandHelping, Loader2, LogOut, Mic, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import type { CurrentPeerHelpEngagement } from "@/lib/help/help-history";
import { peerHelpRoomHref } from "@/lib/help/help-room-navigation";
import {
  announcePeerHelpEnded,
  SHOW_CURRENT_PEER_HELP_EVENT,
  holdPeerHelpPrompt
} from "@/lib/help/help-ui-events";
import { ProfileAvatar } from "../profile/profile-avatar";

/** Shown only after a conflicting ask/accept, with the action that frees or resumes the seat. */
export function CurrentPeerHelpPrompt() {
  const pathname = usePathname();
  const router = useRouter();
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [engagement, setEngagement] = useState<CurrentPeerHelpEngagement | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/help/active", { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) return;
      setError(null);
      setEngagement((payload.data as CurrentPeerHelpEngagement | null) ?? null);
    } catch {
      setError("Could not load your current Trailmate session.");
    }
  }, []);

  useEffect(() => {
    setPortalTarget(document.querySelector<HTMLElement>(".workspace-black") ?? document.body);
    const show = () => void load();
    window.addEventListener(SHOW_CURRENT_PEER_HELP_EVENT, show);
    return () => window.removeEventListener(SHOW_CURRENT_PEER_HELP_EVENT, show);
  }, [load]);

  useEffect(() => {
    if (!engagement) return;
    return holdPeerHelpPrompt();
  }, [engagement]);

  const close = () => {
    if (pending) return;
    setError(null);
    setEngagement(null);
  };

  const openCurrent = () => {
    if (!engagement) return;
    setEngagement(null);
    if (engagement.status === "OPEN") {
      router.push(`/dsa-questions/${encodeURIComponent(engagement.slug)}`);
      return;
    }
    const returnTo = `${pathname ?? "/trailmate"}${window.location.search}`;
    router.push(peerHelpRoomHref(engagement.requestId, returnTo));
  };

  const freeSeat = useCallback(async () => {
    if (!engagement || pending) return;
    setPending(true);
    setError(null);
    try {
      const learnerWaiting = engagement.seat === "learner" && engagement.status === "OPEN";
      const response = learnerWaiting
        ? await fetch(`/api/help/request?id=${encodeURIComponent(engagement.requestId)}`, {
            method: "DELETE"
          })
        : await fetch(`/api/help/request/${encodeURIComponent(engagement.requestId)}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "release" })
          });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error?.message ?? "Could not update that engagement.");
      }
      announcePeerHelpEnded(engagement.requestId);
      setEngagement(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update that engagement.");
    } finally {
      setPending(false);
    }
  }, [engagement, pending]);

  if (!portalTarget || !engagement) return null;

  const waiting = engagement.status === "OPEN";
  const helperReady = !waiting && !engagement.started;
  const canFreeSeat = waiting || (engagement.seat === "helper" && helperReady);
  const peerName = engagement.peer?.label ?? "your peer";
  const eyebrow = waiting
    ? "Request already active"
    : engagement.started
      ? "Trailmate in progress"
      : "Trailmate room ready";
  const heading = waiting
    ? `You’ve already asked a mate about ${engagement.title}`
    : `${engagement.title} with ${peerName}`;

  return createPortal(
    <>
      <div
        aria-hidden="true"
        data-testid="current-peer-help-backdrop"
        className="fixed inset-0 z-[109] bg-black/25 backdrop-blur-[5px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="current-peer-help-title"
        className="fixed left-1/2 top-1/2 z-[110] w-[min(29rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[1.5rem] bg-[#18191c]/[0.99] shadow-[0_32px_110px_-28px_rgba(0,0,0,0.98)] backdrop-blur-xl"
      >
        <div className="h-0.5 bg-[var(--workspace-accent)]" />
        <div className="relative p-5 sm:p-6">
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            disabled={pending}
            className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg text-cream/35 transition hover:bg-white/[0.05] hover:text-cream/70 disabled:opacity-40"
          >
            <X size={15} aria-hidden="true" />
          </button>

          {engagement.peer?.profileImage ? (
            <Image
              src={engagement.peer.profileImage}
              alt=""
              width={44}
              height={44}
              className="h-11 w-11 rounded-2xl object-cover"
            />
          ) : (
            <span className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-2xl bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]">
              <ProfileAvatar
                name={engagement.peer?.label ?? "Trailmate"}
                className="absolute inset-0 h-full w-full object-cover opacity-30"
              />
              <HandHelping size={18} className="relative" aria-hidden="true" />
            </span>
          )}

          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--workspace-accent)]">
            {eyebrow}
          </p>
          <h2
            id="current-peer-help-title"
            className="mt-1.5 pr-6 text-xl font-semibold tracking-[-0.02em] text-cream"
          >
            {heading}
          </h2>
          <p className="mt-2 text-[13px] leading-5 text-cream/48">
            {waiting
              ? "View or withdraw this request before asking a mate about another problem."
              : engagement.started
                ? `Resume your room with ${peerName} before starting another Trailmate session.`
                : engagement.seat === "helper"
                  ? `Join ${peerName} now, or hand the request back so another mate can take it.`
                  : `${peerName} is ready. Join this room before starting another Trailmate session.`}
          </p>

          {error ? <p className="mt-3 text-[12px] text-[#ffb4b4]">{error}</p> : null}

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              autoFocus
              onClick={openCurrent}
              disabled={pending}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-cream px-4 text-[13px] font-semibold text-[#17181a] transition hover:bg-white disabled:opacity-45"
            >
              {waiting ? (
                <ArrowRight size={14} aria-hidden="true" />
              ) : (
                <Mic size={14} aria-hidden="true" />
              )}
              {waiting
                ? "View current request"
                : engagement.started
                  ? "Resume session"
                  : "Join Trailmate room"}
              {!waiting ? <ArrowRight size={14} aria-hidden="true" /> : null}
            </button>
            {canFreeSeat ? (
              <button
                type="button"
                onClick={() => void freeSeat()}
                disabled={pending}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-cream/10 px-3.5 text-[13px] font-medium text-cream/55 transition hover:border-cream/20 hover:text-cream disabled:opacity-45"
              >
                {pending ? (
                  <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                ) : (
                  <LogOut size={13} aria-hidden="true" />
                )}
                {waiting ? "Withdraw" : "Hand back"}
              </button>
            ) : null}
          </div>
        </div>
      </aside>
    </>,
    portalTarget
  );
}
