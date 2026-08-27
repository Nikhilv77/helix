"use client";

import { Star } from "lucide-react";
import { useCallback, useState } from "react";

/**
 * Rating a finished conversation.
 *
 * The learner rates; the helper is never rated by anyone they helped in the
 * other direction. Attaching a score to the person who asked for help would make
 * asking feel like being assessed, which is exactly what stops people asking.
 *
 * Skippable, and skipping is not nagged: a conversation that went badly enough
 * to leave without rating has already told you something.
 */
export function HelpRating({
  requestId,
  onSkipped
}: {
  requestId: string;
  onSkipped?: () => void;
}) {
  const [hovered, setHovered] = useState(0);
  const [sent, setSent] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rate = useCallback(
    async (rating: number) => {
      if (pending) return;
      setPending(true);
      setError(null);

      try {
        const response = await fetch(`/api/help/session/${encodeURIComponent(requestId)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "rate", rating })
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.success || payload.data?.rated !== true) {
          throw new Error("Could not save that rating.");
        }

        setSent(true);
      } catch {
        setError("Could not save that rating. Please try again.");
      } finally {
        setPending(false);
      }
    },
    [pending, requestId]
  );

  const skip = useCallback(async () => {
    if (pending) return;
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/help/session/${encodeURIComponent(requestId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "skip_rating" })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success || payload.data?.skipped !== true) {
        throw new Error("Could not skip that rating.");
      }

      setDismissed(true);
      onSkipped?.();
    } catch {
      setError("Could not skip that rating. Please try again.");
    } finally {
      setPending(false);
    }
  }, [onSkipped, pending, requestId]);

  if (dismissed) return null;

  if (sent) {
    return <p className="text-[12.5px] text-cream/50">Thanks — that helps us match better.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-[12.5px] text-cream/55">Was that useful?</span>

      <div className="flex items-center gap-0.5" onMouseLeave={() => setHovered(0)}>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            aria-label={`${value} out of 5`}
            disabled={pending}
            onMouseEnter={() => setHovered(value)}
            onClick={() => void rate(value)}
            className="p-0.5 transition"
          >
            <Star
              size={16}
              aria-hidden="true"
              className={value <= hovered ? "text-[#F26E01]" : "text-cream/25"}
              fill={value <= hovered ? "currentColor" : "none"}
            />
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => void skip()}
        disabled={pending}
        className="text-[12px] text-cream/30 transition hover:text-cream/60"
      >
        Skip
      </button>

      {error ? <span className="text-[12px] text-[#ffb4b4]">{error}</span> : null}
    </div>
  );
}
