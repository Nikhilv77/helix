import type { CSSProperties } from "react";

export function DashboardScoreRing({
  value,
  ariaLabel,
  className = "h-32 w-32",
  valueClassName = "text-[1.8rem]"
}: {
  value: number;
  ariaLabel: string;
  className?: string;
  valueClassName?: string;
}) {
  const progress = Math.min(100, Math.max(0, Math.round(value)));

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={`dashboard-score-ring relative isolate grid shrink-0 place-items-center ${className}`}
      style={{ "--dashboard-ring-offset": 100 - progress } as CSSProperties}
    >
      <span
        aria-hidden="true"
        className="dashboard-score-ring-halo absolute inset-0 rounded-full"
      />
      <span aria-hidden="true" className="dashboard-score-ring-core absolute rounded-full" />

      <svg
        className="absolute inset-0 h-full w-full -rotate-90 overflow-visible"
        viewBox="0 0 160 160"
        aria-hidden="true"
      >
        <circle cx="80" cy="80" r="63" fill="none" className="dashboard-score-ring-track" />
        <circle
          cx="80"
          cy="80"
          r="63"
          pathLength="100"
          fill="none"
          strokeLinecap="round"
          className="dashboard-score-ring-segment dashboard-score-ring-glow"
        />
        <circle
          cx="80"
          cy="80"
          r="63"
          pathLength="100"
          fill="none"
          strokeLinecap="round"
          className="dashboard-score-ring-segment dashboard-score-ring-value"
        />
        <circle
          cx="80"
          cy="80"
          r="63"
          pathLength="100"
          fill="none"
          strokeLinecap="round"
          className="dashboard-score-ring-segment dashboard-score-ring-highlight"
        />
      </svg>

      <span
        className={`relative z-10 font-mono font-semibold tabular-nums tracking-[-0.055em] text-cream ${valueClassName}`}
      >
        {progress}%
      </span>
    </div>
  );
}
