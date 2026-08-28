"use client";

import Image from "next/image";
import { ArrowRight, Mic2, UsersRound } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import type { ActivePeerHelp } from "@/lib/help/help-history";
import { peerHelpRoomHref } from "@/lib/help/help-room-navigation";
import { ProfileAvatar } from "../profile/profile-avatar";

const POLL_MS = 15_000;

/** Persistent, non-blocking way back to a live peer-help room for either seat. */
export function ActivePeerHelpToast() {
  const pathname = usePathname();
  const router = useRouter();
  const [active, setActive] = useState<ActivePeerHelp | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/help/active");
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) return;
      setActive((payload.data as ActivePeerHelp | null) ?? null);
    } catch {
      // The room remains reachable from Peer Help if a quiet poll misses.
    }
  }, []);

  useEffect(() => {
    void load();
    const refreshVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = window.setInterval(refreshVisible, POLL_MS);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [load]);

  if (!active || pathname?.startsWith("/help/room/")) return null;

  const resume = () => {
    const returnTo = `${pathname ?? "/help"}${window.location.search}`;
    router.push(peerHelpRoomHref(active.requestId, returnTo));
  };

  return (
    <aside
      aria-label={`Active peer help with ${active.peer.label}`}
      className="fixed bottom-4 left-3 right-3 z-[80] ml-auto max-w-[25rem] overflow-hidden rounded-2xl bg-[#18191c]/[0.98] shadow-[0_24px_80px_-28px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:bottom-5 sm:left-auto sm:right-5"
    >
      <div className="h-0.5 bg-[var(--workspace-accent)]" />
      <div className="flex items-center gap-3 p-3.5">
        {active.peer.profileImage ? (
          <Image
            src={active.peer.profileImage}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]">
            <ProfileAvatar
              name={active.peer.label}
              className="absolute inset-0 h-full w-full object-cover opacity-30"
            />
            <UsersRound size={16} className="relative" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--workspace-accent)]">
            {active.started ? "Meeting in progress" : "Room ready"}
          </p>
          <p className="mt-0.5 truncate text-[13px] font-semibold text-cream">
            Peer help with {active.peer.label}
          </p>
          <p className="mt-0.5 truncate text-[11.5px] text-cream/42">{active.title}</p>
        </div>
        <button
          type="button"
          onClick={resume}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-cream px-3 text-[12px] font-semibold text-[#17181a] transition hover:bg-white"
        >
          <Mic2 size={12} aria-hidden="true" />
          Join
          <ArrowRight size={12} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
