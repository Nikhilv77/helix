"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ExchangeAction } from "../blueprint-art";
import { InterviewSignal, TrailgradMark } from "../blueprint-art";
import { Counter, Reveal, TypeOut } from "../reveal";
import { exchanges } from "./data";

const decisionMeta: Record<
  ExchangeAction,
  { label: string; eyebrow: string; border: string; ink: string; wash: string }
> = {
  probe: {
    label: "Probe",
    eyebrow: "Needs evidence",
    border: "border-[#3657b4]/35",
    ink: "text-[#27469a]",
    wash: "bg-[#3657b4]/[0.075]"
  },
  challenge: {
    label: "Challenge",
    eyebrow: "Claim check",
    border: "border-[#a65c20]/35",
    ink: "text-[#7a4218]",
    wash: "bg-[#a65c20]/[0.075]"
  },
  interrupt: {
    label: "Interrupt",
    eyebrow: "Too vague",
    border: "border-[#9d3434]/35",
    ink: "text-[#7a2424]",
    wash: "bg-[#9d3434]/[0.075]"
  },
  move_on: {
    label: "Move on",
    eyebrow: "Proof landed",
    border: "border-[#227350]/35",
    ink: "text-[#1d5d43]",
    wash: "bg-[#227350]/[0.075]"
  }
};

const roundRules = [
  ["Probe", "A vague answer gets one specific follow-up."],
  ["Challenge", "Unsupported claims are tested against the details."],
  ["Move", "Once the signal is clear, the round keeps moving."]
] as const;

export function TheInterview() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const active = exchanges[index] ?? exchanges[0];

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % exchanges.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [paused]);

  function move(step: number) {
    setIndex((current) => (current + step + exchanges.length) % exchanges.length);
  }

  if (!active) return null;

  return (
    <section
      id="interview"
      className="relative z-10 overflow-hidden bg-blueprint px-5 py-20 sm:px-10 sm:py-28"
    >
      <InterviewSignal className="pointer-events-none absolute left-1/2 top-14 h-[26rem] w-[34rem] -translate-x-1/2 opacity-10 sm:h-[34rem] sm:w-[44rem]" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(241,234,216,0.08) 1px, transparent 1px), linear-gradient(180deg, rgba(241,234,216,0.08) 1px, transparent 1px)",
          backgroundPosition: "center top",
          backgroundSize: "11rem 11rem"
        }}
      />
      <div className="pointer-events-none absolute -left-28 top-20 h-72 w-72 rounded-full border border-cream/10" />
      <div className="pointer-events-none absolute -right-24 bottom-16 h-80 w-80 rounded-full border border-cream/10" />

      <div className="relative mx-auto flex w-full max-w-[76rem] flex-col items-center">
        <Reveal>
          <span className="inline-flex items-center gap-2.5 rounded-full border border-cream/20 bg-cream/5 px-3.5 py-1.5 backdrop-blur-sm">
            <TrailgradMark className="h-3.5 w-3.5 text-cream" />
            <span className="blueprint-label whitespace-nowrap text-cream/80">Live round</span>
          </span>
        </Reveal>

        <Reveal delay={80}>
          <h2
            className="display-heading mt-6 max-w-4xl text-center text-cream"
            style={{ fontSize: "clamp(2.4rem, 5.6vw, 5rem)" }}
          >
            Then prove you know it.
          </h2>
        </Reveal>

        <Reveal delay={160}>
          <p className="mx-auto mt-7 max-w-2xl text-center text-lg leading-relaxed text-cream/76 sm:text-xl">
            The interview uses your finished chapters and resume evidence. Vague answers get
            probed, loose claims get challenged, and strong proof moves forward.
          </p>
        </Reveal>

        <div className="mt-14 grid w-full gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
          <Reveal delay={220}>
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              {roundRules.map(([label, detail], ruleIndex) => (
                <div
                  key={label}
                  className="rounded-2xl border border-cream/18 bg-cream/[0.065] p-5 shadow-[0_22px_70px_-48px_rgba(3,10,31,0.72)]"
                  style={{ transform: `rotate(${[-1.2, 0.8, -0.5][ruleIndex]}deg)` }}
                >
                  <p className="font-card text-2xl font-bold text-cream">{label}</p>
                  <p className="mt-2 text-sm font-medium leading-6 text-cream/65">{detail}</p>
                </div>
              ))}
            </div>
          </Reveal>

          <div
            className="relative"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <Reveal delay={260}>
              <div className="relative min-h-[29rem]">
                {exchanges.map((exchange, exchangeIndex) => {
                  const showing = exchangeIndex === index;
                  return (
                    <div
                      key={exchange.question}
                      className={[
                        "transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
                        showing
                          ? "relative scale-100 opacity-100"
                          : "pointer-events-none absolute inset-0 scale-95 opacity-0"
                      ].join(" ")}
                    >
                      <InterviewNote exchange={exchange} active={showing} />
                    </div>
                  );
                })}
              </div>
            </Reveal>

            <Reveal delay={340}>
              <div className="mx-auto mt-6 max-w-2xl border-t border-cream/15 pt-6">
                <div className="mb-5 h-1 overflow-hidden rounded-full bg-cream/12">
                  <span
                    key={index}
                    className={[
                      "block h-full rounded-full bg-cream/80",
                      paused ? "w-full" : "interview-carousel-progress"
                    ].join(" ")}
                  />
                </div>

                <div className="flex items-center justify-between gap-5">
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

              </div>
            </Reveal>
          </div>
        </div>

        <div className="mt-20 grid w-full max-w-3xl grid-cols-3 gap-6 border-t border-cream/15 pt-8 text-center">
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

