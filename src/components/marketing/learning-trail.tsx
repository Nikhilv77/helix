"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Boxes, ClipboardCheck, Gauge, LayoutGrid, SquareCode, Trophy } from "lucide-react";

/**
 * The six stages every trail runs through, whatever role you are preparing
 * for. Deliberately named after what the stage *does* rather than after a
 * stack — an earlier version listed the frontend roadmap's session titles,
 * which read as though the product only served frontend candidates.
 *
 * Each carries its own accent so the panel reads as a set of distinct steps
 * rather than one flat blue field. The hues are the note-card and pin colours
 * already used by the feature board, spread across the spectrum.
 */
const stages: Array<{ title: string; detail: string; icon: LucideIcon; accent: string }> = [
  {
    title: "Foundations",
    detail: "Patterns and problem solving, warm-ups before the hard ones.",
    icon: LayoutGrid,
    accent: "#9fc7ff"
  },
  {
    title: "Core depth",
    detail: "The language and framework questions your role actually gets.",
    icon: SquareCode,
    accent: "#8be6bd"
  },
  {
    title: "Applied build",
    detail: "Real tasks under time, the way the round runs them.",
    icon: Boxes,
    accent: "#f4c65a"
  },
  {
    title: "Quality & scale",
    detail: "Performance, reliability and the tradeoffs they probe.",
    icon: Gauge,
    accent: "#f0a3a3"
  },
  {
    title: "Your evidence",
    detail: "Deep dives on what you shipped, with pushback.",
    icon: ClipboardCheck,
    accent: "#c3b1f0"
  },
  {
    title: "The full loop",
    detail: "One continuous mock, scored end to end.",
    icon: Trophy,
    accent: "#7dd3c0"
  }
];

const roles = ["Backend", "Frontend", "Full-stack", "Data", "AI / ML", "Product"];

const STEP_MS = 2200;

/**
 * A trail you watch walk itself: the stages light in sequence, each in its own
 * accent, and the role chips and header counter follow the same beat. One
 * interval drives all of it, so nothing drifts out of phase, and it stops
 * entirely for reduced-motion users rather than animating at them.
 *
 * The whole thing sits on the same near-black panel the feature board uses for
 * its console blocks, which is what keeps this section from reading as another
 * flat sheet of blueprint blue.
 */
export function LearningTrail() {
  const [active, setActive] = useState(0);
  const [animate, setAnimate] = useState(true);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setAnimate(!query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!animate) return;
    const timer = window.setInterval(
      () => setActive((current) => (current + 1) % stages.length),
      STEP_MS
    );
    return () => window.clearInterval(timer);
  }, [animate]);

  const current = stages[active] ?? stages[0]!;

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-cream/15 bg-[#0f1729] shadow-[0_40px_120px_rgba(9,21,60,0.5)] sm:rounded-[2rem]">
      {/* Console chrome, matching the code blocks on the feature board. */}
      <div className="flex items-center justify-between gap-4 border-b border-cream/[0.07] bg-cream/[0.02] px-5 py-3.5 sm:px-7">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-cream/35">
          your trail
        </span>
        <span
          className="font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-500"
          style={{ color: animate ? current.accent : "rgba(241,234,216,0.35)" }}
        >
          {String(active + 1).padStart(2, "0")} / 06
        </span>
      </div>

      <div className="px-5 py-8 sm:px-8 sm:py-10">
        {/* Roles the interviewer covers — every role the product sets up. */}
        <div className="flex flex-wrap justify-center gap-2">
          {roles.map((role, index) => {
            const on = animate && index === active;
            return (
              <span
                key={role}
                className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors duration-500"
                style={
                  on
                    ? {
                        borderColor: `${current.accent}59`,
                        backgroundColor: `${current.accent}14`,
                        color: current.accent
                      }
                    : {
                        borderColor: "rgba(241,234,216,0.12)",
                        backgroundColor: "rgba(241,234,216,0.02)",
                        color: "rgba(241,234,216,0.5)"
                      }
                }
              >
                {role}
              </span>
            );
          })}
        </div>

        <div className="mt-12">
          <ol className="grid gap-9 sm:grid-cols-2 lg:grid-cols-6 lg:gap-4">
            {stages.map((stage, index) => {
              const Icon = stage.icon;
              const on = animate && index === active;

              return (
                <li key={stage.title} className="relative flex flex-col items-center text-center">
                  <span
                    className="relative z-10 grid h-[6.5rem] w-[6.5rem] place-items-center rounded-[1.6rem] border transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                    style={
                      on
                        ? {
                            borderColor: `${stage.accent}66`,
                            backgroundColor: `${stage.accent}14`,
                            color: stage.accent,
                            transform: "translateY(-4px)",
                            boxShadow: `0 0 0 6px ${stage.accent}0d, 0 18px 40px -18px ${stage.accent}`
                          }
                        : {
                            borderColor: "rgba(241,234,216,0.1)",
                            backgroundColor: "rgba(241,234,216,0.03)",
                            color: "rgba(241,234,216,0.42)"
                          }
                    }
                  >
                    <Icon size={34} strokeWidth={on ? 2.1 : 1.8} aria-hidden="true" />

                    {/* Tiny waveform, so the live stage reads as running rather
                        than merely highlighted. */}
                    <span
                      aria-hidden
                      className={[
                        "absolute inset-x-0 -bottom-3 flex h-3 items-end justify-center gap-[3px] transition-opacity duration-500",
                        on ? "opacity-100" : "opacity-0"
                      ].join(" ")}
                    >
                      {[0.5, 0.85, 1, 0.7, 0.4].map((scale, barIndex) => (
                        <span
                          key={barIndex}
                          className={on ? "wave-bar w-[3px] rounded-full" : "hidden"}
                          style={{
                            height: `${scale * 100}%`,
                            backgroundColor: stage.accent,
                            animationDelay: `${barIndex * 90}ms`
                          }}
                        />
                      ))}
                    </span>
                  </span>

                  <span
                    className="mt-6 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-500"
                    style={{ color: on ? stage.accent : "rgba(241,234,216,0.3)" }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3
                    className={[
                      "mt-2 text-[15.5px] font-semibold tracking-tight transition-colors duration-500",
                      on ? "text-cream" : "text-cream/75"
                    ].join(" ")}
                  >
                    {stage.title}
                  </h3>
                  <p className="mt-2 max-w-[15rem] text-[13px] leading-6 text-cream/45 lg:max-w-none">
                    {stage.detail}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
