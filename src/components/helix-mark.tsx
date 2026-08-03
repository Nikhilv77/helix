/**
 * The Helix mark: a microphone capsule flanked by level bars, inside the
 * blueprint badge ring. Drawn inline so it inherits colour from its container.
 */
export function HelixMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="presentation"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
    >
      <circle cx="32" cy="32" r="30" strokeWidth="1.1" opacity="0.3" />

      {/* Capsule */}
      <rect x="25" y="11" width="14" height="24" rx="7" strokeWidth="2.6" />
      <path d="M28.5 18H35.5M28.5 23H35.5M28.5 28H35.5" strokeWidth="1.4" opacity="0.5" />

      {/* Cradle and stand */}
      <path d="M21 30C21 36.1 25.9 41 32 41C38.1 41 43 36.1 43 30" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M32 41V50" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M25 50H39" strokeWidth="2.4" strokeLinecap="round" />

      {/* Level bars */}
      <g strokeWidth="2.4" strokeLinecap="round">
        <path d="M12 27V37" opacity="0.55" />
        <path d="M17 23.5V40.5" opacity="0.8" />
        <path d="M47 23.5V40.5" opacity="0.8" />
        <path d="M52 27V37" opacity="0.55" />
      </g>
    </svg>
  );
}
