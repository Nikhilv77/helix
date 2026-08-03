"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Gauge,
  MessageSquareQuote,
  Mic,
  Timer
} from "lucide-react";
import { Counter, Reveal, useScrollProgress } from "./reveal";
import { ExchangeCard, HelixMark, VoiceRing, WaveStrip } from "./blueprint-art";
import type { Exchange } from "./blueprint-art";
import { LiveBars, ProductShowcase } from "./product-frames";
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

const flowSteps = [
  { label: "Setup", detail: "Five taps, under a minute" },
  { label: "Mic check", detail: "Speak once, confirm audio" },
  { label: "Intro", detail: "Expectations, then a warm-up" },
  { label: "Questions", detail: "Four, roughly three minutes each" },
  { label: "Follow-ups", detail: "Probe or challenge, twice at most" },
  { label: "Wrap", detail: "Your questions, then close" },
  { label: "Report", detail: "Scores, evidence, one fix" }
];

/**
 * Interviews run logged out, so the primary action goes straight to setup
 * rather than through a sign-in wall.
 */
function PrimaryAction({ children, className }: { children: ReactNode; className: string }) {
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
      className="sticky top-0 z-0 flex h-[100svh] flex-col items-center justify-center overflow-hidden px-5"
    >
      <VoiceRing className="hero-art pointer-events-none absolute -right-24 top-1/2 h-[38rem] w-[38rem] -translate-y-1/3 opacity-40 sm:-right-16 lg:right-[-6rem] lg:h-[46rem] lg:w-[46rem]" />

      <div className="hero-parallax relative z-10 flex w-full max-w-[80rem] flex-col items-center text-center">
        <Reveal>
          <span className="inline-flex items-center gap-3 rounded-full border border-cream/25 bg-cream/5 px-4 py-2 backdrop-blur-sm">
            <HelixMark className="h-4 w-4 text-cream" />
            <span className="blueprint-label whitespace-nowrap text-cream/90">
              Real-time voice interviews
            </span>
            <span className="blueprint-label hidden text-cream/45 sm:inline">Live</span>
          </span>
        </Reveal>

        <Reveal delay={90}>
          <h1
            className="wordmark mt-8 text-cream"
            style={{ fontSize: "clamp(4.5rem, 19vw, 17rem)" }}
          >
            Helix
          </h1>
        </Reveal>

        <Reveal delay={180}>
          <p className="mt-4 max-w-2xl text-lg font-medium leading-snug text-cream/85 sm:text-2xl">
            The mock interview that
            <br />
            <span className="text-white">pushes back</span>.
          </p>
        </Reveal>

        <Reveal delay={240}>
          <LiveBars count={22} className="mt-8 h-10 opacity-70" />
        </Reveal>

        <Reveal delay={300}>
          <PrimaryAction className="ghost-button mt-6 inline-flex min-h-14 items-center gap-3 rounded-2xl border border-cream/40 px-8 text-base font-semibold text-cream">
            Start a mock interview
            <ArrowRight size={18} aria-hidden="true" />
          </PrimaryAction>
        </Reveal>

        <Reveal delay={360}>
          <p className="blueprint-label mt-6 text-cream/45">No account needed to practice</p>
        </Reveal>
      </div>

      <div className="blueprint-label absolute bottom-8 z-10 text-cream/40">Scroll</div>
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
    <section id="interview" className="relative z-10 bg-blueprint px-6 pb-24 pt-28 sm:px-10 sm:pt-32">
      <div className="mx-auto grid w-full max-w-[78rem] gap-16 lg:grid-cols-2 lg:items-center">
        <div>
          <Reveal>
            <h2
              className="display-heading text-cream"
              style={{ fontSize: "clamp(2.5rem, 5.4vw, 5.25rem)" }}
            >
              Answer.
              <br />
              Then Defend It
              <span className="ml-3 inline-block text-white">&raquo;</span>
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-cream/80 sm:text-xl">
              Tell it what you have actually worked on, and the questions come from your projects
              rather than a question bank. Vague answers get probed. Claims that do not hold up get
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
          <Reveal delay={60}>
            <MarketingAvatar className="mx-auto mb-2 h-[19rem] w-full max-w-[19rem]" />
          </Reveal>

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
            { value: 4, suffix: "", label: "Questions" },
            { value: 1, suffix: "", label: "Thing to fix" }
          ].map((stat, statIndex) => (
            <Reveal key={stat.label} delay={statIndex * 110}>
              <div style={{ fontSize: "clamp(3rem, 8vw, 6.5rem)" }}>
                <Counter value={stat.value} suffix={stat.suffix} className="wordmark block text-cream" />
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
    <section id="features" className="relative z-10 bg-blueprint px-6 py-24 sm:px-10">
      <div className="mx-auto w-full max-w-[78rem]">
        <Reveal>
          <p className="blueprint-label text-center text-cream/50">The feature board</p>
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
                  eyebrow="Setup"
                  icon={<Mic size={16} />}
                  title="Sixty seconds in"
                >
                  <p className="text-sm leading-6 text-blueprint/75">
                    Role, level, round, intensity, and one line about what you have shipped. That
                    last one is what stops the questions being generic.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {["Backend", "3–5 yrs", "Behavioral", "Brutal"].map((chip) => (
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
                  eyebrow="Delivery"
                  icon={<Gauge size={16} />}
                  title="How you sounded"
                >
                  <p className="text-sm leading-6 text-blueprint/75">
                    Filler rate, longest unbroken ramble, average time to the point, and talk
                    ratio &mdash; measured, not guessed.
                  </p>
                  <div className="mt-5 space-y-2">
                    {[
                      { name: "filler_rate", value: "4.2 / min" },
                      { name: "time_to_point", value: "38s avg" }
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
      className={["note-card rounded-2xl p-6 shadow-note hover:shadow-note-lift sm:p-7", tone, className ?? ""]
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
    { label: "Filler rate", value: "4.2", unit: "per min", hint: "“um”, “like”, “basically”" },
    { label: "Longest ramble", value: "94", unit: "seconds", hint: "Question 3, interrupted" },
    { label: "Time to point", value: "38", unit: "sec avg", hint: "Target is under 20" },
    { label: "Talk ratio", value: "83", unit: "percent", hint: "You spoke, they listened" }
  ];

  return (
    <section id="report" className="relative z-10 bg-blueprint px-6 py-24 sm:px-10">
      <div className="mx-auto grid w-full max-w-[78rem] gap-14 lg:grid-cols-2 lg:items-center">
        <div>
          <Reveal>
            <p className="blueprint-label text-cream/50">Delivery</p>
          </Reveal>
          <Reveal delay={80}>
            <h2
              className="display-heading mt-5 max-w-xl text-cream"
              style={{ fontSize: "clamp(2.25rem, 5vw, 4.25rem)" }}
            >
              Not just what you said.
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-cream/80">
              How you said it gets measured too. Filler words, how long you went before landing a
              point, and how much of the room you took &mdash; counted from the transcript, not
              guessed at.
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
    <section id="flow" className="relative z-10 bg-blueprint px-6 py-24 sm:px-10">
      <div className="mx-auto w-full max-w-[78rem]">
        <Reveal>
          <p className="blueprint-label text-cream/50">The session</p>
        </Reveal>
        <Reveal delay={80}>
          <h2
            className="display-heading mt-5 max-w-3xl text-cream"
            style={{ fontSize: "clamp(2.25rem, 5vw, 4.25rem)" }}
          >
            Fifteen minutes, start to report.
          </h2>
        </Reveal>

        <ol className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-cream/15 bg-cream/15 sm:grid-cols-2 lg:grid-cols-4">
          {flowSteps.map((step, stepIndex) => (
            <li key={step.label} className="bg-blueprint">
              <Reveal delay={stepIndex * 70}>
                <div className="group h-full p-6 transition-colors duration-300 hover:bg-blueprint-light/40">
                  <span className="blueprint-label text-cream/40">
                    {String(stepIndex + 1).padStart(2, "0")}
                  </span>
                  <p className="mt-4 text-lg font-semibold tracking-tight text-cream">
                    {step.label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-cream/60">{step.detail}</p>
                  <ArrowRight
                    size={16}
                    className="mt-6 text-cream/35 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-cream"
                    aria-hidden="true"
                  />
                </div>
              </Reveal>
            </li>
          ))}
          {/* Fills the trailing grid cell so the divider background doesn't show. */}
          <li className="hidden bg-blueprint lg:block" aria-hidden="true" />
        </ol>
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="relative z-10 overflow-hidden bg-blueprint px-6 pb-32 pt-24 sm:px-10">
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
            Ready for the follow-up?
          </h2>
        </Reveal>
        <Reveal delay={100}>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-cream/80">
            Five questions of setup, then fifteen minutes of an interviewer that does not let a
            vague answer through.
          </p>
        </Reveal>
        <Reveal delay={200}>
          <PrimaryAction className="ghost-button mt-10 inline-flex min-h-14 items-center gap-3 rounded-2xl border border-cream/40 px-8 text-base font-semibold text-cream">
            Start a mock interview
            <ArrowRight size={18} aria-hidden="true" />
          </PrimaryAction>
        </Reveal>
      </div>
    </section>
  );
}

export function MarketingHome() {
  return (
    <div className="blueprint">
      <div className="blueprint-grid" />
      <div className="blueprint-rails" />

      <SiteNav
        action={
          <PrimaryAction className="inline-flex min-h-10 items-center rounded-full border border-cream bg-cream px-5 text-sm font-semibold text-blueprint transition hover:bg-white">
            Start interview
          </PrimaryAction>
        }
      />

      <main className="relative">
        <Hero />
        <TheInterview />
        <ProductShowcase />
        <FeatureBoard />
        <Delivery />
        <SessionFlow />
        <ClosingCta />
      </main>

      <SiteFooter />
    </div>
  );
}
