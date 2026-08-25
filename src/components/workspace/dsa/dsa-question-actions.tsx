"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2, RotateCcw, SkipForward } from "lucide-react";

type AttemptAction = "open" | "complete" | "skip";
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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [marked, setMarked] = useState<Marked>(
    initialStatus === "COMPLETED" ? "complete" : initialStatus === "SKIPPED" ? "skip" : "none"
  );

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void recordAttempt(slug, "open").catch(() => {
      // Opening a question page should never fail the page itself.
    });
  }, [slug]);

  function run(action: Exclude<AttemptAction, "open">) {
    setError(null);

    // The write recalculates the whole roadmap and takes seconds against a
    // remote database. Showing the result immediately and rolling back on
    // failure keeps the click feeling instant without ever claiming progress
    // that did not persist.
    const previous = marked;
    setMarked(action === "complete" ? "complete" : "skip");

    startTransition(async () => {
      const ok = await recordAttempt(slug, action)
        .then(() => true)
        .catch(() => false);

      if (!ok) {
        setMarked(previous);
        setError("Could not save. Check your connection and try again.");
        return;
      }

      router.refresh();
      if (nextHref) router.prefetch(nextHref);
    });
  }

  const done = marked === "complete";
  const skipped = marked === "skip";

  return (
    <div className="mt-6">
      <div className="practice-glass-soft flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center">
        {done || skipped ? (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cream/[0.055]"
              style={{ color: done ? "var(--workspace-accent)" : undefined }}
            >
              {done ? (
                <Check size={18} aria-hidden="true" />
              ) : (
                <SkipForward size={16} aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-[14.5px] font-semibold text-cream">
                {done ? "Marked complete" : "Skipped for now"}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] font-medium text-cream/45">
                {pending ? (
                  <>
                    <Loader2 size={11} aria-hidden="true" className="animate-spin" />
                    Saving your progress…
                  </>
                ) : done ? (
                  "Your teacher moved your path to the next question."
                ) : (
                  "You can come back to this one any time."
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => run("complete")}
              disabled={pending || done}
              className="ml-auto hidden shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-cream/45 transition hover:bg-cream/[0.08] hover:text-cream disabled:pointer-events-none disabled:opacity-40 sm:inline-flex"
            >
              <RotateCcw size={12} aria-hidden="true" />
              {done ? "Done" : "Mark complete"}
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => run("complete")}
              disabled={pending}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-cream px-5 text-[14px] font-semibold text-[#171a16] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
            >
              {pending ? (
                <Loader2 size={16} aria-hidden="true" className="animate-spin" />
              ) : (
                <Check size={16} aria-hidden="true" />
              )}
              I solved this
            </button>
            <button
              type="button"
              onClick={() => run("skip")}
              disabled={pending}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-cream/[0.07] px-4 text-[14px] font-semibold text-cream/70 transition hover:bg-cream/[0.13] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/35 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <SkipForward size={15} aria-hidden="true" />
              Skip
            </button>
          </>
        )}

        {nextHref ? (
          <Link
            href={nextHref}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-[14px] font-semibold text-cream/60 transition hover:bg-cream/[0.08] hover:text-cream sm:ml-auto"
          >
            Next question
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        ) : null}
      </div>

      {error ? (
        <p role="status" className="mt-2 text-[12.5px] font-medium text-[#f0a3a3]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

async function recordAttempt(slug: string, action: AttemptAction): Promise<void> {
  const response = await fetch("/api/roadmap/question-attempt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ dsaQuestionSlug: slug, action })
  });

  if (!response.ok) {
    throw new Error("Attempt tracking failed");
  }
}
