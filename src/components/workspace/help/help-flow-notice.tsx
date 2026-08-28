"use client";

import { AlertCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { holdPeerHelpPrompt } from "@/lib/help/help-ui-events";

/** Centered, themed feedback for a help action that could not be completed. */
export function HelpFlowNotice({
  eyebrow = "Invitation not sent",
  title,
  message,
  onClose
}: {
  eyebrow?: string;
  title: string;
  message: string;
  onClose: () => void;
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
        data-testid="help-flow-notice-backdrop"
        className="fixed inset-0 z-[109] bg-black/25 backdrop-blur-[5px]"
      />
      <aside
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="help-flow-notice-title"
        aria-describedby="help-flow-notice-message"
        className="fixed left-1/2 top-1/2 z-[110] w-[min(27rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[1.5rem] bg-[#18191c]/[0.99] shadow-[0_32px_110px_-28px_rgba(0,0,0,0.98)] backdrop-blur-xl"
      >
        <div className="h-0.5 bg-[var(--workspace-accent)]" />
        <div className="relative p-5 sm:p-6">
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg text-cream/35 transition hover:bg-white/[0.05] hover:text-cream/70"
          >
            <X size={15} aria-hidden="true" />
          </button>
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]">
            <AlertCircle size={19} aria-hidden="true" />
          </span>
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--workspace-accent)]">
            {eyebrow}
          </p>
          <h2
            id="help-flow-notice-title"
            className="mt-1.5 pr-6 text-xl font-semibold tracking-[-0.02em] text-cream"
          >
            {title}
          </h2>
          <p id="help-flow-notice-message" className="mt-2 text-[13px] leading-5 text-cream/48">
            {message}
          </p>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-cream px-4 text-[13px] font-semibold text-[#17181a] transition hover:bg-white"
          >
            Got it
          </button>
        </div>
      </aside>
    </>,
    portalTarget
  );
}
