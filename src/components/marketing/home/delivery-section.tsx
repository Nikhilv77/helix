"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { TrailgradMark } from "@/components/brand/blueprint-art";
import { Reveal } from "./visuals/reveal";
import { PrimaryAction } from "./primary-action";

const reportRows = [
  { label: "Details", score: 82, note: "Numbers, scope, and tradeoffs are clear." },
  { label: "Your role", score: 76, note: "Your role is clear, but say it sooner." },
  { label: "Result", score: 68, note: "Good finish. Add one clearer metric." },
  { label: "Flow", score: 91, note: "Answer flow is easy to follow." }
] as const;

export function Delivery() {
  return (
    <section
      id="report"
      className="marketing-theme-section relative z-10 overflow-hidden bg-blueprint px-5 py-16 sm:px-10 sm:py-24"
    >
      <div className="relative mx-auto w-full max-w-[78rem]">
        <div className="grid gap-14 lg:grid-cols-[1.06fr_0.94fr] lg:items-center">
          <div className="lg:order-2 lg:ml-auto">
            <Reveal>
              <span className="theme-accent-pill inline-flex items-center gap-2.5 rounded-full px-3.5 py-1.5 sm:backdrop-blur-sm">
                <TrailgradMark className="h-3.5 w-3.5 text-[color:var(--dm-accent-soft)]" />
                <span className="blueprint-label whitespace-nowrap text-cream/80">
                  After the round
                </span>
              </span>
            </Reveal>
            <Reveal delay={80}>
              <h2
                className="display-heading mt-6 max-w-xl text-cream"
                style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)" }}
              >
                Reports that show what changed.
              </h2>
            </Reveal>
            <Reveal delay={140}>
              <p className="mt-8 max-w-xl text-lg leading-relaxed text-cream/80">
                Every round turns into a clean recap: what went well, where your answer got fuzzy,
                and the one thing to work on before the next interview.
              </p>
            </Reveal>
            <Reveal delay={200}>
              <p className="mt-8 border-l-2 border-cream/25 pl-5 text-base leading-relaxed text-cream/60">
                No heavy screens. Just a readable note that makes the next practice round obvious.
              </p>
            </Reveal>
          </div>

          <Reveal delay={120} className="lg:order-1">
            <div className="public-glass overflow-hidden rounded-[1.5rem]">
              <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4 sm:px-7">
                <span className="blueprint-label text-cream/48">Round recap</span>
                <span className="font-mono text-xs text-cream/34">Interview 06</span>
              </div>

              <div className="grid border-b border-white/[0.07] sm:grid-cols-3">
                {[
                  { label: "Overall", value: "82", suffix: "/ 100" },
                  { label: "Trend", value: "+14%", suffix: "this month" },
                  { label: "Next focus", value: "Outcome", suffix: "add evidence" }
                ].map((item, index) => (
                  <div
                    key={item.label}
                    className={`px-5 py-5 sm:px-7 ${index > 0 ? "border-t border-white/[0.07] sm:border-l sm:border-t-0" : ""}`}
                  >
                    <p className="blueprint-label text-[0.68rem] text-cream/36">{item.label}</p>
                    <div className="mt-2 flex items-baseline gap-2">
                      <p className="text-2xl font-semibold tracking-tight text-cream">
                        {item.value}
                      </p>
                      <p className="text-xs text-cream/35">{item.suffix}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-5 py-2 sm:px-7">
                {reportRows.map((row, index) => (
                  <Reveal key={row.label} delay={280 + index * 80}>
                    <div
                      className={`grid gap-2 py-5 sm:grid-cols-[7rem_3.5rem_1fr] sm:items-start sm:gap-5 ${index > 0 ? "border-t border-white/[0.065]" : ""}`}
                    >
                      <p className="text-sm font-semibold text-cream/74">{row.label}</p>
                      <p className="font-mono text-sm font-semibold text-cream">{row.score}</p>
                      <p className="text-sm leading-6 text-cream/48">{row.note}</p>
                    </div>
                  </Reveal>
                ))}
              </div>

              <div className="flex items-center gap-2 border-t border-white/[0.07] px-5 py-4 sm:px-7">
                <span className="h-1.5 w-1.5 rounded-full bg-[#F26E01]" />
                <p className="text-xs font-medium text-cream/48">Ready for the next round</p>
              </div>
            </div>
          </Reveal>
        </div>

        <FinalCta />
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <div id="flow" className="relative scroll-mt-28 pt-20 sm:pt-24">
      <div className="relative grid min-h-[30rem] items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative z-10 max-w-2xl">
          <Reveal>
            <span className="theme-accent-pill inline-flex items-center gap-2.5 rounded-full px-3.5 py-1.5 sm:backdrop-blur-sm">
              <TrailgradMark className="h-3.5 w-3.5 text-[color:var(--dm-accent-soft)]" />
              <span className="blueprint-label whitespace-nowrap text-cream/80">
                Ready when you are
              </span>
            </span>
          </Reveal>

          <Reveal delay={80}>
            <h2
              className="display-heading mt-6 max-w-3xl text-cream"
              style={{ fontSize: "clamp(2.1rem, 4.2vw, 3.75rem)" }}
            >
              Walk in ready, not guessing.
            </h2>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-cream/76 sm:text-xl">
              Upload your resume, build the trail, and practice the answers before the real
              interview asks.
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
              <PrimaryAction className="inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-cream px-7 text-sm font-bold tracking-wide text-[#13234f] shadow-[0_18px_40px_-22px_rgba(3,10,31,0.78)] transition hover:-translate-y-0.5 hover:bg-cream-soft">
                Start free
                <ArrowRight size={18} aria-hidden="true" />
              </PrimaryAction>
              <p className="blueprint-label text-cream/45">No card required · Private workspace</p>
            </div>
          </Reveal>
        </div>

        <Reveal delay={180}>
          <div className="relative mx-auto h-[30rem] w-full max-w-[32rem] lg:h-[38rem] lg:max-w-[40rem]">
            <Image
              src="/images/marketing/maya-professional-optimized.webp"
              alt="Maya, a professional AI interview coach"
              fill
              sizes="(min-width: 1024px) 40rem, 90vw"
              quality={72}
              loading="lazy"
              decoding="async"
              className="object-contain object-bottom sm:drop-shadow-[0_0_18px_rgba(91,124,220,0.42)]"
              style={{
                maskImage: "linear-gradient(to bottom, black 0%, black 82%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 82%, transparent 100%)"
              }}
            />
          </div>
        </Reveal>
      </div>
    </div>
  );
}
