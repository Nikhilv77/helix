"use client";

import Image from "next/image";
import { Brain, MessageSquareText, TimerReset } from "lucide-react";
import { InterviewSignal, TrailgradMark } from "../blueprint-art";
import { Reveal } from "../reveal";

const questionSignals = [
  {
    icon: MessageSquareText,
    label: "Question fit",
    value: "From your resume"
  },
  {
    icon: Brain,
    label: "Follow-up depth",
    value: "Evidence first"
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
      className="relative z-10 overflow-hidden bg-blueprint px-5 pb-10 pt-20 sm:px-10 sm:py-28"
    >
      <InterviewSignal className="pointer-events-none absolute left-1/2 top-16 h-[26rem] w-[34rem] -translate-x-1/2 opacity-10 sm:h-[34rem] sm:w-[44rem]" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-32"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(241,234,216,0.08) 1px, transparent 1px), linear-gradient(180deg, rgba(241,234,216,0.08) 1px, transparent 1px)",
          backgroundPosition: "center top",
          backgroundSize: "11rem 11rem"
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#3657b4] to-transparent" />
      <div className="pointer-events-none absolute -left-24 top-28 h-72 w-72 rounded-full border border-cream/10" />
      <div className="pointer-events-none absolute -right-28 bottom-24 h-80 w-80 rounded-full border border-cream/10" />
      <QuestionPatterns />

      <div className="relative mx-auto grid w-full max-w-[78rem] gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
        <div className="max-w-2xl">
          <Reveal>
            <span className="inline-flex items-center gap-2.5 rounded-full border border-cream/20 bg-cream/5 px-3.5 py-1.5 backdrop-blur-sm">
              <TrailgradMark className="h-3.5 w-3.5 text-cream" />
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
              Practice the questions hiding in your resume.
            </h2>
          </Reveal>

          <Reveal delay={150}>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-cream/78 sm:text-xl">
              Maya turns every project, metric, and tool into the questions a real interviewer is
              likely to ask next.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-3 lg:max-w-xl">
            {questionSignals.map((signal, index) => {
              const Icon = signal.icon;
              return (
                <Reveal key={signal.label} delay={230 + index * 80}>
                  <div className="border-t border-cream/16 pt-5">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-cream/10 text-cream">
                      <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <p className="blueprint-label mt-4 text-cream/42">{signal.label}</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-cream">
                      {signal.value}
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>

        <Reveal delay={170}>
          <div className="relative mx-auto h-[17.5rem] w-full max-w-[46rem] sm:h-[31rem] lg:h-[36rem]">
            <div className="pointer-events-none absolute bottom-12 left-1/2 h-32 w-[19rem] -translate-x-1/2 rounded-full bg-[#5b7cdc] opacity-16 blur-2xl sm:bottom-6 sm:h-[26rem] sm:w-[38rem] sm:opacity-24 sm:blur-3xl" />
            <div className="pointer-events-none absolute bottom-20 left-1/2 hidden h-[20rem] w-[30rem] -translate-x-1/2 rounded-full bg-cream/10 blur-3xl sm:block" />
            <div className="pointer-events-none absolute left-4 top-12 h-24 w-36 rounded-2xl border border-cream/14 opacity-60" />
            <div className="pointer-events-none absolute right-6 top-20 h-20 w-32 rounded-2xl border border-cream/12 opacity-55" />
            <div className="pointer-events-none absolute bottom-14 left-1/2 h-px w-[82%] -translate-x-1/2 bg-cream/18" />
            <Image
              src="/images/marketing/maya-practice-laptop.webp"
              alt="Maya guiding interview practice questions on a laptop"
              fill
              sizes="(min-width: 1024px) 46rem, 92vw"
              quality={76}
              loading="lazy"
              decoding="async"
              className="origin-bottom scale-[1.38] object-contain object-bottom sm:scale-100"
              style={{
                filter: "drop-shadow(0 0 22px rgba(91,124,220,0.46))",
                maskImage: "linear-gradient(to bottom, black 0%, black 88%, transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, black 0%, black 88%, transparent 100%)"
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
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 text-cream">
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
