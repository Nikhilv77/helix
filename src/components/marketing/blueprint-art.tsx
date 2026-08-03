/**
 * Blueprint line art for the marketing page.
 *
 * Bar heights and node positions are derived from deterministic formulas
 * rather than random values so server and client render identically.
 */

/** Interview turn trace used behind Maya in the hero. */
export function InterviewSignal({ className }: { className?: string }) {
  const bars = Array.from({ length: 43 }, (_, index) => {
    const height =
      12 + Math.abs(Math.sin(index * 0.63)) * 46 + Math.abs(Math.cos(index * 0.27)) * 18;
    return {
      key: index,
      x: coordinate(68 + index * 12),
      y1: coordinate(260 - height / 2),
      y2: coordinate(260 + height / 2)
    };
  });

  return (
    <svg
      viewBox="0 0 640 520"
      className={className}
      role="presentation"
      aria-hidden="true"
      fill="none"
      stroke="#efe8d6"
    >
      <g strokeWidth="1.2" opacity="0.25" strokeDasharray="5 8">
        <path d="M188 121H238C266 121 276 151 294 181" />
        <path d="M452 137H410C380 137 370 168 351 197" />
        <path d="M203 397H246C275 397 282 366 301 337" />
        <path d="M449 382H407C379 382 368 350 348 322" />
      </g>

      <g strokeWidth="2.2" strokeLinecap="round" opacity="0.42">
        {bars.map((bar) => (
          <line key={bar.key} x1={bar.x} y1={bar.y1} x2={bar.x} y2={bar.y2} />
        ))}
      </g>

      <g strokeWidth="1.25" opacity="0.42">
        <rect x="42" y="88" width="146" height="66" rx="12" />
        <circle cx="65" cy="111" r="5" fill="#efe8d6" stroke="none" />
        <path d="M82 108H153M64 130H165" strokeLinecap="round" />

        <rect x="452" y="104" width="146" height="66" rx="12" />
        <circle cx="475" cy="127" r="5" fill="#efe8d6" stroke="none" />
        <path d="M492 124H563M474 146H575" strokeLinecap="round" />

        <rect x="57" y="364" width="146" height="66" rx="12" />
        <circle cx="80" cy="387" r="5" fill="#efe8d6" stroke="none" />
        <path d="M97 384H168M79 406H180" strokeLinecap="round" />

        <rect x="449" y="349" width="146" height="66" rx="12" />
        <circle cx="472" cy="372" r="5" fill="#efe8d6" stroke="none" />
        <path d="M489 369H560M471 391H572" strokeLinecap="round" />
      </g>

      <g strokeWidth="1.4" opacity="0.5" strokeLinecap="round">
        <path d="M24 72V42H54M586 42H616V72" />
        <path d="M24 448V478H54M586 478H616V448" />
        <path d="M46 260H25M615 260H594" />
      </g>
    </svg>
  );
}

/** Stable SVG strings prevent server/client float serialization mismatches. */
function coordinate(value: number): string {
  return value.toFixed(4);
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
        <span className={`font-mono text-[10px] uppercase tracking-[0.2em] ${meta.tint}`}>
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