function InterviewNote({
  exchange,
  active
}: {
  exchange: (typeof exchanges)[number];
  active: boolean;
}) {
  const meta = decisionMeta[exchange.action];

  return (
    <article className="relative mx-auto max-w-2xl overflow-hidden rounded-[1.6rem] border border-cream/85 bg-[#f1ead8] p-5 text-left text-[#202227] shadow-[0_34px_90px_-48px_rgba(3,10,31,0.78)] sm:p-7">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-80"
        style={{
          backgroundImage:
            "linear-gradient(180deg, transparent 0 31px, rgba(54,87,180,0.1) 32px, transparent 33px), linear-gradient(135deg, rgba(241,234,216,0.62), transparent 45%)",
          backgroundSize: "100% 2rem, 100% 100%"
        }}
      />
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-4 border-b border-[#17234b]/10 pb-4">
          <span className="blueprint-label text-[#17234b]/45">Maya interview</span>
          <span className="font-mono text-xs font-semibold text-[#17234b]/45">
            {exchange.elapsed}
          </span>
        </div>

        <p className="relative mt-6 min-h-[4rem] font-card text-2xl font-bold leading-8 text-[#202227] sm:min-h-[4.5rem] sm:text-3xl sm:leading-9">
          <span className="invisible block" aria-hidden="true">
            {exchange.question}
          </span>
          <span className="absolute inset-0 block">
            {active ? (
              <TypeOut key={`${exchange.question}-q`} text={exchange.question} speed={22} />
            ) : (
              exchange.question
            )}
          </span>
        </p>

        <div className="mt-6 rounded-2xl border-l-4 border-[#3657b4]/35 bg-cream/45 px-4 py-3">
          <p className="blueprint-label text-[#17234b]/40">You said</p>
          <p className="mt-2 text-base font-medium leading-7 text-[#30333b]/75">
            &ldquo;{exchange.answer}&rdquo;
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex rounded-full border px-3.5 py-1.5 font-card text-sm font-bold ${meta.border} ${meta.ink} ${meta.wash}`}
          >
            {meta.label}
          </span>
          <span className="blueprint-label text-[#17234b]/42">{meta.eyebrow}</span>
          <span className="ml-auto hidden font-mono text-xs font-semibold text-[#17234b]/38 sm:inline">
            {exchange.note}
          </span>
        </div>

        <p className="relative mt-5 min-h-[4rem] font-card text-xl font-bold leading-8 text-[#202227] sm:min-h-[4rem] sm:text-2xl">
          <span className="invisible block" aria-hidden="true">
            {exchange.reply}
          </span>
          <span className="absolute inset-0 block">
            {active ? (
              <TypeOut key={`${exchange.reply}-r`} text={exchange.reply} speed={28} />
            ) : (
              exchange.reply
            )}
          </span>
        </p>
      </div>
    </article>
  );
}
