"use client";

import { Fragment, useRef } from "react";
import type { CSSProperties } from "react";
import { AudioLines } from "lucide-react";
import { Reveal, useRotator, useViewportPresence } from "./visuals/reveal";

const rounds = [
  [
    { speaker: "Tutor", at: "00:03", line: "Why would you use Redis in this system?" },
    { speaker: "You", at: "00:09", line: "To cache session data and take read load off Postgres." },
    { speaker: "Tutor", at: "00:14", line: "What happens to sign-in when Redis drops at peak?" }
  ],
  [
    { speaker: "Tutor", at: "01:22", line: "How did you keep the payment API idempotent?" },
    { speaker: "You", at: "01:28", line: "Every request carried a key we stored before charging." },
    {
      speaker: "Tutor",
      at: "01:35",
      line: "Stored where — and what if that write lands but the charge doesn’t?"
    }
  ],
  [
    { speaker: "Tutor", at: "03:04", line: "You said the migration cut latency forty percent." },
    {
      speaker: "You",
      at: "03:10",
      line: "Right, the dashboards were clearly better after rollout."
    },
    { speaker: "Tutor", at: "03:16", line: "At p50 or p99? And what else shipped that week?" }
  ],
  [
    {
      speaker: "Tutor",
      at: "05:41",
      line: "Walk me through the retry storm that took the queue down."
    },
    { speaker: "You", at: "05:49", line: "We added exponential backoff and it stopped happening." },
    { speaker: "Tutor", at: "05:56", line: "Backoff alone, or did you cap depth as well?" }
  ],
  [
    { speaker: "Tutor", at: "08:12", line: "Why Kafka here rather than a job queue?" },
    {
      speaker: "You",
      at: "08:18",
      line: "We needed durability, and the team already knew it well."
    },
    { speaker: "Tutor", at: "08:25", line: "Which of those two actually made the decision?" }
  ]
] as const;

const HOLD_MS = 3800;
const EXIT_MS = 1000;
const TURN_STEP = 340;
const WORD_STEP = "40ms";
const WAVE_COUNT = 36;

function waveHeights(count: number): number[] {
  return Array.from({ length: count }, (_, index) => {
    const raw =
      30 + Math.abs(Math.sin(index * 0.62 + 0.8)) * 46 + Math.abs(Math.cos(index * 0.29)) * 22;
    return Math.round(raw * 10) / 10;
  });
}

const WAVE_HEIGHTS = waveHeights(WAVE_COUNT);

function TranscriptWave({ phase, style }: { phase?: "in" | "out"; style: CSSProperties }) {
  return (
    <div
      aria-hidden="true"
      className="stagger-fade mt-4 flex h-7 w-full items-end justify-between sm:h-9"
      data-phase={phase}
      style={style}
    >
      {WAVE_HEIGHTS.map((height, index) => (
        <span
          key={index}
          className="wave-bar w-[3px] shrink-0 rounded-full bg-[color:var(--dm-accent-soft)] opacity-75 sm:w-[2px] sm:opacity-100"
          style={{ height: `${height}%`, animationDelay: `${index * 52}ms` }}
        />
      ))}
    </div>
  );
}

function SpeakerMark({
  speaker,
  phase,
  style
}: {
  speaker: "Tutor" | "You";
  phase?: "in" | "out";
  style: CSSProperties;
}) {
  if (speaker === "Tutor") {
    return (
      <span
        className="stagger-fade accent-tint grid h-10 w-10 shrink-0 place-items-center rounded-full text-[color:var(--dm-accent-soft)]"
        data-phase={phase}
        style={style}
      >
        <AudioLines size={17} strokeWidth={2} aria-hidden="true" />
      </span>
    );
  }

  return (
    <span
      className="stagger-fade grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cream/[0.07] text-[0.7rem] font-medium text-cream/60"
      data-phase={phase}
      style={style}
    >
      You
    </span>
  );
}

