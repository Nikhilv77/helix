import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarClock,
  ClipboardCheck,
  Compass,
  Layers,
  MessagesSquare,
  ShieldCheck
} from "lucide-react";

/**
 * Trailguide — the warm room inside a dark product.
 *
 * Named to pair with Trailmate: a mate walks beside you, a guide goes ahead.
 * The page has to teach the name, so the first mention is always bound to a
 * plain-language description rather than left to stand on its own.
 *
 * Cream is Trailgrad's text colour everywhere else; here it is the ground and
 * the ink inverts, so this reads as the same brand from the other side rather
 * than a light theme bolted on. The sidebar deliberately stays dark — the
 * contrast between chrome and content is what makes arriving here feel like
 * stepping into a different room.
 */

const CAPABILITIES = [
  {
    icon: Layers,
    title: "System design, properly stressed",
    body: "Someone who has run the service you are describing will ask the second and third questions — the ones about failure, cost and what breaks at 10×."
  },
  {
    icon: ClipboardCheck,
    title: "An honest read on your bar",
    body: "Not a score out of ten. A direct answer to whether this performance clears the bar at the companies you are aiming for, from someone who has sat on the other side of that table."
  },
  {
    icon: Compass,
    title: "The decisions around the offer",
    body: "Which team to pick, what to negotiate, when to wait. The questions that matter most and have the least written about them honestly."
  },
  {
    icon: MessagesSquare,
    title: "A debrief on your real interviews",
    body: "Walk through the round you just failed with someone who can tell you what the interviewer was actually testing for."
  }
];

const STEPS = [
  {
    label: "Your practice picks the moment",
    body: "Trailgrad already tracks where you lose points across sessions. A Trailguide is suggested when the same weakness survives several attempts — not because you opened a pricing page."
  },
  {
    label: "You choose the person",
    body: "Profiles show where they have worked, which loops they have run, and what previous learners said. You book a specific human, not a slot in a pool."
  },
  {
    label: "An hour, then notes",
    body: "A scheduled session on your terms, followed by written notes you keep. Pay for the session you booked — no subscription, no retainer."
  }
];

