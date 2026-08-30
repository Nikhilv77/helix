export function PracticeProgressRing({
  percent,
  label = "complete",
  className = "h-36 w-36"
}: {
  percent: number;
  label?: string;
  className?: string;
}) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));

  return (
    <div
      className={`relative grid shrink-0 place-items-center ${className}`}
      role="img"
      aria-label={`${value}% ${label}`}
    >
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 120 120" aria-hidden>
        <circle
          cx="60"
          cy="60"
          r="51"
          fill="none"
          stroke="rgba(255,255,255,0.09)"
          strokeWidth="7"
        />
        <circle
          cx="60"
          cy="60"
          r="51"
          fill="none"
          pathLength="100"
          stroke="rgba(239,232,214,0.94)"
          strokeLinecap="round"
          strokeWidth="7"
          strokeDasharray="100"
          strokeDashoffset={100 - value}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span className="relative text-center">
        <span className="block font-display text-[2rem] font-medium tracking-[-0.05em] text-cream">
          {value}%
        </span>
        <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.17em] text-cream/34">
          {label}
        </span>
      </span>
    </div>
  );
}
