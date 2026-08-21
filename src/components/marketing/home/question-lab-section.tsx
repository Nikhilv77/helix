"use client";

import Image from "next/image";
import { Brain, MessageSquareText, TimerReset } from "lucide-react";
import { InterviewSignal, TrailgradMark } from "../blueprint-art";
import { Reveal } from "../reveal";

const questionSignals = [
  {
    icon: MessageSquareText,
    label: "Question match",
    value: "From your resume"
  },
  {
    icon: Brain,
    label: "Better follow-ups",
    value: "Details first"
  },
  {
    icon: TimerReset,
    label: "Round pace",
    value: "No rambling"
  }
] as const;

export function QuestionLab() {
  return (
    <section
      id="questions"
      className="marketing-theme-section relative z-10 overflow-hidden bg-blueprint px-5 pb-10 pt-20 sm:px-10 sm:py-28"
    >
      <InterviewSignal className="pointer-events-none absolute left-1/2 top-16 h-[26rem] w-[34rem] -translate-x-1/2 text-[color:var(--dm-accent-soft)] opacity-10 sm:h-[34rem] sm:w-[44rem]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#101113] to-transparent" />
      <div className="pointer-events-none absolute -left-24 top-28 h-72 w-72 rounded-full border border-cream/10" />
      <div className="pointer-events-none absolute -right-28 bottom-24 h-80 w-80 rounded-full border border-cream/10" />
      <QuestionPatterns />

      <div className="relative mx-auto grid w-full max-w-[78rem] gap-5 sm:gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-12">
        <div className="max-w-2xl lg:order-2 lg:ml-auto">
          <Reveal>
            <span className="theme-accent-pill inline-flex items-center gap-2.5 rounded-full px-3.5 py-1.5 sm:backdrop-blur-sm">
              <TrailgradMark className="h-3.5 w-3.5 text-[color:var(--dm-accent-soft)]" />
              <span className="blueprint-label whitespace-nowrap text-cream/80">
                Maya question lab
              </span>
            </span>
          </Reveal>

          <Reveal delay={80}>
            <h2
              className="display-heading mt-6 max-w-3xl text-cream"
              style={{ fontSize: "clamp(2.4rem, 5.6vw, 5rem)" }}
            >
              Practice resume interview questions.
            </h2>
          </Reveal>

          <Reveal delay={150}>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-cream/78 sm:text-xl">
              Maya turns every project, metric, and tool into the questions a real interviewer is
              likely to ask next.
            </p>
          </Reveal>

          <div className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-3 lg:max-w-xl">
            {questionSignals.map((signal, index) => {
              const Icon = signal.icon;
              return (
                <Reveal key={signal.label} delay={230 + index * 80}>
                  <div className="border-t border-cream/16 pt-5">
                    <span className="block text-cream">
                      <Icon size={32} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <p className="mt-4 font-mono text-[0.9rem] font-semibold uppercase tracking-[0.13em] text-cream/58">
                      {signal.label}
                    </p>
                    <p className="mt-2 text-base font-semibold leading-6 text-cream">
                      {signal.value}
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>

        <Reveal delay={170} className="-mt-5 sm:mt-0 lg:order-1">
          <div className="relative mx-auto h-[18rem] w-[calc(100%-1.5rem)] max-w-[44rem] sm:h-[29rem] sm:w-full lg:h-[32rem] lg:max-w-[42rem]">
            <div className="pointer-events-none absolute left-2 top-10 h-20 w-32 rounded-2xl border border-cream/18 opacity-70 sm:left-4 sm:h-24 sm:w-36" />
            <div className="pointer-events-none absolute right-4 top-16 h-16 w-28 rounded-2xl border border-cream/14 opacity-60 sm:right-6 sm:h-20 sm:w-32" />
            <div className="pointer-events-none absolute bottom-12 left-1/2 h-px w-[74%] -translate-x-1/2 bg-cream/16" />
            <Image
              src="/images/marketing/maya-question-laptop-optimized.png"
              alt="Maya guiding interview practice questions on a laptop"
              fill
              sizes="(max-width: 640px) 96vw, (max-width: 1024px) 56vw, 42rem"
              quality={76}
              loading="lazy"
              decoding="async"
              className="relative z-10 origin-bottom scale-[1.08] object-contain object-bottom sm:scale-100"
              style={{
                maskImage:
                  "linear-gradient(to bottom, black 0%, black 78%, rgba(0,0,0,0.86) 88%, transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, black 0%, black 78%, rgba(0,0,0,0.86) 88%, transparent 100%)"
              }}
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function QuestionPatterns() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden text-cream sm:block">
      <svg
        className="absolute left-[7%] top-[18%] h-28 w-44 opacity-24 sm:h-36 sm:w-56"
        viewBox="0 0 230 150"
        fill="none"
      >
        <rect
          x="18"
          y="24"
          width="160"
          height="68"
          rx="14"
          stroke="currentColor"
          strokeOpacity="0.55"
        />
        <circle cx="42" cy="48" r="5" fill="currentColor" fillOpacity="0.38" />
        <path
          d="M61 45h78M61 64h104"
          stroke="currentColor"
          strokeLinecap="round"
          strokeOpacity="0.38"
        />
        <path
          d="M28 116h178"
          stroke="currentColor"
          strokeLinecap="round"
          strokeDasharray="7 12"
          strokeOpacity="0.25"
        />
      </svg>

      <svg
        className="absolute bottom-[14%] right-[7%] h-32 w-52 opacity-26 sm:h-44 sm:w-72"
        viewBox="0 0 280 180"
        fill="none"
      >
        <path d="M18 92h24m196 0h24" stroke="currentColor" strokeOpacity="0.28" />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((item) => (
          <line
            key={item}
            x1={64 + item * 16}
            x2={64 + item * 16}
            y1={92 - ((item % 4) + 2) * 8}
            y2={92 + ((item % 4) + 2) * 8}
            stroke="currentColor"
            strokeLinecap="round"
            strokeOpacity="0.38"
            strokeWidth="3"
          />
        ))}
        <circle cx="140" cy="92" r="74" stroke="currentColor" strokeOpacity="0.18" />
      </svg>
    </div>
  );
}
