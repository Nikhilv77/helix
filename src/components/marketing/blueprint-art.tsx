/**
 * Blueprint line art for the marketing page.
 *
 * Bar heights and node positions are derived from deterministic formulas
 * rather than random values so server and client render identically.
 */

/** Circular voice visualiser used behind the hero. */
export function VoiceRing({ className }: { className?: string }) {
  const bars = Array.from({ length: 72 }, (_, index) => {
    const angle = (index / 72) * Math.PI * 2;
    const length =
      16 + Math.abs(Math.sin(index * 0.7)) * 34 + Math.abs(Math.cos(index * 0.31)) * 16;
    return {
      key: index,
      x1: Math.cos(angle) * 118,
      y1: Math.sin(angle) * 118,
      x2: Math.cos(angle) * (118 + length),
      y2: Math.sin(angle) * (118 + length)
    };
  });

  return (
    <svg
      viewBox="-200 -200 400 400"
      className={className}
      role="presentation"
      aria-hidden="true"
      fill="none"
      stroke="#efe8d6"
    >
      <g strokeWidth="1.1" opacity="0.4">
        <circle cx="0" cy="0" r="188" strokeDasharray="3 7" />
        <circle cx="0" cy="0" r="118" />
        <circle cx="0" cy="0" r="64" />
      </g>
      <g strokeWidth="2" strokeLinecap="round" opacity="0.55">
        {bars.map((bar) => (
          <line key={bar.key} x1={bar.x1} y1={bar.y1} x2={bar.x2} y2={bar.y2} />
        ))}
      </g>
      <g strokeWidth="1.6" opacity="0.8">
        <circle cx="0" cy="0" r="26" />
        <path d="M0 -13a7 7 0 0 1 7 7v6a7 7 0 0 1-14 0v-6a7 7 0 0 1 7-7z" />
        <path d="M-11 4a11 11 0 0 0 22 0M0 15v7" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** Horizontal waveform strip, used as texture beside the closing CTA. */
export function WaveStrip({ className, flip = false }: { className?: string; flip?: boolean }) {
  const bars = Array.from({ length: 46 }, (_, index) => {
    const height =
      14 + Math.abs(Math.sin(index * 0.52)) * 52 + Math.abs(Math.sin(index * 0.17)) * 22;
    return { key: index, x: index * 10 + 6, height };
  });

  return (
    <svg
      viewBox="0 0 470 180"
      className={className}
      role="presentation"
      aria-hidden="true"
      fill="none"
      stroke="#efe8d6"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <g strokeWidth="3" strokeLinecap="round" opacity="0.45">
        {bars.map((bar) => (
          <line
            key={bar.key}
            x1={bar.x}
            y1={90 - bar.height / 2}
            x2={bar.x}
            y2={90 + bar.height / 2}
          />
        ))}
      </g>
      <line x1="0" y1="90" x2="470" y2="90" strokeWidth="1" opacity="0.25" strokeDasharray="4 8" />
    </svg>
  );
}

export type ExchangeAction = "probe" | "challenge" | "interrupt" | "move_on";

const actionMeta: Record<ExchangeAction, { label: string; tint: string; dot: string }> = {
  probe: { label: "Probe", tint: "text-[#8fb4ff]", dot: "bg-[#5b8df0]" },
  challenge: { label: "Challenge", tint: "text-[#ffb27a]", dot: "bg-[#e0873c]" },
  interrupt: { label: "Interrupt", tint: "text-[#ff9a9a]", dot: "bg-[#dd5f5f]" },
  move_on: { label: "Move on", tint: "text-[#8fe0b4]", dot: "bg-[#4bab7c]" }
};

export interface Exchange {
  action: ExchangeAction;
  question: string;
  answer: string;
  reply: string;
  elapsed: string;
  note: string;
}

/**
 * A single interview exchange, styled like the in-product transcript so the
 * marketing page shows the actual behaviour rather than an abstraction.
 */
export function ExchangeCard({ exchange, className }: { exchange: Exchange; className?: string }) {
  const meta = actionMeta[exchange.action];

  return (
    <div
      className={[
        "w-full rounded-2xl border border-cream/20 bg-[#0f1729] p-5 shadow-[0_30px_80px_rgba(9,21,60,0.45)] sm:p-6",
        className ?? ""
      ]
        .join(" ")
        .trim()}
    >
      <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-cream/40">
        <span className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
          Helix
        </span>
        <span>{exchange.elapsed}</span>
      </div>

      <p className="mt-5 text-base font-medium leading-snug text-cream/90">
        &ldquo;{exchange.question}&rdquo;
      </p>

      <div className="mt-4 rounded-xl border-l-2 border-cream/25 bg-white/5 px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cream/40">You</p>
        <p className="mt-1.5 text-sm leading-6 text-cream/70">{exchange.answer}</p>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span
          className={`font-mono text-[10px] uppercase tracking-[0.2em] ${meta.tint}`}
        >
          {meta.label}
        </span>
        <span className="h-px flex-1 bg-cream/15" />
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-cream/35">
          {exchange.note}
        </span>
      </div>

      <p className="mt-3 text-base font-semibold leading-snug text-cream">{exchange.reply}</p>
    </div>
  );
}

export { HelixMark } from "../helix-mark";