export function Pushback() {
  const cardRef = useRef<HTMLDivElement>(null);
  const inView = useViewportPresence(cardRef);
  const { index, phase } = useRotator({
    length: rounds.length,
    holdMs: HOLD_MS,
    exitMs: EXIT_MS,
    enabled: inView
  });
  const round = rounds[index] ?? rounds[0]!;
  const animate = inView;

  return (
    <section
      id="interview"
      className="marketing-deferred-section marketing-theme-section relative z-10 overflow-hidden px-5 py-20 sm:px-10 sm:py-28"
    >
      <div className="relative mx-auto flex w-full max-w-[64rem] flex-col items-center">
        <Reveal>
          <h2 className="marketing-section-title display-heading pushback-heading max-w-3xl text-center text-cream">
            Practice the follow-up, too.
          </h2>
        </Reveal>

        <Reveal delay={90}>
          <p className="marketing-lede mx-auto mt-5 max-w-xl text-center text-cream/68 sm:mt-6">
            Real interviews keep going. Your tutor listens to your answer, asks the next question,
            and helps you make your thinking clear.
          </p>
        </Reveal>

        <Reveal delay={230} className="w-full">
          <div className="relative mx-auto mt-11 w-full max-w-[52rem] sm:mt-14">
            <div
              ref={cardRef}
              data-running={inView}
              className="marketing-animation-scope public-glass relative grid min-h-[24rem] w-full overflow-hidden rounded-[1.5rem] px-5 py-4 sm:min-h-[22rem] sm:px-9 sm:py-6"
            >
              <div className="col-start-1 row-start-1">
                {round.map((turn, turnIndex) => {
                  const base = { "--base": `${turnIndex * TURN_STEP}ms` } as CSSProperties;
                  const words = turn.line.split(" ");
                  const tutor = turn.speaker === "Tutor";

                  return (
                    <div
                      key={turn.at}
                      className={[
                        "flex gap-4 py-6 sm:gap-5",
                        turnIndex > 0 ? "border-t border-white/[0.06]" : ""
                      ].join(" ")}
                    >
                      <SpeakerMark
                        speaker={turn.speaker}
                        phase={animate ? phase : undefined}
                        style={base}
                      />

                      <div className="min-w-0 flex-1">
                        <div
                          className="stagger-fade flex items-baseline gap-3"
                          data-phase={animate ? phase : undefined}
                          style={base}
                        >
                          <p className="text-[0.95rem] font-medium text-cream">{turn.speaker}</p>
                          <span className="font-mono text-xs text-cream/35">{turn.at}</span>
                        </div>

                        {tutor ? (
                          <p
                            className={[
                              "stagger-line mt-2 text-[1.0625rem] leading-[1.45] sm:text-xl sm:leading-snug",
                              turnIndex > 0 ? "font-semibold text-cream" : "text-cream/85"
                            ].join(" ")}
                            data-phase={animate ? phase : undefined}
                            style={
                              {
                                "--base": `${turnIndex * TURN_STEP + 140}ms`,
                                "--step": WORD_STEP
                              } as CSSProperties
                            }
                          >
                            {words.map((word, wordIndex) => (
                              <Fragment key={`${word}-${wordIndex}`}>
                                {wordIndex > 0 ? " " : null}
                                <span
                                  className="stagger-word"
                                  style={{ "--i": wordIndex } as CSSProperties}
                                >
                                  {word}
                                </span>
                              </Fragment>
                            ))}
                          </p>
                        ) : (
                          <p
                            className="stagger-fade mt-2 text-[1.0625rem] leading-[1.45] text-cream/82 sm:text-xl sm:leading-snug"
                            data-phase={animate ? phase : undefined}
                            style={
                              { "--base": `${turnIndex * TURN_STEP + 140}ms` } as CSSProperties
                            }
                          >
                            {turn.line}
                          </p>
                        )}

                        {turnIndex === 0 ? (
                          <TranscriptWave
                            phase={animate ? phase : undefined}
                            style={
                              { "--base": `${turnIndex * TURN_STEP + 420}ms` } as CSSProperties
                            }
                          />
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
