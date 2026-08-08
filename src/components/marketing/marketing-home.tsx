"use client";

import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileUp,
  Gauge,
  GraduationCap,
  MessageSquareQuote,
  Mic,
  Route,
  SquareCode,
  Timer,
  TrendingUp
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Counter, Reveal, TypeOut, useScrollProgress } from "./reveal";
import { ExchangeCard, TrailgradMark, InterviewSignal, WaveStrip } from "./blueprint-art";
import type { Exchange } from "./blueprint-art";
import { LiveBars, ProductShowcase } from "./product-frames";
import { LearningTrail } from "./learning-trail";
import { MarketingAvatar } from "./marketing-avatar";
import { SiteFooter, SiteNav } from "./site-chrome";

const exchanges: Exchange[] = [
  {
    action: "probe",
    question: "Tell me about the payments service you owned.",
    answer: "We rebuilt it to be more reliable and it went really well for the team.",
    reply: "You said “we rebuilt it” — what did you personally design?",
    elapsed: "02:14",
    note: "Follow-up 1 of 2"
  },
  {
    action: "challenge",
    question: "How did you stop duplicate charges?",
    answer: "We added idempotency keys, so double charges became impossible.",
    reply: "Where did those keys live, and what happened when that store went down?",
    elapsed: "05:41",
    note: "Unsupported claim"
  },
  {
    action: "interrupt",
    question: "Walk me through the migration.",
    answer:
      "So originally the team had this legacy setup, and there was a lot of history there, and I think around that time we were also…",
    reply: "Let me stop you there — what was the outcome?",
    elapsed: "08:03",
    note: "94s, no point reached"
  },
  {
    action: "move_on",
    question: "What broke in production?",
    answer: "A retry storm took the queue down. I added jitter and capped depth — p99 fell 40%.",
    reply: "Good. Next — tell me about a design decision you argued against.",
    elapsed: "11:27",
    note: "Criteria met"
  }
];

/** The journey, end to end. Accents match the learning trail's palette. */
/** One accent for every step, matching the dark panels elsewhere. */
const FLOW_ACCENT = "#5b9dff";

const flowSteps: Array<{ label: string; detail: string; icon: LucideIcon }> = [
  {
    label: "Upload",
    detail: "Your real resume, read in memory and never stored.",
    icon: FileUp
  },
  {
    label: "Your path",
    detail: "An ordered trail, built from what is actually on it.",
    icon: Route
  },
  {
    label: "Learn",
    detail: "Maya briefs each stage before you touch a question.",
    icon: GraduationCap
  },
  {
    label: "Solve",
    detail: "Work the questions. Nothing unlocks out of order.",
    icon: SquareCode
  },
  {
    label: "Interview",
    detail: "A live voice round on what you just learned.",
    icon: Mic
  },
  {
    label: "Report",
    detail: "Scored evidence, and one thing to fix next.",
    icon: ClipboardCheck
  },
  {
    label: "Progress",
    detail: "Streaks, pattern coverage, week over week.",
    icon: TrendingUp
  }
];

function PrimaryAction({ children, className }: { children: ReactNode; className: string }) {
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <SignInButton
        mode="modal"
        forceRedirectUrl="/auth/continue"
        signUpForceRedirectUrl="/auth/continue"
      >
        <button type="button" className={className}>
          {children}
        </button>
      </SignInButton>
    );
  }

  return (
    <Link href="/interview" className={className}>
      {children}
    </Link>
  );
}