export function MentorsView() {
  return (
    <div className="mentor-surface min-h-screen w-full">
      <div className="mx-auto w-full max-w-5xl px-5 pb-24 pt-10 sm:px-8 lg:px-10 lg:pt-16">
        {/* ---------- hero ---------- */}
        <header className="mentor-rise" style={{ "--rise-delay": "40ms" } as React.CSSProperties}>
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--m-accent-line)] bg-[var(--m-accent-soft)] px-3 py-1">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-[var(--m-accent)]"
            />
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--m-accent-ink)]">
              Trailguide · Coming soon
            </span>
          </span>

          <h1 className="mt-5 max-w-[18ch] text-[2.1rem] font-semibold leading-[1.06] tracking-[-0.02em] text-[var(--m-ink)] sm:text-[2.8rem] lg:text-[3.2rem]">
            Some things a model cannot teach you.
          </h1>

          <p className="mt-5 max-w-[54ch] text-[1.02rem] leading-relaxed text-[var(--m-ink-soft)] sm:text-[1.1rem]">
            Maya can interview you at two in the morning, find the pattern you keep missing, and
            never get tired of your third attempt. What she cannot do is tell you how it actually
            felt on the other side of the table at a company you are about to walk into.
          </p>

          <p className="mt-4 max-w-[54ch] text-[1.02rem] leading-relaxed text-[var(--m-ink-soft)] sm:text-[1.1rem]">
            <strong className="font-semibold text-[var(--m-ink)]">Trailguide</strong> is for
            that — one-to-one sessions with senior engineers who have run the loop you are
            preparing for, for the handful of moments where experience beats repetition. A
            Trailmate walks beside you; a Trailguide has already been where you are going.
          </p>
        </header>

        {/* ---------- the ladder ---------- */}
        <section
          className="mentor-rise mt-14"
          style={{ "--rise-delay": "160ms" } as React.CSSProperties}
        >
          <SectionLabel>Where they fit</SectionLabel>

          <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--m-line)] bg-[var(--m-raised)]">
            <LadderRow
              rung="On your own"
              detail="Practice and roadmap"
              cost="Free"
              tone="quiet"
            />
            <LadderRow
              rung="Maya interviews you"
              detail="Text and voice rounds, scored"
              cost="Free"
              tone="quiet"
            />
            <LadderRow
              rung="Trailmate"
              detail="A peer who solved this question, in minutes"
              cost="Free"
              tone="live"
            />
            <LadderRow
              rung="Trailguide"
              detail="A scheduled hour with a senior engineer"
              cost="Coming soon"
              tone="soon"
              last
            />
          </div>

          <p className="mt-4 max-w-[58ch] text-[0.92rem] leading-relaxed text-[var(--m-ink-faint)]">
            Each rung costs more and answers slower than the one below it. Most of the time you
            should never need to climb — that is the point of the three that are free.
          </p>
        </section>

        {/* ---------- capabilities ---------- */}
        <section
          className="mentor-rise mt-16"
          style={{ "--rise-delay": "240ms" } as React.CSSProperties}
        >
          <SectionLabel>What a session is for</SectionLabel>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {CAPABILITIES.map((item) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.title}
                  className="rounded-2xl border border-[var(--m-line)] bg-[var(--m-raised)] p-5 transition-[border-color,transform] duration-300 ease-out hover:-translate-y-0.5 hover:border-[var(--m-line-strong)]"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--m-accent-soft)] text-[var(--m-accent-ink)]">
                    <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <h3 className="mt-3.5 text-[1rem] font-semibold leading-snug text-[var(--m-ink)]">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-[0.9rem] leading-relaxed text-[var(--m-ink-soft)]">
                    {item.body}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        {/* ---------- how it will work ---------- */}
        <section
          className="mentor-rise mt-16"
          style={{ "--rise-delay": "320ms" } as React.CSSProperties}
        >
          <SectionLabel>How it will work</SectionLabel>

          <ol className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-[var(--m-line)] bg-[var(--m-line)] sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.label} className="bg-[var(--m-raised)] p-5">
                <span className="font-mono text-[0.72rem] font-medium tracking-[0.1em] text-[var(--m-accent-ink)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-2.5 text-[0.96rem] font-semibold leading-snug text-[var(--m-ink)]">
                  {step.label}
                </h3>
                <p className="mt-2 text-[0.88rem] leading-relaxed text-[var(--m-ink-soft)]">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- the honest promise ---------- */}
        <section
          className="mentor-rise mt-16"
          style={{ "--rise-delay": "400ms" } as React.CSSProperties}
        >
          <div className="rounded-2xl border border-[var(--m-line)] bg-[var(--m-sunken)] p-6 sm:p-7">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--m-accent-soft)] text-[var(--m-accent-ink)]">
              <ShieldCheck size={18} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <h2 className="mt-3.5 text-[1.2rem] font-semibold leading-snug text-[var(--m-ink)]">
              Two things this will never become
            </h2>
            <p className="mt-3 max-w-[62ch] text-[0.95rem] leading-relaxed text-[var(--m-ink-soft)]">
              <strong className="font-semibold text-[var(--m-ink)]">
                Maya will not start selling.
              </strong>{" "}
              Her job is to tell you what you got wrong. If a Trailguide is ever suggested to you,
              it will be because the same gap survived several sessions — and never in the moment
              you have just failed something.
            </p>
            <p className="mt-3 max-w-[62ch] text-[0.95rem] leading-relaxed text-[var(--m-ink-soft)]">
              <strong className="font-semibold text-[var(--m-ink)]">
                Trailmate stays free.
              </strong>{" "}
              If someone on Trailgrad has solved what you are stuck on, you will always be pointed
              at them first. Trailguide is for what a peer genuinely cannot do.
            </p>
          </div>
        </section>

        {/* ---------- the close ---------- */}
        <section
          className="mentor-rise mt-16"
          style={{ "--rise-delay": "480ms" } as React.CSSProperties}
        >
          <div className="flex flex-col gap-6 rounded-2xl border border-[var(--m-accent-line)] bg-[var(--m-raised)] p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <h2 className="text-[1.3rem] font-semibold leading-snug tracking-[-0.01em] text-[var(--m-ink)]">
                Trailguide is not open yet.
              </h2>
              <p className="mt-2 max-w-[46ch] text-[0.95rem] leading-relaxed text-[var(--m-ink-soft)]">
                We are building this carefully — a bad guide is worse than no guide. In the
                meantime, the fastest way to get unstuck is already in your sidebar.
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-stretch gap-2.5 sm:flex-row md:flex-col lg:flex-row">
              <span
                aria-disabled="true"
                className="inline-flex h-11 cursor-not-allowed select-none items-center justify-center gap-2 rounded-xl border border-[var(--m-line-strong)] bg-[var(--m-sunken)] px-5 text-[0.9rem] font-semibold text-[var(--m-ink-faint)]"
              >
                <CalendarClock size={16} strokeWidth={1.9} aria-hidden="true" />
                Choose a Trailguide
              </span>

              <Link
                href="/trailmate"
                className="group inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--m-accent-ink)] px-5 text-[0.9rem] font-semibold text-white outline-none transition-[background,transform] duration-200 ease-out hover:-translate-y-0.5 hover:bg-[color-mix(in_srgb,var(--m-accent-ink)_85%,#000)] focus-visible:ring-2 focus-visible:ring-[var(--m-accent-line)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--m-raised)]"
              >
                Ask a Trailmate instead
                <ArrowRight
                  size={16}
                  strokeWidth={2}
                  aria-hidden="true"
                  className="transition-transform duration-200 ease-out group-hover:translate-x-0.5"
                />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--m-ink-faint)]">
        {children}
      </h2>
      <span aria-hidden="true" className="h-px flex-1 bg-[var(--m-line)]" />
    </div>
  );
}

function LadderRow({
  rung,
  detail,
  cost,
  tone,
  last = false
}: {
  rung: string;
  detail: string;
  cost: string;
  tone: "quiet" | "live" | "soon";
  last?: boolean;
}) {
  return (
    <div
      className={[
        "flex items-center justify-between gap-4 px-5 py-4",
        last ? "" : "border-b border-[var(--m-line)]",
        tone === "soon" ? "bg-[var(--m-accent-soft)]" : ""
      ].join(" ")}
    >
      <div className="min-w-0">
        <p
          className={[
            "truncate text-[0.95rem] font-semibold",
            tone === "soon" ? "text-[var(--m-accent-ink)]" : "text-[var(--m-ink)]"
          ].join(" ")}
        >
          {rung}
        </p>
        <p className="mt-0.5 truncate text-[0.85rem] text-[var(--m-ink-faint)]">{detail}</p>
      </div>

      <span
        className={[
          "shrink-0 rounded-full px-2.5 py-1 font-mono text-[0.7rem] font-medium tracking-[0.04em]",
          tone === "soon"
            ? "bg-[var(--m-accent-ink)] text-white"
            : "bg-[var(--m-sunken)] text-[var(--m-ink-faint)]"
        ].join(" ")}
      >
        {cost}
      </span>
    </div>
  );
}
