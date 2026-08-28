"use client";

import { Check, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * One lightweight outcome question after a learner leaves the voice room.
 *
 * The existing 1–5 storage remains compatible with historical data: Yes is
 * stored as 5 and No as 1. Yes is intentionally the primary/default action.
 */
export function HelpRating({
  requestId,
  onCompleted
}: {
  requestId: string;
  onCompleted?: () => void;
}) {
  const [pending, setPending] = useState<"yes" | "no" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const yesButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setPortalTarget(document.querySelector<HTMLElement>(".workspace-black") ?? document.body);
  }, []);

  const answer = useCallback(
    async (helped: boolean) => {
      if (pending) return;
      setPending(helped ? "yes" : "no");
      setError(null);

      try {
        const response = await fetch(`/api/help/session/${encodeURIComponent(requestId)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "rate", rating: helped ? 5 : 1 })
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success || payload.data?.rated !== true) {
          throw new Error("Could not save that answer.");
        }

        onCompleted?.();
      } catch {
        setError("Could not save that answer. Please try again.");
        setPending(null);
        window.requestAnimationFrame(() => yesButton.current?.focus());
      }
    },
    [onCompleted, pending, requestId]
  );

  if (!portalTarget) return null;

  return createPortal(
    <>
      <div
        aria-hidden="true"
        data-testid="help-rating-backdrop"
        className="pointer-events-none fixed inset-0 z-[99] bg-black/25 backdrop-blur-[5px]"
      />
      <aside
        aria-live="polite"
        className="fixed left-1/2 top-1/2 z-[100] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[1.5rem] bg-[#18191c]/[0.99] shadow-[0_32px_110px_-28px_rgba(0,0,0,0.98)] backdrop-blur-xl"
      >
        <div className="h-0.5 w-full bg-[var(--workspace-accent)]" />
        <div className="p-4 sm:p-[1.125rem]">
          <section role="dialog" aria-labelledby="help-outcome-title" className="text-left">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]">
                <Check size={17} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--workspace-accent)]">
                  Conversation ended
                </p>
                <h2 id="help-outcome-title" className="mt-1 text-[14px] font-semibold text-cream">
                  Did that help?
                </h2>
                <p className="mt-1 text-[12px] leading-5 text-cream/45">
                  Your answer improves helper recognition and future matching.
                </p>
              </div>
            </div>

            {error ? <p className="mt-3 text-[12px] text-[#ffb4b4]">{error}</p> : null}

            <div className="mt-4 flex items-center gap-2">
              <button
                ref={yesButton}
                autoFocus
                type="button"
                disabled={pending !== null}
                onClick={() => void answer(true)}
                className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl bg-cream px-3 text-[12.5px] font-semibold text-[#17181a] transition hover:bg-white disabled:opacity-50"
              >
                {pending === "yes" ? (
                  <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Check size={13} aria-hidden="true" />
                )}
                Yes, it helped
              </button>
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => void answer(false)}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-cream/10 px-4 text-[12.5px] font-medium text-cream/55 transition hover:border-cream/20 hover:text-cream disabled:opacity-50"
              >
                {pending === "no" ? (
                  <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                ) : (
                  <X size={13} aria-hidden="true" />
                )}
                No
              </button>
            </div>
          </section>
        </div>
      </aside>
    </>,
    portalTarget
  );
}