function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  useScrollProgress(heroRef);

  return (
    <section
      ref={heroRef}
      className="sticky top-0 z-0 h-[100svh] min-h-[40rem] overflow-hidden px-5 pb-10 pt-24 sm:px-10"
    >
      {/*
       * One centred column: Maya first, then the copy. The section is pinned to
       * the viewport for the parallax reveal and clips its overflow, so the
       * stack has a fixed height budget to live inside.
       *
       * Rather than guess the avatar's size, the copy is `shrink-0` and Maya is
       * `flex-1` — she takes every pixel the text does not need. That makes her
       * as large as the viewport allows on a tall display and still fits the
       * CTA on a laptop, which a fixed height or a vh clamp cannot do at once.
       */}
      <div className="hero-parallax relative z-10 mx-auto flex h-full w-full max-w-[46rem] flex-col items-center justify-center text-center">
        <div className="relative max-h-[30rem] min-h-[8rem] w-full max-w-[22rem] flex-1 sm:max-w-[28rem]">
          <InterviewSignal className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[20rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 opacity-35 sm:h-[26rem] sm:w-[34rem] sm:opacity-50" />
          <MarketingAvatar
            priority
            className="pointer-events-none absolute inset-0 z-10 drop-shadow-[0_24px_30px_rgba(4,12,35,0.5)]"
          />
          <div className="pointer-events-none absolute -bottom-1 left-1/2 h-px w-48 -translate-x-1/2 bg-cream/25 shadow-[0_0_24px_rgba(239,232,214,0.35)] sm:w-64" />
        </div>

        {/* Fixed-height block, so the avatar above can only grow into space
            this does not claim. */}
        <div className="flex w-full shrink-0 flex-col items-center">
          <Reveal>
            <span className="mt-8 inline-flex items-center gap-2.5 rounded-full border border-cream/20 bg-cream/5 px-3.5 py-1.5 backdrop-blur-sm">
              <TrailgradMark className="h-3.5 w-3.5 text-cream" />
              <span className="blueprint-label whitespace-nowrap text-cream/80">
                Learn it, then defend it
              </span>
            </span>
          </Reveal>

          {/*
           * Greeting on top, promise underneath. The name is not repeated here —
           * the mark carries it in the badge and the nav, and the footer still
           * runs the full wordmark.
           */}
          <Reveal delay={90}>
            <h1 className="mt-6">
              <span
                className="wordmark block text-cream"
                style={{ fontSize: "clamp(2.5rem, 6vw, 4.25rem)", letterSpacing: "-0.03em" }}
              >
                Let&rsquo;s begin.
              </span>
              <span
                className="display-heading mx-auto mt-5 block max-w-xl text-cream/90"
                style={{ fontSize: "clamp(1.35rem, 3vw, 2rem)" }}
              >
                The learning trail that <span className="text-white">pushes back</span>.
              </span>
            </h1>
          </Reveal>

          <Reveal delay={240}>
            <LiveBars count={18} className="mt-7 hidden h-8 opacity-60 sm:flex" />
          </Reveal>

          <Reveal delay={300}>
            <PrimaryAction className="ghost-button mt-7 inline-flex min-h-12 items-center gap-3 rounded-2xl border border-cream/40 px-7 text-sm font-semibold text-cream sm:text-base">
              Start free
              <ArrowRight size={18} aria-hidden="true" />
            </PrimaryAction>
          </Reveal>

          <Reveal delay={360}>
            <p className="blueprint-label mt-5 text-cream/40">
              Free to start &middot; No card required
            </p>
          </Reveal>
        </div>
      </div>

      <div className="blueprint-label absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 text-cream/40 lg:block">
        Scroll
      </div>
    </section>
  );
}

/**
 * The half of the product that is not the interview.
 *
 * This used to list the frontend roadmap's six session titles and its twelve
 * DSA chapters, which read as though Trailgrad only served frontend
 * candidates solving algorithm questions. The stages are named after what
 * they do instead, so the same trail describes any role the product sets up.
 */
