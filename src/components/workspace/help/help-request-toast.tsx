"use client";

import Image from "next/image";
import { HandHelping, Loader2, Mic } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HelpInboxRequest } from "@/lib/help/help-inbox";
import { peerHelpRoomHref } from "@/lib/help/help-room-navigation";
import { showCurrentPeerHelp } from "@/lib/help/help-ui-events";
import { ProfileAvatar } from "../profile/profile-avatar";
import { useWorkspaceHelpPolling } from "./workspace-help-polling";

const VISIBLE_MS = 14_000;

type ToastRequest = Pick<
  HelpInboxRequest,
  "id" | "title" | "language" | "estimatedMinutes" | "learner"
>;

/**
 * A quiet, actionable heads-up for qualified helpers.
 *
 * The durable notification remains in the regular inbox. This toast is only the
 * fast path: it never covers the page and it offers exactly the two decisions a
 * helper needs to make — accept the voice conversation or decline it.
 */
export function HelpRequestToast() {
  const router = useRouter();
  const { inbox, refresh } = useWorkspaceHelpPolling();
  const [request, setRequest] = useState<ToastRequest | null>(null);
  const [busy, setBusy] = useState<"claim" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (request || busy) return;
    const next = inbox?.open.find((item) => !seen.current.has(item.id));
    if (!next) return;
    seen.current.add(next.id);
    setError(null);
    setRequest(next);
  }, [busy, inbox, request]);

  useEffect(() => {
    if (!request || !inbox || busy) return;
    if (inbox.open.some((item) => item.id === request.id)) return;
    setRequest(null);
  }, [busy, inbox, request]);

  useEffect(() => {
    if (!request || busy) return;
    const timer = window.setTimeout(() => setRequest(null), VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [busy, error, request]);

  const act = useCallback(
    async (action: "claim" | "decline") => {
      if (!request || busy) return;
      setBusy(action);
      setError(null);

      try {
        const response = await fetch(`/api/help/request/${encodeURIComponent(request.id)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action })
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          if (action === "claim" && payload?.error?.code === "HELP_HELPER_UNAVAILABLE") {
            setRequest(null);
            showCurrentPeerHelp();
            void refresh();
            return;
          }
          throw new Error(payload?.error?.message ?? "That request is no longer available.");
        }

        const requestId = request.id;
        const returnTo = `${window.location.pathname}${window.location.search}`;
        setRequest(null);
        if (action === "claim") {
          router.push(peerHelpRoomHref(requestId, returnTo));
        }
        void refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "That did not work.");
        void refresh();
      } finally {
        setBusy(null);
      }
    },
    [busy, refresh, request, router]
  );

  if (!request) return null;

  return (
    <aside
      aria-label="New Trailmate request"
      aria-live="polite"
      className="fixed inset-x-3 top-16 z-[75] ml-auto max-w-[24rem] overflow-hidden rounded-2xl  bg-[#18191c]/[0.98] shadow-[0_24px_80px_-28px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:right-5 sm:top-5"
    >
      <div className="h-0.5 w-full bg-[var(--workspace-accent)]" />
      <div className="p-4 sm:p-[1.125rem]">
        <div className="flex items-start gap-3">
          {request.learner?.profileImage ? (
            <Image
              src={request.learner.profileImage}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]">
              <ProfileAvatar
                name={request.learner?.label ?? "Candidate"}
                className="absolute inset-0 h-full w-full object-cover opacity-30"
              />
              <HandHelping size={17} className="relative" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--workspace-accent)]">
              {request.learner?.label ?? "A candidate"} asked for a mate
            </p>
            <p className="mt-1 truncate text-[14px] font-semibold text-cream">{request.title}</p>
            <p className="mt-1 text-[12px] text-cream/45">
              {request.language}
              {request.estimatedMinutes ? ` · about ${request.estimatedMinutes} min` : ""}
            </p>
          </div>
        </div>

        {error ? <p className="mt-3 text-[12px] text-[#ffb4b4]">{error}</p> : null}

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void act("claim")}
            className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl bg-cream px-3 text-[12.5px] font-semibold text-[#17181a] transition hover:bg-white disabled:opacity-50"
          >
            {busy === "claim" ? (
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
            ) : (
              <Mic size={13} aria-hidden="true" />
            )}
            Join them
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void act("decline")}
            className="h-9 rounded-xl border border-cream/10 px-4 text-[12.5px] font-medium text-cream/55 transition hover:border-cream/20 hover:text-cream disabled:opacity-50"
          >
            {busy === "decline" ? "Declining…" : "Decline"}
          </button>
        </div>
      </div>
    </aside>
  );
}
