import Link from "next/link";
import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { Clock3 } from "lucide-react";
import { LinkPendingIcon } from "@/components/workspace/shared/back-link-icon";

export interface RoadmapSessionCardProps {
  href: string | null;
  icon: LucideIcon;
  title: string;
  purpose: string;
  covers: string[];
  actionLabel: string;
  statusLabel?: string | null;
  durationMinutes?: number | null;
  difficulty?: string | null;
  /** Latest score for this kind of round, out of 100. */
  latestScore?: number | null;
  /** Marks the one round worth doing next. */
  recommended?: boolean;
  /** How far an unfinished round has got, 0–100. */
  progressPercent?: number | null;
  disabled?: boolean;
  delay?: number;
}

/**
 * One interview round on the Interviews roadmap: a flat card with an outlined
 * icon tile, the round's purpose, what it covers, and one action.
 */
export function RoadmapSessionCard({
  href,
  icon: SessionIcon,
  title,
  purpose,
  covers,
  actionLabel,
  statusLabel = null,
  durationMinutes = null,
  difficulty = null,
  latestScore = null,
  recommended = false,
  progressPercent = null,
  disabled = false,
  delay = 0
}: RoadmapSessionCardProps) {
  const unavailable = disabled || !href;
  const meta = [
    durationMinutes ? `${durationMinutes} min` : null,
    difficulty ? difficulty.slice(0, 1).toUpperCase() + difficulty.slice(1) : null
  ].filter(Boolean);

  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <span className="interview-roadmap-icon grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/[0.1] text-cream/80">
          <SessionIcon size={20} strokeWidth={1.5} aria-hidden="true" />
        </span>
        {recommended ? (
          <span className="pt-1 text-[12.5px] font-semibold text-[var(--workspace-accent)]">
            Recommended next
          </span>
        ) : statusLabel ? (
          <span className="inline-flex items-center gap-1.5 pt-1 text-[12.5px] font-medium text-cream/52">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-[var(--workspace-accent)]"
            />
            {statusLabel}
          </span>
        ) : null}
      </div>

      <h2 className="mt-6 text-[1.375rem] font-semibold leading-snug tracking-[-0.015em] text-cream">
        {title}
      </h2>
      <p className="mt-2 text-[15px] leading-[1.65] text-cream/62">{purpose}</p>

      {meta.length ? (
        <p className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] text-cream/48">
          <Clock3 size={14} strokeWidth={1.5} aria-hidden="true" />
          {meta.join(" · ")}
        </p>
      ) : null}

      {latestScore !== null ? (
        <p className="mt-1.5 text-[13.5px] text-cream/48">
          Latest score{" "}
          <span className="font-semibold tabular-nums text-cream">{latestScore}</span>
          /100
        </p>
      ) : null}

      {progressPercent !== null ? (
        <div className="mt-4">
          <div
            className="interview-roadmap-progress h-1 overflow-hidden rounded-full bg-white/[0.08]"
            role="progressbar"
            aria-label="Round progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
          >
            <span
              className="block h-full w-full origin-left rounded-full bg-[var(--workspace-accent)]"
              style={{ transform: `scaleX(${Math.min(100, Math.max(0, progressPercent)) / 100})` }}
            />
          </div>
        </div>
      ) : null}

      {covers.length ? (
        <ul
          className="interview-roadmap-rule mt-5 space-y-2 border-t border-white/[0.08] pt-5"
          aria-label="Session topics"
        >
          {covers.slice(0, 4).map((topic) => (
            <li key={topic} className="flex gap-2.5 text-[14px] leading-[1.45rem] text-cream/62">
              <span
                aria-hidden="true"
                className="mt-[0.6rem] h-1 w-1 shrink-0 rounded-full bg-[var(--workspace-accent)]"
              />
              {topic}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-auto pt-7">
        <span
          className={`inline-flex items-center gap-1.5 text-[15px] font-semibold ${
            unavailable ? "text-cream/48" : "text-[var(--workspace-accent)]"
          }`}
        >
          {actionLabel}
          {!unavailable ? (
            // Turns into a small spinner while the round's page loads.
            <LinkPendingIcon
              direction="forward"
              size={16}
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          ) : null}
        </span>
      </div>
    </>
  );

  const className = [
    "interview-roadmap-card workspace-deferred-card group relative flex min-h-[22rem] flex-col rounded-2xl p-6 text-left transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)] lg:p-7",
    unavailable ? "cursor-not-allowed" : ""
  ].join(" ");
  const style = { "--interview-delay": `${delay}ms` } as CSSProperties;

  if (unavailable) {
    return (
      <article aria-disabled="true" className={className} style={style}>
        {content}
      </article>
    );
  }

  return (
    <Link href={href} className={className} style={style}>
      {content}
    </Link>
  );
}
