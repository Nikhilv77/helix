"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { InterviewSignal, TrailgradMark } from "../blueprint-art";
import { Counter, Reveal, TypeOut } from "../reveal";
import { exchanges } from "./data";

export function TheInterview() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const active = exchanges[index] ?? exchanges[0];
  const renderedExchangeIndexes = useMemo(() => {
    const previous = (index - 1 + exchanges.length) % exchanges.length;
    const next = (index + 1) % exchanges.length;
    return Array.from(new Set([previous, index, next]));
  }, [index]);

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
      className="marketing-theme-section relative z-10 overflow-hidden bg-blueprint px-5 py-20 sm:px-10 sm:py-28"
    >
      <InterviewSignal className="pointer-events-none absolute left-1/2 top-14 h-[26rem] w-[34rem] -translate-x-1/2 text-[color:var(--dm-accent-soft)] opacity-10 sm:h-[34rem] sm:w-[44rem]" />
      <div className="pointer-events-none absolute -left-28 top-20 h-72 w-72 rounded-full border border-cream/10" />
      <div className="pointer-events-none absolute -right-24 bottom-16 h-80 w-80 rounded-full border border-cream/10" />

      <div className="relative mx-auto flex w-full max-w-[76rem] flex-col items-center">
        <Reveal>
          <span className="theme-accent-pill inline-flex items-center gap-2.5 rounded-full px-3.5 py-1.5 sm:backdrop-blur-sm">
            <TrailgradMark className="h-3.5 w-3.5 text-[color:var(--dm-accent-soft)]" />
            <span className="blueprint-label whitespace-nowrap text-cream/80">Live round</span>
          </span>
        </Reveal>

        <Reveal delay={80}>
          <h2
            className="display-heading mt-6 max-w-4xl text-center text-cream"
            style={{ fontSize: "clamp(2.4rem, 5.6vw, 5rem)" }}
          >
            Then say it out loud.
          </h2>
        </Reveal>

        <Reveal delay={160}>
          <p className="mx-auto mt-7 max-w-2xl text-center text-lg leading-relaxed text-cream/76 sm:text-xl">
            The interview uses your finished chapters and resume details. Vague answers get
            follow-ups, loose points get clarified, and good answers move on.
          </p>
        </Reveal>

        <div className="mt-14 w-full">
          <div
            className="relative"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <Reveal delay={260}>
              <div className="relative min-h-[27rem] sm:min-h-[24rem]">
                {renderedExchangeIndexes.map((exchangeIndex) => {
                  const exchange = exchanges[exchangeIndex];
                  if (!exchange) return null;
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
            { value: 15, suffix: "", label: "Focused minutes" },
            { value: 2, suffix: "", label: "Follow-ups" },
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
  const answerText = `“${exchange.answer}”`;
  const answerDelay = Math.min(4200, exchange.question.length * 64 + 650);

  return (
    <article className="relative mx-auto w-full max-w-2xl text-left text-cream">
        <div className="relative mx-auto max-w-4xl border-y border-white/[0.08] py-8 sm:py-10">
          <div className="flex items-center justify-between gap-4">
            <p className="blueprint-label text-cream/48">Maya asks</p>
            <span className="font-mono text-xs text-cream/35">{exchange.elapsed}</span>
          </div>
          <p className="relative mt-5 min-h-[5.5rem] overflow-hidden text-[1.8rem] font-semibold leading-tight text-cream sm:text-[2.8rem]">
              <span className="invisible block" aria-hidden="true">
                {exchange.question}
              </span>
              <span className="absolute inset-0 block">
                {active ? (
                  <TypeOut key={`${exchange.question}-q`} text={exchange.question} speed={64} />
                ) : (
                  exchange.question
                )}
              </span>
          </p>
          <div className="mt-9 border-l-2 border-[#F26E01]/45 pl-5 sm:pl-7">
            <p className="blueprint-label text-cream/42">Your answer</p>
            <p className="relative mt-3 min-h-[5rem] overflow-hidden text-base leading-7 text-cream/62 sm:text-xl sm:leading-8">
            <span className="invisible block" aria-hidden="true">
              {answerText}
            </span>
            <span className="absolute inset-0 block">
              {active ? (
                <TypeOut
                  key={`${exchange.answer}-a`}
                  text={answerText}
                  speed={40}
                  delay={answerDelay}
                />
              ) : (
                answerText
              )}
            </span>
            </p>
          </div>
        </div>
    </article>
  );
}
