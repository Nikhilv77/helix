import Link from "next/link";
import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Clock3 } from "lucide-react";

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
  disabled?: boolean;
  delay?: number;
}

/**
 * The shared visual contract for Interview and Practice roadmap cards.
 * Keeping one component prevents the two six-session entry points from
 * drifting in spacing, motion, icon treatment, metadata, or focus behavior.
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
  disabled = false,
  delay = 0
}: RoadmapSessionCardProps) {
  const unavailable = disabled || !href;

  const content = (
    <>
      <span className="interview-session-icon flex h-20 w-20 items-center justify-center rounded-[1.45rem] lg:h-24 lg:w-24">
        <SessionIcon size={40} strokeWidth={1.45} aria-hidden="true" />
      </span>

      <h2 className="mt-16 max-w-[17rem] font-display text-[1.5rem] font-semibold leading-[1.2] tracking-normal text-cream sm:text-[1.65rem]">
        {title}
      </h2>
      <p className="mt-4 max-w-[19rem] text-base leading-7 text-cream/72">{purpose}</p>

      {statusLabel ? (
        <span className="mt-5 w-fit rounded-full border border-[color-mix(in_srgb,var(--workspace-accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--workspace-accent)_9%,transparent)] px-3 py-1.5 text-[11px] font-medium text-cream/68">
          {statusLabel}
        </span>
      ) : null}

      {durationMinutes || difficulty ? (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {durationMinutes ? (
            <span className="pill inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-cream/55">
              <Clock3 size={11} aria-hidden="true" /> {durationMinutes} min
            </span>
          ) : null}
          {difficulty ? (
            <span className="pill px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-cream/55">
              {difficulty}
            </span>
          ) : null}
        </div>
      ) : null}

      {covers.length ? (
        <ul className="mt-5 flex flex-wrap gap-2" aria-label="Session topics">
          {covers.slice(0, 4).map((topic) => (
            <li
              key={topic}
              className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[11px] text-cream/48"
            >
              {topic}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="relative z-10 mt-auto pt-9">
        <span className="interview-session-link inline-flex items-center gap-2 text-base font-medium text-cream/88 transition-colors group-hover:text-cream">
          {actionLabel}
          {!unavailable ? (
            <ArrowRight
              size={17}
              aria-hidden="true"
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          ) : null}
        </span>
      </div>
    </>
  );

  const className = [
    "interview-session-card group relative flex min-h-[28rem] flex-col rounded-[2rem] p-7 text-left transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/35 lg:p-8",
    unavailable ? "cursor-not-allowed opacity-45" : ""
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
