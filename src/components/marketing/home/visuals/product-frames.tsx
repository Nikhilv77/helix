"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Check, Mic } from "lucide-react";
import { Reveal } from "./reveal";

/** Deterministic bar heights so server and client markup match. */
function waveHeights(count: number, seed: number): number[] {
  return Array.from(
    { length: count },
    (_, index) =>
      34 + Math.abs(Math.sin(index * 0.62 + seed)) * 44 + Math.abs(Math.cos(index * 0.29)) * 20
  );
}

function LiveBars({ count = 28, className }: { count?: number; className?: string }) {
  const heights = waveHeights(count, 0.8);

  return (
    <div
      className={["flex h-24 items-center justify-center gap-1.5", className ?? ""]
        .join(" ")
        .trim()}
      aria-hidden="true"
    >
      {heights.map((height, index) => (
        <span
          key={index}
          className="wave-bar w-1.5 rounded-full bg-cream/60"
          style={{ height: `${height}%`, animationDelay: `${index * 62}ms` }}
        />
      ))}
    </div>
  );
}

function Chip({ children, selected = false }: { children: ReactNode; selected?: boolean }) {
  return (
    <span
      className={[
        "rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition",
        selected ? "bg-cream text-blueprint" : "border border-cream/20 text-cream/50"
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function SetupScreen({ action }: { action?: ReactNode }) {
  const rows = [
    { label: "Track", options: ["Engineering"], selected: "Engineering" },
    { label: "Level", options: ["Fresher", "0–2 yrs", "3–5 yrs", "5+ yrs"], selected: "3–5 yrs" },
    {
      label: "Round",
      options: ["Behavioral", "Technical", "Hiring manager"],
      selected: "Behavioral"
    },
    { label: "Intensity", options: ["Friendly", "Realistic", "Direct"], selected: "Direct" }
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="blueprint-label text-cream/45">Step 5 of 5</p>
        <p className="font-mono text-[11px] text-cream/45">00:52 elapsed</p>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-cream/10">
        <div className="h-full w-full rounded-full bg-cream/70" />
      </div>

      <div className="mt-6 space-y-4">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-wrap items-center gap-3">
            <span className="w-20 shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-cream/40">
              {row.label}
            </span>
            <div className="flex flex-wrap gap-2">
              {row.options.map((option) => (
                <Chip key={option} selected={option === row.selected}>
                  {option}
                </Chip>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-cream/25 bg-cream/5 p-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-cream/45">
          What have you actually worked on?
        </p>
        <p className="mt-2.5 text-sm leading-6 text-cream/90">
          Rebuilt the payments retry pipeline — idempotency keys, dead-letter queues, cut p99 by
          40%.
        </p>
        <span className="mt-3 inline-block h-4 w-px animate-pulse bg-cream/70" />
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-xs leading-5 text-cream/45">
          This last answer is what the questions get built from.
        </p>
        <span className="shrink-0">{action}</span>
      </div>
    </div>
  );
}

function LiveScreen() {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-cream/70">
          <span className="relative flex h-2.5 w-2.5">
            <span className="ring-pulse absolute inset-0 rounded-full bg-[#dd5f5f]" />
            <span className="relative h-2.5 w-2.5 rounded-full bg-[#dd5f5f]" />
          </span>
          Live
        </span>
        <span className="font-mono text-[11px] text-cream/45">Question 3 of 4</span>
        <span className="font-mono text-[11px] text-cream/70">08:03 / 15:00</span>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-cream/10">
        <div className="h-full w-[54%] rounded-full bg-cream/70" />
      </div>

      <LiveBars className="mt-6" />

      <p className="mt-2 text-center text-lg font-semibold leading-snug text-cream">
        &ldquo;Walk me through the migration.&rdquo;
      </p>

      <div className="mt-6 rounded-xl border border-[#dd5f5f]/45 bg-[#dd5f5f]/10 p-4">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em]">
          <span className="text-[#ff9a9a]">Interrupting</span>
          <span className="text-[#ff9a9a]">94s · no point reached</span>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-cream/10">
          <div className="h-full w-[94%] rounded-full bg-[#dd5f5f]" />
        </div>
        <p className="mt-3 text-sm font-semibold text-cream">
          &ldquo;Let me stop you there — what was the outcome?&rdquo;
        </p>
      </div>

      <div className="mt-5 space-y-2 font-mono text-[11px] leading-5">
        {[
          { who: "You", text: "So originally the team had this legacy setup, and there was…" },
          { who: "Trailgrad", text: "Where did the keys live when that store went down?" },
          { who: "You", text: "We kept them in Redis with a Postgres fallback." }
        ].map((line) => (
          <div key={line.text} className="flex gap-3">
            <span
              className={`w-12 shrink-0 uppercase tracking-[0.12em] ${
                line.who === "Trailgrad" ? "text-cream/70" : "text-cream/35"
              }`}
            >
              {line.who}
            </span>
            <span className="text-cream/55">{line.text}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-cream/25 bg-cream/5 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-cream/70">
          <Mic size={14} aria-hidden="true" />
          Listening
        </span>
      </div>
    </div>
  );
}

function ReportScreen() {
  const rubric = [
    { name: "Structure", score: 72, line: "Led with context before the problem." },
    { name: "Specificity", score: 54, line: "“Improved performance” — no numbers." },
    { name: "Ownership", score: 81, line: "Named the exact service you rewrote." },
    { name: "Outcome", score: 47, line: "Never said what shipped, or what changed." }
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base font-semibold text-cream">Session report</p>
        <div className="flex flex-wrap gap-2">
          <Chip>Engineering</Chip>
          <Chip>Behavioral</Chip>
          <Chip>Direct</Chip>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {rubric.map((row) => (
          <div key={row.name}>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-cream">{row.name}</span>
              <span className="font-mono text-xs text-cream/60">{row.score}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-cream/10">
              <div className="h-full rounded-full bg-cream/80" style={{ width: `${row.score}%` }} />
            </div>
            <p className="mt-1.5 font-mono text-[11px] leading-5 text-cream/45">{row.line}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-cream/25 bg-cream/10 p-4">
        <p className="blueprint-label text-cream/55">Fix this next</p>
        <p className="mt-2 flex items-start gap-2.5 text-base font-semibold leading-snug text-cream">
          <Check size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
          End every answer with the number that changed.
        </p>
      </div>
    </div>
  );
}

const tabs = [
  { id: "setup", label: "Setup", caption: "Under a minute" },
  { id: "live", label: "Interview", caption: "Ten to fifteen minutes" },
  { id: "report", label: "Report", caption: "Clear next step" }
];

/** Faithful mock of the three product screens, with a tab switcher. */
export function ProductShowcase({ action }: { action?: ReactNode }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Once a tab is chosen by hand, stop cycling — auto-play must not fight the user.
  const [pinned, setPinned] = useState(false);
  const active = tabs[index] ?? tabs[0];

  useEffect(() => {
    if (paused || pinned) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % tabs.length);
    }, 7500);
    return () => window.clearInterval(timer);
  }, [paused, pinned]);

  if (!active) return null;

  const screen =
    active.id === "setup" ? (
      <SetupScreen action={action} />
    ) : active.id === "live" ? (
      <LiveScreen />
    ) : (
      <ReportScreen />
    );

  return (
    <section id="product" className="relative z-10 bg-blueprint px-6 py-16 sm:px-10 sm:py-24">
      <div className="mx-auto w-full max-w-[68rem]">
        <Reveal>
          <p className="blueprint-label text-center text-cream/50">The whole session</p>
        </Reveal>
        <Reveal delay={80}>
          <h2
            className="display-heading mt-5 text-center text-cream"
            style={{ fontSize: "clamp(2.25rem, 5.4vw, 4.5rem)" }}
          >
            Setup. Interview. Recap.
          </h2>
        </Reveal>

        <Reveal delay={140}>
          <div
            className="mt-12 flex flex-wrap justify-center gap-2"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            {tabs.map((tab, tabIndex) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setIndex(tabIndex);
                  setPinned(true);
                }}
                aria-current={tabIndex === index}
                className={[
                  "rounded-full border px-5 py-2.5 text-sm font-semibold transition",
                  tabIndex === index
                    ? "border-cream bg-cream text-blueprint"
                    : "border-cream/25 text-cream/65 hover:border-cream/50 hover:text-cream"
                ].join(" ")}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal delay={200}>
          <div
            className="mt-8 overflow-hidden rounded-2xl border border-cream/20 bg-[#0b1120] shadow-[0_40px_120px_rgba(9,21,60,0.5)]"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <div className="flex items-center gap-3 border-b border-cream/10 px-5 py-3.5">
              <span className="flex gap-1.5">
                {["bg-[#dd5f5f]", "bg-[#e0a13c]", "bg-[#4bab7c]"].map((dot) => (
                  <span key={dot} className={`h-2.5 w-2.5 rounded-full ${dot} opacity-70`} />
                ))}
              </span>
              <span className="font-mono text-[11px] text-cream/40">
                trailgrad / mock interview
              </span>
              <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.16em] text-cream/40">
                {active.caption}
              </span>
            </div>
            <div className="p-6 sm:p-8">{screen}</div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export { LiveBars };