function LearningPath() {
  return (
    <section
      id="learn"
      className="relative z-10 bg-blueprint px-6 pb-20 pt-20 sm:px-10 sm:pb-28 sm:pt-32"
    >
      <div className="mx-auto w-full max-w-[78rem]">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="blueprint-label text-cream/50">The trail</p>
          </Reveal>
          <Reveal delay={80}>
            <h2
              className="display-heading mt-5 text-cream"
              style={{ fontSize: "clamp(2.25rem, 5vw, 4.25rem)" }}
            >
              Preparation, not a
              <br />
              question dump.
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-cream/75">
              Upload the resume you actually use and you get an ordered trail for the role you are
              chasing. Maya briefs each stage before you touch a question, nothing unlocks out of
              order, and your progress page shows exactly what is closed out.
            </p>
          </Reveal>
        </div>

        <Reveal delay={200}>
          {/* Narrower than the 78rem the rest of the section runs at, so the
              panel reads as a held object rather than a full-bleed band. */}
          <div className="mx-auto mt-16 w-full max-w-[68rem]">
            <LearningTrail />
          </div>
        </Reveal>

        <Reveal delay={260}>
          <dl className="mx-auto mt-20 grid max-w-3xl grid-cols-3 gap-6 border-t border-cream/15 pt-10 text-center">
            {[
              { value: 123, label: "Curated questions" },
              { value: 12, label: "Core patterns" },
              { value: 6, label: "Roles covered" }
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <Counter
                    value={stat.value}
                    className="wordmark block text-4xl text-cream sm:text-6xl"
                  />
                  <span className="blueprint-label mt-3 block text-cream/50">{stat.label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}

function TheInterview() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Stepping by hand stops the carousel so auto-play doesn't fight the user.
  const [pinned, setPinned] = useState(false);
  const active = exchanges[index] ?? exchanges[0];

  useEffect(() => {
    if (paused || pinned) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % exchanges.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [paused, pinned]);

  function move(step: number) {
    setPinned(true);
    setIndex((current) => (current + step + exchanges.length) % exchanges.length);
  }

  if (!active) return null;

  return (
    <section
      id="interview"
      className="relative z-10 bg-blueprint px-6 pb-16 pt-20 sm:px-10 sm:pb-24 sm:pt-32"
    >
      <div className="mx-auto grid w-full max-w-[78rem] gap-16 lg:grid-cols-2 lg:items-center">
        <div>
          <Reveal>
            <h2
              className="display-heading text-cream"
              style={{ fontSize: "clamp(2.5rem, 5.4vw, 5.25rem)" }}
            >
              Then Prove
              <br />
              You Know It
              <span className="ml-3 inline-block text-white">&raquo;</span>
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-cream/80 sm:text-xl">
              Learning a pattern is not the same as holding it under pressure. The interview draws
              on the chapters you have finished and the projects on your resume — so the questions
              are yours, not a bank's. Vague answers get probed. Claims that do not hold up get
              challenged. Ramble past ninety seconds and it cuts in.
            </p>
          </Reveal>
          <Reveal delay={200}>
            <p className="mt-8 border-l-2 border-cream/25 pl-5 text-base leading-relaxed text-cream/60">
              Every answer gets exactly one of three responses: probe, challenge, or move on. Two
              follow-ups per question, then it moves regardless.
            </p>
          </Reveal>
        </div>

        <div
          className="relative"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <Reveal delay={80}>
            <div className="relative min-h-[22rem]">
              {exchanges.map((exchange, exchangeIndex) => (
                <div
                  key={exchange.question}
                  className={[
                    "transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    exchangeIndex === index
                      ? "relative scale-100 opacity-100"
                      : "pointer-events-none absolute inset-0 scale-95 opacity-0"
                  ].join(" ")}
                >
                  <ExchangeCard exchange={exchange} />
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={160}>
            <div className="mt-6 flex items-center justify-between gap-6 border-t border-cream/15 pt-6">
              <p className="blueprint-label text-cream/50">Live decision</p>
              <div className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => move(-1)}
                  aria-label="Previous exchange"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-cream/30 text-cream transition hover:bg-cream/10"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="blueprint-label text-cream/60">
                  {index + 1}/{exchanges.length}
                </span>
                <button
                  type="button"
                  onClick={() => move(1)}
                  aria-label="Next exchange"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-cream/30 text-cream transition hover:bg-cream/10"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      <div className="mx-auto mt-28 w-full max-w-[78rem]">
        <Reveal>
          <p className="blueprint-label text-center text-cream/45">Every session</p>
        </Reveal>
        <div className="mt-10 grid gap-10 text-center sm:grid-cols-3">
          {[
            { value: 15, suffix: "", label: "Minutes, hard cap" },
            { value: 2, suffix: "", label: "Follow-ups, max" },
            { value: 1, suffix: "", label: "Thing to fix" }
          ].map((stat, statIndex) => (
            <Reveal key={stat.label} delay={statIndex * 110}>
              <div style={{ fontSize: "clamp(3rem, 8vw, 6.5rem)" }}>
                <Counter
                  value={stat.value}
                  suffix={stat.suffix}
                  className="wordmark block text-cream"
                />
                <p className="blueprint-label mt-3 text-cream/55">{stat.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureBoard() {
  return (
    <section id="features" className="relative z-10 bg-blueprint px-6 py-16 sm:px-10 sm:py-24">
      <div className="mx-auto w-full max-w-[78rem]">
        <Reveal>
          <p className="blueprint-label text-center text-cream/50">Under pressure</p>
        </Reveal>
        <Reveal delay={90}>
          <h2
            className="display-heading mt-5 text-center text-cream"
            style={{ fontSize: "clamp(2.5rem, 6vw, 5rem)" }}
          >
            Nowhere To Hide.
          </h2>
        </Reveal>

        <Reveal delay={150}>
          <div className="relative mt-16 rounded-[2rem] border border-cream/25 bg-cream-soft p-3 shadow-[0_40px_120px_rgba(9,21,60,0.45)] sm:p-4">
            {["left-3 top-3", "right-3 top-3", "left-3 bottom-3", "right-3 bottom-3"].map(
              (position) => (
                <span
                  key={position}
                  className={`absolute ${position} h-4 w-4 rounded-[4px] bg-blueprint/15`}
                />
              )
            )}

            <div className="rounded-[1.5rem] bg-blueprint-deep p-6 sm:p-10">
              <div className="grid gap-8 lg:grid-cols-3">
                <NoteCard
                  className="lg:col-span-2"
                  tilt="-0.8deg"
                  pin="#2f6fd0"
                  tone="bg-note-white"
                  eyebrow="The interviewer"
                  icon={<MessageSquareQuote size={16} />}
                  title="Follow-ups, not a script"
                >
                  <p className="text-sm leading-6 text-blueprint/75">
                    After every answer it picks one action and says one line. It quotes your own
                    words back at you instead of asking you to elaborate.
                  </p>
                  <div className="mt-6 rounded-xl bg-[#0f1729] p-4 font-mono text-xs text-cream/90">
                    <div className="flex items-center justify-between text-cream/45">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#5b8df0]" />
                        decision
                      </span>
                      <span>flash</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {[
                        { label: "action", value: "probe", tint: "text-[#8fb4ff]" },
                        { label: "missing", value: "ownership", tint: "text-cream/85" },
                        { label: "follow_ups", value: "1 / 2", tint: "text-cream/85" }
                      ].map((row) => (
                        <div key={row.label} className="flex justify-between">
                          <span className="text-cream/50">{row.label}</span>
                          <span className={row.tint}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </NoteCard>

                <NoteCard
                  className="lg:row-span-2"
                  tilt="1.4deg"
                  pin="#d94f4f"
                  tone="bg-note-yellow"
                  eyebrow="Turn-taking"
                  icon={<Timer size={16} />}
                  title="It interrupts you"
                >
                  <p className="text-sm leading-6 text-blueprint/75">
                    A watchdog runs alongside the whole interview. Pass ninety seconds without
                    landing a point and it cuts in mid-sentence, the way a real interviewer does
                    when the clock is real.
                  </p>
                  <PrimaryAction className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl border border-blueprint/30 px-4 text-sm font-semibold text-blueprint transition hover:border-blueprint/60 hover:bg-blueprint/10">
                    Try it
                    <ArrowRight size={15} aria-hidden="true" />
                  </PrimaryAction>
                  <div className="mt-6 rounded-xl bg-[#0f1729] p-4 font-mono text-[11px] text-cream/85">
                    <div className="flex items-center justify-between text-cream/45">
                      <span>answer_timer</span>
                      <span className="text-[#ff9a9a]">94s</span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full w-[94%] rounded-full bg-[#dd5f5f]" />
                    </div>
                    <p className="mt-3 leading-5 text-cream/70">
                      &ldquo;Let me stop you there &mdash; what was the outcome?&rdquo;
                    </p>
                  </div>
                </NoteCard>

                <NoteCard
                  tilt="-1.6deg"
                  pin="#3fa06a"
                  tone="bg-note-pink"
                  eyebrow="Before the round"
                  icon={<Mic size={16} />}
                  title="You studied for this"
                >
                  <p className="text-sm leading-6 text-blueprint/75">
                    Rounds pull from the chapters you have already worked through, so an interview
                    is a check on the path — not a cold open against material you have never seen.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {["Backend", "3–5 yrs", "Technical", "Realistic"].map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full bg-white/55 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-blueprint/75"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </NoteCard>

                <NoteCard
                  tilt="1.1deg"
                  pin="#e08b3a"
                  tone="bg-note-blue"
                  eyebrow="Scoring"
                  icon={<Gauge size={16} />}
                  title="What it counted"
                >
                  <p className="text-sm leading-6 text-blueprint/75">
                    Every probe, challenge and interruption is counted, and each answer is scored on
                    four things: ownership, specifics, decision rationale, and outcome.
                  </p>
                  <div className="mt-5 space-y-2">
                    {[
                      { name: "probes", value: "3 this round" },
                      { name: "evidence_score", value: "74 / 100" }
                    ].map((metric) => (
                      <div
                        key={metric.name}
                        className="flex items-center justify-between rounded-lg bg-white/55 px-3 py-2 font-mono text-[11px] text-blueprint/80"
                      >
                        <span>{metric.name}</span>
                        <span className="text-blueprint">{metric.value}</span>
                      </div>
                    ))}
                  </div>
                </NoteCard>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function NoteCard({
  children,
  className,
  eyebrow,
  icon,
  pin,
  tilt,
  title,
  tone
}: {
  children: ReactNode;
  className?: string;
  eyebrow: string;
  icon: ReactNode;
  pin: string;
  tilt: string;
  title: string;
  tone: string;
}) {
  return (
    <article
      className={[
        "note-card rounded-2xl p-6 shadow-note hover:shadow-note-lift sm:p-7",
        tone,
        className ?? ""
      ]
        .join(" ")
        .trim()}
      style={{ "--tilt": tilt } as React.CSSProperties}
    >
      <span className="note-pin" style={{ "--pin": pin } as React.CSSProperties} />
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blueprint/10 text-blueprint">
        {icon}
      </span>
      <p className="blueprint-label mt-5 text-blueprint/55">{eyebrow}</p>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-blueprint">{title}</h3>
      <div className="mt-4">{children}</div>
    </article>
  );
}

function Delivery() {
  const metrics = [
    { label: "Evidence score", value: "74", unit: "of 100", hint: "Averaged over recent rounds" },
    { label: "Pattern coverage", value: "62", unit: "percent", hint: "Chapters closed out" },
    { label: "Competencies", value: "6", unit: "tracked", hint: "Round by round, side by side" },
    { label: "Solve streak", value: "11", unit: "days", hint: "Longest run so far" }
  ];

  return (
    <section id="report" className="relative z-10 bg-blueprint px-6 py-16 sm:px-10 sm:py-24">
      <div className="mx-auto grid w-full max-w-[78rem] gap-14 lg:grid-cols-2 lg:items-center">
        <div>
          <Reveal>
            <p className="blueprint-label text-cream/50">After the round</p>
          </Reveal>
          <Reveal delay={80}>
            <h2
              className="display-heading mt-5 max-w-xl text-cream"
              style={{ fontSize: "clamp(2.25rem, 5vw, 4.25rem)" }}
            >
              Proof you moved.
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-cream/80">
              Every round is scored on the evidence in your answers, competency by competency. Run a
              few and the reports stack into a trend — which competency is climbing, which one keeps
              costing you the same points, and how much of each pattern you have closed out.
            </p>
          </Reveal>
          <Reveal delay={200}>
            <p className="mt-8 border-l-2 border-cream/25 pl-5 text-base leading-relaxed text-cream/60">
              Then one thing to fix. Not a list of nine, because you will act on one.
            </p>
          </Reveal>
        </div>

        <Reveal delay={120}>
          <div className="grid grid-cols-2 gap-4">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-2xl border border-cream/20 bg-[#0f1729] p-5 transition duration-300 hover:border-cream/40 sm:p-6"
              >
                <p className="blueprint-label text-cream/45">{metric.label}</p>
                <p className="mt-4 flex items-baseline gap-1.5">
                  <span className="wordmark text-4xl text-cream sm:text-5xl">{metric.value}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-cream/45">
                    {metric.unit}
                  </span>
                </p>
                <p className="mt-3 font-mono text-[11px] leading-5 text-cream/40">{metric.hint}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function SessionFlow() {
  return (
    <section id="flow" className="relative z-10 bg-blueprint px-6 py-16 sm:px-10 sm:py-24">
      <div className="mx-auto w-full max-w-[78rem]">
        <Reveal>
          <p className="blueprint-label text-cream/50">End to end</p>
        </Reveal>
        <Reveal delay={80}>
          <h2
            className="display-heading mt-5 max-w-3xl text-cream"
            style={{ fontSize: "clamp(2.25rem, 5vw, 4.25rem)" }}
          >
            Resume in. Offer-ready out.
          </h2>
        </Reveal>

        {/*
         * Seven steps never sat well in the old four-column divider grid — it
         * left a dead cell plugged with an empty <li> just to hide the divider
         * background. Three columns leave the last row short by design, and
         * the closing card fills it with an action instead of dead space.
         */}
        <ol className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {flowSteps.map((step, stepIndex) => {
            const Icon = step.icon;
            return (
              <li key={step.label}>
                <Reveal delay={stepIndex * 60}>
                  <article className="group relative h-full overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d1424] p-6 shadow-[0_20px_50px_-30px_rgba(4,10,32,0.9)] transition duration-300 hover:-translate-y-1 hover:border-white/[0.14] hover:bg-[#111a2e] sm:p-7">
                    <span
                      aria-hidden
                      className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100"
                      style={{
                        background: `linear-gradient(90deg, ${FLOW_ACCENT}, transparent)`
                      }}
                    />

                    <span
                      className="relative grid h-12 w-12 place-items-center rounded-xl border transition-colors duration-300"
                      style={{
                        borderColor: `${FLOW_ACCENT}33`,
                        backgroundColor: `${FLOW_ACCENT}12`,
                        color: FLOW_ACCENT
                      }}
                    >
                      <Icon size={22} strokeWidth={1.9} aria-hidden="true" />
                    </span>

                    <h3 className="relative mt-6 text-xl font-semibold tracking-tight text-cream">
                      {step.label}
                    </h3>
                    <p className="relative mt-2 min-h-[3rem] text-[13.5px] leading-6 text-cream/55">
                      <TypeOut text={step.detail} />
                    </p>
                  </article>
                </Reveal>
              </li>
            );
          })}

          {/* Spans two columns only at lg. At sm it stays a single cell so
              the eight items fill four rows exactly, instead of stranding the
              seventh step beside a gap. */}
          <li className="lg:col-span-2">
            <Reveal delay={420}>
              <div className="flex h-full flex-col justify-center rounded-2xl border border-dashed border-cream/20 bg-cream/[0.02] p-6 text-center sm:p-8">
                <p className="text-[15px] leading-7 text-cream/65">
                  Seven steps, one trail. The whole loop runs on the resume you already have.
                </p>
                <PrimaryAction className="ghost-button mx-auto mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-cream/40 px-6 text-sm font-semibold text-cream">
                  Start free
                  <ArrowRight size={16} aria-hidden="true" />
                </PrimaryAction>
              </div>
            </Reveal>
          </li>
        </ol>
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="relative z-10 overflow-hidden bg-blueprint px-6 pb-24 pt-16 sm:px-10 sm:pb-32 sm:pt-24">
      <WaveStrip className="pointer-events-none absolute -left-24 top-16 h-52 w-[30rem] opacity-30 lg:left-0" />
      <WaveStrip
        flip
        className="pointer-events-none absolute -right-24 bottom-16 h-52 w-[30rem] opacity-30 lg:right-0"
      />

      <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center text-center">
        <Reveal>
          <h2
            className="display-heading text-cream"
            style={{ fontSize: "clamp(2.5rem, 6vw, 4.75rem)" }}
          >
            Start the path today.
          </h2>
        </Reveal>
        <Reveal delay={100}>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-cream/80">
            Upload a resume, get an ordered path through the patterns, and take a live round that
            does not let a vague answer through.
          </p>
        </Reveal>
        <Reveal delay={200}>
          <PrimaryAction className="ghost-button mt-10 inline-flex min-h-14 items-center gap-3 rounded-2xl border border-cream/40 px-8 text-base font-semibold text-cream">
            Start free
            <ArrowRight size={18} aria-hidden="true" />
          </PrimaryAction>
        </Reveal>
      </div>
    </section>
  );
}

export function MarketingHome() {
  // overflow-x-clip, not hidden: `hidden` would make this a scroll container
  // and kill the hero's sticky parallax.
  return (
    <div className="blueprint overflow-x-clip">
      <div className="blueprint-grid" />
      <div className="blueprint-rails" />

      <SiteNav
        action={
          // Cream fill on the dark bar. Height and radius match the logo
          // tile at the other end, so the two ends read as a matched pair.
          <PrimaryAction className="inline-flex h-12 items-center rounded-2xl bg-cream px-6 text-[14px] font-semibold text-blueprint outline-none transition hover:bg-white focus-visible:ring-2 focus-visible:ring-cream/50">
            Get started
          </PrimaryAction>
        }
      />

      <main className="relative">
        <Hero />
        <LearningPath />
        <TheInterview />
        <ProductShowcase
          action={
            <PrimaryAction className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-cream px-4 py-2.5 text-sm font-semibold text-blueprint transition hover:bg-white">
              Start interview
              <ArrowRight size={15} aria-hidden="true" />
            </PrimaryAction>
          }
        />
        <FeatureBoard />
        <Delivery />
        <SessionFlow />
        <ClosingCta />
      </main>

      <SiteFooter
        action={
          <PrimaryAction className="inline-flex items-center gap-2 text-sm font-semibold text-cream transition hover:gap-3">
            Start free <ArrowRight size={15} aria-hidden="true" />
          </PrimaryAction>
        }
      />
    </div>
  );
}
