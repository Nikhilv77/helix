"use client";

import Image from "next/image";
import { ArrowRight, Mic, UserCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { HelpHistoryParticipant } from "@/lib/help/help-history";
import { holdPeerHelpPrompt } from "@/lib/help/help-ui-events";
import { ProfileAvatar } from "../profile/profile-avatar";

export function HelperReadyToast({
  title,
  helper,
  onJoin
}: {
  title: string;
  helper: HelpHistoryParticipant;
  onJoin: () => void;
}) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalTarget(document.querySelector<HTMLElement>(".workspace-black") ?? document.body);
    return holdPeerHelpPrompt();
  }, []);

  if (!portalTarget) return null;

  return createPortal(
    <>
      <div
        aria-hidden="true"
        data-testid="helper-ready-backdrop"
        className="pointer-events-none fixed inset-0 z-[99] bg-black/25 backdrop-blur-[5px]"
      />
      <aside className="fixed left-1/2 top-1/2 z-[100] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[1.5rem] bg-[#18191c]/[0.99] shadow-[0_32px_110px_-28px_rgba(0,0,0,0.98)] backdrop-blur-xl">
        <div className="h-0.5 w-full bg-[var(--workspace-accent)]" />
        <div className="p-5 sm:p-6">
          {helper.profileImage ? (
            <Image
              src={helper.profileImage}
              alt=""
              width={44}
              height={44}
              className="h-11 w-11 rounded-2xl object-cover"
            />
          ) : (
            <span className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-2xl bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]">
              <ProfileAvatar
                name={helper.label}
                className="absolute inset-0 h-full w-full object-cover opacity-35"
              />
              <UserCheck size={19} className="relative" aria-hidden="true" />
            </span>
          )}
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--workspace-accent)]">
            {helper.label} is your Trailmate
          </p>
          <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.02em] text-cream">
            Meet {helper.label}
          </h2>
          <p className="mt-2 text-[13px] leading-5 text-cream/48">
            {helper.label} is ready to work through {title} with you. Join the private room when
            you’re ready to talk and keep coding together.
          </p>
          <button
            type="button"
            autoFocus
            onClick={onJoin}
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cream px-4 text-[13px] font-semibold text-[#17181a] transition hover:bg-white"
          >
            <Mic size={14} aria-hidden="true" />
            Join Trailmate room
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
      </aside>
    </>,
    portalTarget
  );
}
