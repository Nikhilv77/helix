"use client";

import Image from "next/image";
import { Brain, MessageSquareText, TimerReset } from "lucide-react";
import { TrailgradMark } from "@/components/brand/blueprint-art";
import { Reveal } from "./visuals/reveal";

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
      className="marketing-theme-section relative z-10 overflow-hidden bg-blueprint px-5 pb-10 pt-16 sm:px-10 sm:py-24"
    >
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
              style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)" }}
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
