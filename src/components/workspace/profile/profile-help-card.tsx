"use client";

import { ChevronRight, HandHelping, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { HelpInbox, type HelpInboxStats } from "@/components/workspace/help/help-inbox";

const EMPTY_STATS: HelpInboxStats = { available: 0, claimed: 0, helpedPeople: 0 };

function peopleLabel(count: number): string {
  if (count === 0) return "Become a Trailmate";
  return `Supported ${count} ${count === 1 ? "person" : "people"}`;
}

/** Compact profile entry point for helping, with the full inbox in a dialog. */
export function ProfileHelpCard() {
  const [stats, setStats] = useState<HelpInboxStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const openButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch("/api/help/inbox");
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success || !payload.data) return;

      setStats({
        available: payload.data.open?.length ?? 0,
        claimed: payload.data.claimed?.length ?? 0,
        helpedPeople: payload.data.helpedPeopleCount ?? 0
      });
    } catch {
      // The activity card is supplementary; a transient inbox failure should
      // not turn the whole Profile page into an error state.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
    window.addEventListener("focus", loadStats);
    return () => window.removeEventListener("focus", loadStats);
  }, [loadStats]);

  // Notification links and the old /help redirect can open a particular card.
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("help") === "1" || query.has("request")) setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    void loadStats();
    window.requestAnimationFrame(() => openButton.current?.focus());

    const url = new URL(window.location.href);
    url.searchParams.delete("help");
    url.searchParams.delete("request");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  }, [loadStats]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    closeButton.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [close, open]);

  const updateStats = useCallback((next: HelpInboxStats) => setStats(next), []);
  const active = stats.available + stats.claimed;

  return (
    <>
      <section className="profile-soft-reveal mx-auto mt-6 w-full max-w-6xl px-1">
        <button
          ref={openButton}
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="profile-glass group flex w-full items-center gap-4 rounded-2xl px-5 py-4 text-left transition duration-200 hover:bg-white/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)] sm:px-6"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#71d6a5]/12 text-[#9be8c1] shadow-soft-inset">
            <HandHelping size={19} aria-hidden="true" />
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-semibold text-cream">
                {loading ? "Your Trailmate activity" : peopleLabel(stats.helpedPeople)}
              </span>
              {active > 0 ? (
                <span className="rounded-full bg-[var(--workspace-accent)] px-2 py-0.5 text-[10.5px] font-bold text-[#17191a]">
                  {active} active
                </span>
              ) : null}
            </span>
            <span className="mt-1 block text-xs leading-5 text-cream/45">
              {loading
                ? "Checking for people you can support…"
                : stats.claimed > 0
                  ? `${stats.claimed} accepted ${stats.claimed === 1 ? "request" : "requests"} waiting for you.`
                  : stats.available > 0
                    ? `${stats.available} ${stats.available === 1 ? "person is" : "people are"} looking for a mate.`
                    : "Open Trailmate when someone asks for a mate."}
            </span>
          </span>

          {loading ? (
            <Loader2 size={16} className="shrink-0 animate-spin text-cream/35" aria-hidden="true" />
          ) : (
            <ChevronRight
              size={18}
              className="shrink-0 text-cream/35 transition group-hover:translate-x-0.5 group-hover:text-cream/65"
              aria-hidden="true"
            />
          )}
        </button>
      </section>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-help-title"
            className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[1.5rem] border border-cream/12 bg-[#121315] shadow-[0_40px_100px_rgba(0,0,0,0.65)] sm:max-h-[88dvh] sm:rounded-[1.5rem]"
          >
            <header className="flex shrink-0 items-start justify-between gap-5 border-b border-cream/8 px-5 py-4 sm:px-6 sm:py-5">
              <div>
                <h2 id="profile-help-title" className="text-xl font-semibold text-cream">
                  Trailmate inbox
                </h2>
                <p className="mt-1 text-[13px] leading-5 text-cream/45">
                  Joining is optional. Pick up a request when you have a few minutes.
                </p>
              </div>
              <button
                ref={closeButton}
                type="button"
                onClick={close}
                aria-label="Close Trailmate inbox"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-cream/50 transition hover:bg-cream/[0.07] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)]"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 sm:py-6">
              <HelpInbox onStatsChange={updateStats} />
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
