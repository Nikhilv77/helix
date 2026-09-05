"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, SkipForward } from "lucide-react";

type AttemptAction = "open" | "skip";
type Marked = "none" | "complete" | "skip";

/**
 * Mark done / skip for a question, persisted to the user's roadmap.
 *
 * `initialStatus` comes from the server so a completed question still reads as
 * completed after a refresh — the local state only tracks changes made here.
 */
export function DsaQuestionActions({
  slug,
  nextHref,
  initialStatus = null
}: {
  slug: string;
  nextHref: string | null;
  initialStatus?: string | null;
}) {
  const router = useRouter();
  const opened = useRef(false);
  const requestIds = useRef<Partial<Record<AttemptAction, string>>>({});
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [marked, setMarked] = useState<Marked>(
    initialStatus === "COMPLETED" ? "complete" : initialStatus === "SKIPPED" ? "skip" : "none"
  );

  useEffect(() => {
    setMarked(
      initialStatus === "COMPLETED" ? "complete" : initialStatus === "SKIPPED" ? "skip" : "none"
    );
  }, [initialStatus]);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    const requestId = requestIds.current.open ?? crypto.randomUUID();
    requestIds.current.open = requestId;
    void recordAttempt(slug, "open", requestId).catch(() => {
      // Opening a question page should never fail the page itself.
    });
  }, [slug]);

  function skip() {
    setError(null);

    // The write recalculates the whole roadmap and takes seconds against a
    // remote database. Showing the result immediately and rolling back on
    // failure keeps the click feeling instant without ever claiming progress
    // that did not persist.
    const previous = marked;
    setMarked("skip");
    const requestId = requestIds.current.skip ?? crypto.randomUUID();
    requestIds.current.skip = requestId;

    startTransition(async () => {
      const ok = await recordAttempt(slug, "skip", requestId)
        .then(() => true)
        .catch(() => false);

      if (!ok) {
        setMarked(previous);
        setError("Could not save. Check your connection and try again.");
        return;
      }

      if (nextHref) {
        router.push(nextHref);
      } else {
        router.refresh();
      }
    });
  }

  const done = marked === "complete";
  const skipped = marked === "skip";

  return (
    <div>
      <div aria-live="polite" aria-busy={pending} className="flex flex-wrap items-center gap-2">
        {done || skipped ? (
          <>
            <span
              className={[
                "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-[12.5px] font-semibold",
                done
                  ? "bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]"
                  : "bg-white/[0.05] text-cream/58"
              ].join(" ")}
            >
              {done ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                <SkipForward size={13} aria-hidden="true" />
              )}
              {done ? "Solved" : "Skipped · Learn & retry"}
              {pending ? <Loader2 size={12} aria-hidden="true" className="animate-spin" /> : null}
            </span>
          </>
        ) : (
          <button
            type="button"
            onClick={skip}
            disabled={pending}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-white/[0.05] px-3 text-[12.5px] font-semibold text-cream/58 transition hover:bg-white/[0.09] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/35 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? (
              <Loader2 size={13} aria-hidden="true" className="animate-spin" />
            ) : (
              <SkipForward size={13} aria-hidden="true" />
            )}
            {pending ? "Skipping" : "Skip question"}
          </button>
        )}
      </div>

      {error ? (
        <p role="status" className="mt-2 text-[12.5px] font-medium text-[#f0a3a3]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

async function recordAttempt(
  slug: string,
  action: AttemptAction,
  requestId: string
): Promise<void> {
  const response = await fetch("/api/roadmap/question-attempt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ requestId, dsaQuestionSlug: slug, action })
  });

  if (!response.ok) {
    throw new Error("Attempt tracking failed");
  }
}
