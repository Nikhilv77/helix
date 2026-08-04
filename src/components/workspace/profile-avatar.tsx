/**
 * Generative avatar, in the spirit of the auto-assigned pictures Google hands
 * out: a marble of overlapping colour fields, derived entirely from the name so
 * the same person always gets the same picture and no two names collide by
 * accident. No network request, no stored image.
 */
// Distinct hues rather than shades of one colour: picking three far apart on
// this list is what makes each avatar read as its own picture.
const HUES = [
  "#7ea0ff",
  "#9be8c1",
  "#efcf84",
  "#c8b6ff",
  "#8fd6ff",
  "#f2a5a5",
  "#f6b98a",
  "#6ee7d5",
  "#b7e07a",
  "#ff9ec4"
];

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return Math.abs(result);
}

export function ProfileAvatar({ name, className }: { name: string; className?: string }) {
  const seed = hash(name.trim().toLowerCase() || "helix");
  const id = `av-${seed.toString(36)}`;

  // Three hues spaced around the list, then geometry offsets — all from the
  // same seed, so a given name always renders the identical picture.
  const first = seed % HUES.length;
  const second = (first + 3 + ((seed >> 5) % 3)) % HUES.length;
  const third = (first + 6 + ((seed >> 9) % 3)) % HUES.length;
  const colors = [HUES[first]!, HUES[second]!, HUES[third]!];

  const rotation = seed % 360;
  const shiftX = ((seed >> 3) % 26) - 13;
  const shiftY = ((seed >> 7) % 26) - 13;
  const scale = 1 + ((seed >> 11) % 26) / 100;

  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={`${name} avatar`}>
      <defs>
        <clipPath id={`${id}-clip`}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
        <linearGradient id={`${id}-base`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={colors[0]} />
          <stop offset="100%" stopColor={colors[1]} />
        </linearGradient>
        <filter id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4.5" />
        </filter>
      </defs>

      <g clipPath={`url(#${id}-clip)`}>
        <rect width="100" height="100" fill={`url(#${id}-base)`} />
        <g filter={`url(#${id}-blur)`} transform={`translate(${shiftX} ${shiftY})`}>
          <ellipse
            cx="30"
            cy="70"
            rx={34 * scale}
            ry={28 * scale}
            fill={colors[1]}
            transform={`rotate(${rotation} 30 70)`}
          />
          <ellipse
            cx="76"
            cy="30"
            rx={30 * scale}
            ry={26 * scale}
            fill={colors[2]}
            transform={`rotate(${-rotation} 76 30)`}
          />
        </g>
        {/* A crisp band gives the blur some structure to sit against. */}
        <path
          d={`M -20 ${64 + (seed % 14)} L 120 ${24 + (seed % 18)} L 120 ${48 + (seed % 18)} L -20 ${88 + (seed % 14)} Z`}
          fill="#ffffff"
          opacity="0.14"
        />
        <ellipse cx="34" cy="22" rx="30" ry="17" fill="#ffffff" opacity="0.2" />
      </g>
    </svg>
  );
}
