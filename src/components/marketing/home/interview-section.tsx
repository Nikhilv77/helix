"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { InterviewSignal, TrailgradMark } from "../blueprint-art";
import { Counter, Reveal, TypeOut } from "../reveal";
import { exchanges } from "./data";

const roundRules = [
  ["Probe", "A vague answer gets one specific follow-up."],
  ["Challenge", "Unsupported claims are tested against the details."],
  ["Move", "Once the signal is clear, the round keeps moving."]
] as const;

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
      className="relative z-10 overflow-hidden bg-blueprint px-5 py-20 sm:px-10 sm:py-28"
    >
      <InterviewSignal className="pointer-events-none absolute left-1/2 top-14 h-[26rem] w-[34rem] -translate-x-1/2 opacity-10 sm:h-[34rem] sm:w-[44rem]" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.18] sm:opacity-30"
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
          <span className="inline-flex items-center gap-2.5 rounded-full border border-cream/20 bg-cream/5 px-3.5 py-1.5 sm:backdrop-blur-sm">
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
                  className="rounded-2xl border border-cream/18 bg-cream/[0.065] p-5 sm:shadow-[0_22px_70px_-48px_rgba(3,10,31,0.72)]"
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
              <div className="relative min-h-[33rem] sm:min-h-[29rem]">
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
  const answerText = `“${exchange.answer}”`;
  const answerDelay = Math.min(4200, exchange.question.length * 64 + 650);

  return (
    <article className="relative mx-auto w-full max-w-2xl text-left text-cream">
      <div className="relative overflow-hidden rounded-[1.55rem] bg-cream/[0.035] p-4  sm:rounded-[2rem] sm:p-7 sm:backdrop-blur-sm">
        <div
          aria-hidden="true"
          className="absolute bottom-0 left-0 hidden h-56 w-56 rounded-full bg-cream/[0.06] blur-2xl sm:block"
        />

        <div className="relative z-10 flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 rounded-full bg-cream/[0.07] px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-[#7ee0bd] shadow-[0_0_18px_rgba(126,224,189,0.78)]" />
            <span className="blueprint-label text-cream/54">Live with Maya</span>
          </span>
          <span className="font-mono text-xs font-semibold text-cream/48">
            {exchange.elapsed}
          </span>
        </div>

        <div className="relative z-10 mt-6 grid gap-4 sm:mt-8 sm:grid-cols-[7.25rem_1fr] sm:items-center sm:gap-5">
          <div className="relative mx-auto h-24 w-24 overflow-hidden rounded-full border border-cream/35 bg-[linear-gradient(145deg,rgba(241,234,216,0.14),rgba(255,255,255,0.035))] shadow-[0_22px_54px_-34px_rgba(3,10,31,0.95),inset_0_1px_0_rgba(241,234,216,0.18)] sm:h-32 sm:w-32">
            <div
              aria-hidden="true"
              className="absolute inset-2 rounded-full bg-blueprint/20"
            />
            <Image
              src="/images/marketing/maya-face-interviewer.png"
              alt="Maya"
              fill
              sizes="128px"
              className="object-contain drop-shadow-[0_16px_24px_rgba(3,10,31,0.24)]"
              priority={false}
            />
          </div>

          <div className="rounded-[1.35rem] border border-cream/18 bg-cream/[0.035] px-4 py-4 sm:rounded-[1.65rem] sm:px-6 sm:py-6 sm:backdrop-blur-md">
            <p className="blueprint-label text-cream/50">Maya asks</p>
            <p className="relative mt-2 min-h-[6.25rem] overflow-hidden text-[1.32rem] font-semibold leading-[1.16] sm:mt-3 sm:min-h-[4.5rem] sm:text-[2rem] sm:leading-tight">
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
          </div>
        </div>

        <div className="relative z-10 mt-4 rounded-[1.25rem] bg-cream/[0.075] px-4 py-4 sm:mt-5 sm:rounded-[1.5rem] sm:px-5">
          <p className="blueprint-label text-cream/42">Your answer</p>
          <p className="relative mt-2 min-h-[5.75rem] overflow-hidden text-[14px] font-medium leading-6 text-cream/76 sm:min-h-[3.5rem] sm:text-base sm:leading-7">
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
