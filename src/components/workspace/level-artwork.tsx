import type { Level } from "@/lib/types";

/**
 * Career-stage artwork: an isometric plinth that gains a tier per level, lit
 * from the top-left, with an orbit ring and a crest that grows with seniority.
 * Drawn inline so it stays crisp at any size and uses the blueprint palette
 * directly rather than shipping four bitmaps.
 */
const LEVEL_TIERS: Record<Level, number> = {
  fresher: 1,
  "0-2": 2,
  "3-5": 3,
  "5-plus": 4
};

const LEVEL_CAPTION: Record<Level, string> = {
  fresher: "Starting out",
  "0-2": "Early career",
  "3-5": "Mid-level",
  "5-plus": "Senior+"
};

export function levelCaption(level: Level | null): string {
  return level ? LEVEL_CAPTION[level] : "Set your level";
}

export function LevelArtwork({ level, className }: { level: Level | null; className?: string }) {
  const resolved = level ?? "fresher";
  const tiers = LEVEL_TIERS[resolved];
  const id = `lvl-${resolved.replace("+", "p")}`;

  const cx = 200;
  const baseY = 236;
  const step = 30;
  const thickness = 17;
  const baseHalf = 130;

  const platforms = Array.from({ length: tiers }, (_, index) => {
    const halfW = baseHalf * Math.pow(0.78, index);
    return { halfW, halfH: halfW / 2, y: baseY - index * step, index };
  });

  const top = platforms[platforms.length - 1] ?? platforms[0];
  const crestY = (top?.y ?? baseY) - (top?.halfH ?? 0) - 52;
  const crestR = 22 + tiers * 4;

  return (
    <svg
      viewBox="0 0 400 320"
      className={className}
      role="img"
      aria-label={`${levelCaption(level)} experience`}
    >
      <defs>
        <radialGradient id={`${id}-halo`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a9c2ff" stopOpacity="0.5" />
          <stop offset="45%" stopColor="#7ea0ff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#7ea0ff" stopOpacity="0" />
        </radialGradient>
        {/* Lit top face: bright at the back-left corner, falling away to the front. */}
        <linearGradient id={`${id}-face`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#f2f6ff" />
          <stop offset="45%" stopColor="#b9cbff" />
          <stop offset="100%" stopColor="#7d9bf0" />
        </linearGradient>
        <linearGradient id={`${id}-left`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a6ddc" />
          <stop offset="100%" stopColor="#2b4aa8" />
        </linearGradient>
        <linearGradient id={`${id}-right`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2f4fb4" />
          <stop offset="100%" stopColor="#1b3480" />
        </linearGradient>
        <linearGradient id={`${id}-crest`} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#e8efff" />
          <stop offset="100%" stopColor="#93b2ff" />
        </linearGradient>
        <filter id={`${id}-soft`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      <ellipse cx={cx} cy={baseY - 24} rx="185" ry="140" fill={`url(#${id}-halo)`} />

      {/* Contact shadow grounds the stack instead of letting it float. */}
      <ellipse
        cx={cx}
        cy={baseY + thickness + 16}
        rx={baseHalf * 0.92}
        ry={baseHalf * 0.36}
        fill="#0b1c50"
        opacity="0.45"
        filter={`url(#${id}-soft)`}
      />

      <ellipse
        cx={cx}
        cy={baseY + 34}
        rx={baseHalf + 26}
        ry={(baseHalf + 26) / 2.1}
        fill="none"
        stroke="#8fb0ff"
        strokeOpacity="0.28"
        strokeDasharray="3 9"
      />

      {platforms.map(({ halfW, halfH, y, index }) => {
        const inset = halfW * 0.62;
        return (
          <g key={index}>
            <path
              d={`M ${cx - halfW} ${y} L ${cx} ${y + halfH} L ${cx} ${y + halfH + thickness} L ${cx - halfW} ${y + thickness} Z`}
              fill={`url(#${id}-left)`}
            />
            <path
              d={`M ${cx + halfW} ${y} L ${cx} ${y + halfH} L ${cx} ${y + halfH + thickness} L ${cx + halfW} ${y + thickness} Z`}
              fill={`url(#${id}-right)`}
            />
            <path
              d={`M ${cx} ${y - halfH} L ${cx + halfW} ${y} L ${cx} ${y + halfH} L ${cx - halfW} ${y} Z`}
              fill={`url(#${id}-face)`}
            />
            {/* Inlaid groove: reads as machined edge rather than flat colour. */}
            <path
              d={`M ${cx} ${y - halfH * 0.62} L ${cx + inset} ${y} L ${cx} ${y + halfH * 0.62} L ${cx - inset} ${y} Z`}
              fill="none"
              stroke="#ffffff"
              strokeOpacity="0.4"
            />
            <path
              d={`M ${cx} ${y - halfH} L ${cx + halfW} ${y} L ${cx} ${y + halfH} L ${cx - halfW} ${y} Z`}
              fill="none"
              stroke="#f4f8ff"
              strokeOpacity="0.75"
            />
            {/* Front vertical edge catches the light. */}
            <path
              d={`M ${cx} ${y + halfH} L ${cx} ${y + halfH + thickness}`}
              stroke="#cfdcff"
              strokeOpacity="0.5"
            />
          </g>
        );
      })}

      <g>
        <circle cx={cx} cy={crestY} r={crestR * 1.5} fill={`url(#${id}-halo)`} />
        <path
          d={`M ${cx} ${crestY - crestR}
              C ${cx + crestR * 0.16} ${crestY - crestR * 0.16}, ${cx + crestR * 0.16} ${crestY - crestR * 0.16}, ${cx + crestR} ${crestY}
              C ${cx + crestR * 0.16} ${crestY + crestR * 0.16}, ${cx + crestR * 0.16} ${crestY + crestR * 0.16}, ${cx} ${crestY + crestR}
              C ${cx - crestR * 0.16} ${crestY + crestR * 0.16}, ${cx - crestR * 0.16} ${crestY + crestR * 0.16}, ${cx - crestR} ${crestY}
              C ${cx - crestR * 0.16} ${crestY - crestR * 0.16}, ${cx - crestR * 0.16} ${crestY - crestR * 0.16}, ${cx} ${crestY - crestR} Z`}
          fill={`url(#${id}-crest)`}
        />
        {/* Senior stages earn side glints on the crest. */}
        {tiers >= 3 ? (
          <>
            <path
              d={`M ${cx - crestR * 1.5} ${crestY} l 9 -4 l -9 -4 l -9 4 Z`}
              fill="#dfe8ff"
              opacity="0.75"
            />
            <path
              d={`M ${cx + crestR * 1.5} ${crestY} l 9 -4 l -9 -4 l -9 4 Z`}
              fill="#dfe8ff"
              opacity="0.75"
            />
          </>
        ) : null}
      </g>

      {platforms.map(({ y, halfW }, index) => (
        <g key={`spark-${index}`} opacity={0.65}>
          <circle cx={cx + halfW + 20} cy={y - 16} r="2.6" fill="#e6edff" />
          <circle cx={cx - halfW - 24} cy={y + 4} r="1.8" fill="#bcd0ff" opacity="0.7" />
        </g>
      ))}
    </svg>
  );
}
