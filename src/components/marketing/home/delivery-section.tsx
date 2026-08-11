"use client";

import Image from "next/image";
import { ArrowRight, CheckCircle2, Target, TrendingUp } from "lucide-react";
import { InterviewSignal, TrailgradMark } from "../blueprint-art";
import { Reveal } from "../reveal";
import { PrimaryAction } from "./primary-action";

const reportRows = [
  { label: "Specificity", score: 82, note: "Numbers, scope, and tradeoffs are clear." },
  { label: "Ownership", score: 76, note: "Your role is visible, but can land faster." },
  { label: "Outcome", score: 68, note: "Good finish. Needs one sharper metric." },
  { label: "Structure", score: 91, note: "Answer flow is easy to follow." }
] as const;

const evidenceBars = [38, 54, 46, 72, 64, 86, 78, 92, 88, 96] as const;

export function Delivery() {
  return (
    <section
      id="report"
      className="relative z-10 overflow-hidden bg-blueprint px-5 py-20 sm:px-10 sm:py-28"
    >
      <InterviewSignal className="pointer-events-none absolute left-1/2 top-16 h-[26rem] w-[34rem] -translate-x-1/2 opacity-10 sm:h-[34rem] sm:w-[44rem]" />
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
      <div className="pointer-events-none absolute -left-28 top-28 hidden h-72 w-72 rounded-full border border-cream/10 sm:block" />
      <div className="pointer-events-none absolute -right-24 bottom-28 hidden h-80 w-80 rounded-full border border-cream/10 sm:block" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#3657b4] to-transparent" />

      <div className="relative mx-auto w-full max-w-[78rem]">
        <div className="grid gap-14 lg:grid-cols-[1.06fr_0.94fr] lg:items-center">
          <div className="lg:order-2 lg:ml-auto">
            <Reveal>
              <span className="inline-flex items-center gap-2.5 rounded-full border border-cream/20 bg-cream/5 px-3.5 py-1.5 sm:backdrop-blur-sm">
                <TrailgradMark className="h-3.5 w-3.5 text-cream" />
                <span className="blueprint-label whitespace-nowrap text-cream/80">
                  After the round
                </span>
              </span>
            </Reveal>
            <Reveal delay={80}>
              <h2
                className="display-heading mt-6 max-w-xl text-cream"
                style={{ fontSize: "clamp(2.4rem, 5.6vw, 5rem)" }}
              >
                Reports that show what changed.
              </h2>
            </Reveal>
            <Reveal delay={140}>
              <p className="mt-8 max-w-xl text-lg leading-relaxed text-cream/80">
                Every round turns into a clean signal: what you proved, where your answer drifted,
                and the one skill to sharpen before the next interview.
              </p>
            </Reveal>
            <Reveal delay={200}>
              <p className="mt-8 border-l-2 border-cream/25 pl-5 text-base leading-relaxed text-cream/60">
                No heavy dashboard. Just a readable verdict that makes the next practice round
                obvious.
              </p>
            </Reveal>
          </div>

          <Reveal delay={120} className="lg:order-1">
            <div className="relative min-h-[34rem] [contain:layout_paint]">
              <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-px bg-cream/14" />
              <div className="pointer-events-none absolute bottom-8 left-10 top-8 w-px bg-cream/14" />
              <div className="pointer-events-none absolute right-6 top-0 h-40 w-40 rounded-full border border-cream/10" />
              <div className="pointer-events-none absolute -left-10 bottom-6 h-28 w-28 rounded-full border border-cream/10" />

              <div className="relative grid gap-10 md:grid-cols-[13rem_1fr] md:items-start">
                <Reveal delay={220}>
                  <div className="relative mx-auto grid h-52 w-52 place-items-center">
                    <svg
                      viewBox="0 0 140 140"
                      className="absolute inset-0 h-full w-full -rotate-90"
                    >
                      <circle
                        cx="70"
                        cy="70"
                        r="55"
                        fill="none"
                        stroke="rgba(241,234,216,0.12)"
                        strokeWidth="8"
                      />
                      <circle
                        className="report-score-ring"
                        cx="70"
                        cy="70"
                        r="55"
                        fill="none"
                        stroke="#f1ead8"
                        strokeLinecap="round"
                        strokeWidth="8"
                        pathLength="100"
                        strokeDasharray="82 100"
                      />
                    </svg>
                    <div className="text-center">
                      <p className="wordmark text-6xl text-cream">82</p>
                      <p className="blueprint-label mt-1 text-cream/45">Evidence</p>
                    </div>
                  </div>
                </Reveal>

                <div className="relative pt-3">
                  <Reveal delay={260}>
                    <div className="flex items-center justify-between gap-4 border-b border-cream/18 pb-4">
                      <span className="blueprint-label text-cream/55">Round verdict</span>
                      <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-cream/70">
                        <span className="h-2 w-2 rounded-full bg-[#7ee0bd] shadow-[0_0_16px_rgba(126,224,189,0.72)]" />
                        Improved
                      </span>
                    </div>
                  </Reveal>

                  <Reveal delay={330}>
                    <div className="mt-8 flex h-28 items-end gap-2 border-b border-l border-cream/14 px-3 pb-3">
                      {evidenceBars.map((height, index) => (
                        <span
                          key={`${height}-${index}`}
                          className="report-evidence-bar block w-full rounded-t-sm bg-cream/70"
                          style={{
                            height: `${height}px`,
                            animationDelay: `${index * 90}ms`
                          }}
                        />
                      ))}
                    </div>
                  </Reveal>

                  <div className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2">
                    {reportRows.map((row, index) => (
                      <Reveal key={row.label} delay={420 + index * 100}>
                        <div className="border-t border-cream/14 pt-4">
                          <div className="flex items-baseline justify-between gap-4">
                            <p className="text-xl font-semibold tracking-tight text-cream">
                              {row.label}
                            </p>
                            <p className="font-mono text-xl font-semibold text-cream/78">
                              {row.score}
                            </p>
                          </div>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-cream/10">
                            <div
                              className="report-row-fill h-full rounded-full bg-cream"
                              style={{
                                width: `${row.score}%`,
                                animationDelay: `${index * 80}ms`
                              }}
                            />
                          </div>
                          <p className="mt-2 text-base leading-6 text-cream/58">{row.note}</p>
                        </div>
                      </Reveal>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative mt-10 grid gap-5 border-t border-cream/18 pt-6 sm:grid-cols-3">
                {[
                  { icon: TrendingUp, label: "Trend", value: "+14%" },
                  { icon: Target, label: "Next focus", value: "Outcome" },
                  { icon: CheckCircle2, label: "Ready", value: "Mock loop" }
                ].map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <Reveal key={item.label} delay={820 + index * 90}>
                      <div className="flex items-center gap-3">
                        <span className="shrink-0 text-cream">
                          <Icon size={34} strokeWidth={1.8} aria-hidden="true" />
                        </span>
                        <div>
                          <p className="blueprint-label text-[0.74rem] text-cream/40">{item.label}</p>
                          <p className="text-base font-semibold text-cream">{item.value}</p>
                        </div>
                      </div>
                    </Reveal>
                  );
                })}
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
    <div id="flow" className="relative scroll-mt-28 pt-24 sm:pt-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-12 h-px bg-gradient-to-r from-transparent via-cream/35 to-transparent"
      />
      <div className="pointer-events-none absolute left-1/2 top-10 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full border border-cream/10" />
      <div className="pointer-events-none absolute right-0 top-24 hidden h-52 w-52 rounded-full border border-cream/10 lg:block" />

      <div className="relative grid min-h-[34rem] items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative z-10 max-w-2xl">
          <Reveal>
            <span className="inline-flex items-center gap-2.5 rounded-full border border-cream/20 bg-cream/5 px-3.5 py-1.5 sm:backdrop-blur-sm">
              <TrailgradMark className="h-3.5 w-3.5 text-cream" />
              <span className="blueprint-label whitespace-nowrap text-cream/80">
                Ready when you are
              </span>
            </span>
          </Reveal>

          <Reveal delay={80}>
            <h2
              className="display-heading mt-6 max-w-3xl text-cream"
              style={{ fontSize: "clamp(2.5rem, 6vw, 5.2rem)" }}
            >
              Walk in with proof, not hope.
            </h2>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-cream/76 sm:text-xl">
              Upload your resume, build the trail, and let Maya pressure-test the answers before
              the real interview does.
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
              <PrimaryAction className="inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-cream px-7 text-sm font-bold tracking-wide text-[#13234f] shadow-[0_18px_40px_-22px_rgba(3,10,31,0.78)] transition hover:-translate-y-0.5 hover:bg-cream-soft">
                Start free
                <ArrowRight size={18} aria-hidden="true" />
              </PrimaryAction>
              <p className="blueprint-label text-cream/45">
                No card required · Private workspace
              </p>
            </div>
          </Reveal>
        </div>

        <Reveal delay={180}>
          <div className="relative mx-auto h-[30rem] w-full max-w-[32rem] lg:h-[38rem] lg:max-w-[40rem]">
            <div className="pointer-events-none absolute bottom-8 left-1/2 hidden h-[26rem] w-[25rem] -translate-x-1/2 rounded-full bg-[#4f70d1] opacity-35 blur-3xl sm:block lg:h-[34rem] lg:w-[31rem]" />
            <div className="pointer-events-none absolute bottom-20 left-1/2 hidden h-[18rem] w-[20rem] -translate-x-1/2 rounded-full bg-[#4568ce] opacity-42 blur-2xl sm:block lg:h-[26rem] lg:w-[28rem]" />
            <div className="pointer-events-none absolute left-1/2 top-16 hidden h-48 w-64 -translate-x-1/2 rounded-full bg-cream/12 blur-3xl sm:block" />
            <div className="pointer-events-none absolute left-6 top-20 h-24 w-36 rounded-2xl border border-cream/16 opacity-60" />
            <div className="pointer-events-none absolute right-4 top-36 h-20 w-32 rounded-2xl border border-cream/14 opacity-50" />
            <div className="pointer-events-none absolute bottom-16 left-0 h-20 w-40 rounded-2xl border border-cream/12 opacity-45" />
            <InterviewSignal className="pointer-events-none absolute left-1/2 top-1/2 h-[24rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 opacity-18" />
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
                WebkitMaskImage:
                  "linear-gradient(to bottom, black 0%, black 82%, transparent 100%)"
              }}
            />
          </div>
        </Reveal>
      </div>
    </div>
  );
}
