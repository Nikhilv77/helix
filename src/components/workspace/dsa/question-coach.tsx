"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Lightbulb,
  Loader2,
  Lock,
  Sparkles,
  Target,
  Volume2,
  VolumeX
} from "lucide-react";
import { MayaStage } from "@/components/workspace/shared/maya/maya-stage";
import { useMayaVoice } from "@/lib/voice/use-maya-voice";

/**
 * Maya sitting beside a question the user is solving.
 *
 * She opens by naming the pattern — never the solution — then speaks each hint
 * as it is unlocked, one at a time. The key insight stays sealed until every
 * hint is out, because a panel you can read straight through is not a hint
 * panel. Everything she says comes from the question's own teaching layer.
 */
export function QuestionCoach({
  title,
  pattern,
  promptSummary,
  concepts,
  hints,
  keyInsight,
  approachNames
}: {
  title: string;
  pattern: string;
  promptSummary: string;
  concepts: string[];
  hints: string[];
  keyInsight: string | null;
  approachNames: string[];
}) {
  const [revealed, setRevealed] = useState(0);
  const [insightOpen, setInsightOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const { state, speak, stop, awaitingGesture, setAwaitingGesture } = useMayaVoice();
  const speaking = state === "speaking";
  const introduced = useRef(false);

  const patternLabel = pattern.replace(/-/g, " ");

  // Safe to hear before attempting: names the shape of the problem and how to
  // start, without any part of the answer.
  const intro = useMemo(() => {
    const conceptLine = concepts.length
      ? ` It leans on ${concepts.slice(0, 2).join(" and ")}.`
      : "";
    return `${title}. This is a ${patternLabel} problem.${conceptLine} ${promptSummary} Before you write anything, say your brute force out loud, then look for what makes it wasteful. Ask me for a hint whenever you want one.`;
  }, [concepts, patternLabel, promptSummary, title]);

  const say = useCallback(
    (line: string) => {
      if (muted) return;
      void speak(line);
    },
    [muted, speak]
  );

  // Introduce the question once on arrival, then stay quiet until asked.
  useEffect(() => {
    if (introduced.current || muted || awaitingGesture) return;
    introduced.current = true;
    const start = window.setTimeout(() => void speak(intro), 120);
    return () => window.clearTimeout(start);
  }, [awaitingGesture, intro, muted, speak]);

  useEffect(() => {
    if (!awaitingGesture) return;
    const unlock = () => setAwaitingGesture(false);
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [awaitingGesture, setAwaitingGesture]);

  useEffect(() => {
    if (muted) stop();
  }, [muted, stop]);

  useEffect(() => stop, [stop]);

  const allHintsOut = revealed >= hints.length;
  function revealNext() {
    const next = hints[revealed];
    setRevealed((count) => count + 1);
    if (next) say(`Hint ${revealed + 1}. ${next}`);
  }

  function toggleInsight() {
    const opening = !insightOpen;
    setInsightOpen(opening);
    if (opening && keyInsight) say(`The key insight. ${keyInsight}`);
  }

  return (
    <aside className="practice-glass overflow-hidden rounded-[1.6rem]">
      <div className="relative h-[14.5rem] overflow-hidden border-b border-cream/[0.07]">
        <div className="practice-accent-glow absolute inset-x-[8%] bottom-[-55%] h-[85%] opacity-80" />
        <div
          className="absolute inset-x-[-3%] bottom-0 top-[2.2rem] z-0"
          style={{
            maskImage: "linear-gradient(180deg,#000 0%,#000 82%,transparent 100%)",
            WebkitMaskImage: "linear-gradient(180deg,#000 0%,#000 82%,transparent 100%)"
          }}
        >
          <MayaStage speaking={speaking} />
        </div>

        <div className="relative z-20 flex items-start justify-between gap-3 p-5">
          <div className="flex items-center gap-2.5">
            <Sparkles size={17} aria-hidden="true" style={{ color: "var(--workspace-accent)" }} />
            <div>
              <p className="text-[15px] font-semibold leading-tight text-cream">Maya</p>
              <p className="mt-0.5 text-[12px] font-medium text-cream/48">Question coach</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMuted((value) => !value)}
            aria-label={muted ? "Unmute Maya" : "Mute Maya"}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-cream/50 transition hover:bg-cream/[0.08] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
          >
            {muted ? (
              <VolumeX size={16} aria-hidden="true" />
            ) : (
              <Volume2 size={16} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          {awaitingGesture && !muted ? (
            <button
              type="button"
              onClick={() => {
                setAwaitingGesture(false);
                say(intro);
              }}
              className="inline-flex items-center gap-2 rounded-full bg-cream px-3.5 py-2 text-[13px] font-semibold text-[#171a16] transition hover:bg-white"
            >
              <Volume2 size={13} aria-hidden="true" />
              Hear Maya
            </button>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full bg-cream/[0.045] px-3 py-1.5 text-[12px] font-semibold text-cream/55">
              <span
                className={`h-1.5 w-1.5 rounded-full ${speaking ? "shadow-[0_0_12px_var(--workspace-accent)]" : "bg-cream/30"}`}
                style={speaking ? { background: "var(--workspace-accent)" } : undefined}
              />
              {speaking ? "Speaking" : muted ? "Muted" : "Ready"}
            </span>
          )}

          <button
            type="button"
            onClick={() => say(intro)}
            disabled={muted}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-cream/52 transition hover:bg-cream/[0.06] hover:text-cream disabled:pointer-events-none disabled:opacity-40"
          >
            {state === "loading" ? (
              <Loader2 size={12} aria-hidden="true" className="animate-spin" />
            ) : (
              <Volume2 size={12} aria-hidden="true" />
            )}
            Explain again
          </button>
        </div>

        <div className="practice-glass-soft mt-5 rounded-2xl p-4">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-cream/42">
            Pattern to notice
          </p>
          <p className="mt-1.5 text-[16px] font-semibold capitalize text-cream">{patternLabel}</p>
          {concepts.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {concepts.slice(0, 4).map((concept) => (
                <span
                  key={concept}
                  className="rounded-full bg-cream/[0.055] px-2.5 py-1 text-[12px] font-medium text-cream/58"
                >
                  {concept}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {hints.length ? (
          <div className="mt-5 space-y-2.5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-cream/42">
              Hints · {revealed}/{hints.length} used
            </p>

            {hints.slice(0, revealed).map((hint, index) => (
              <div
                key={hint}
                className="practice-glass-soft fade-slide flex gap-3 rounded-xl p-3.5"
              >
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold"
                  style={{
                    color: "var(--workspace-accent)",
                    background: "color-mix(in srgb, var(--workspace-accent) 10%, transparent)"
                  }}
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] leading-6 text-cream/76">{hint}</p>
                  <button
                    type="button"
                    onClick={() => say(`Hint ${index + 1}. ${hint}`)}
                    disabled={muted}
                    className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-cream/40 transition hover:text-cream/75 disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Volume2 size={11} aria-hidden="true" />
                    Hear this
                  </button>
                </div>
              </div>
            ))}

            {!allHintsOut ? (
              <button
                type="button"
                onClick={revealNext}
                className="practice-glass-soft flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-semibold text-cream/70 transition hover:bg-cream/[0.085] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
              >
                <Lightbulb size={14} aria-hidden="true" />
                {revealed === 0 ? "Give me a hint" : `Next hint (${revealed}/${hints.length})`}
              </button>
            ) : null}
          </div>
        ) : null}

        {keyInsight ? (
          <div className="mt-4">
            {allHintsOut || hints.length === 0 ? (
              <div className="practice-glass-soft overflow-hidden rounded-2xl">
                <button
                  type="button"
                  onClick={toggleInsight}
                  aria-expanded={insightOpen}
                  className="flex w-full items-center gap-2.5 p-4 text-left transition hover:bg-cream/[0.045]"
                >
                  <Target
                    size={16}
                    aria-hidden="true"
                    className="shrink-0"
                    style={{ color: "var(--workspace-accent)" }}
                  />
                  <span className="min-w-0 flex-1 text-[14px] font-semibold text-cream/85">
                    The key insight
                  </span>
                  <ChevronDown
                    size={15}
                    aria-hidden="true"
                    className={`shrink-0 text-cream/40 transition-transform ${insightOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {insightOpen ? (
                  <p className="fade-slide border-t border-cream/[0.06] px-4 pb-4 pt-3 text-[14px] leading-6 text-cream/75">
                    {keyInsight}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="practice-glass-soft flex items-center gap-2.5 rounded-xl p-3.5">
                <Lock size={13} aria-hidden="true" className="shrink-0 text-cream/30" />
                <p className="text-[13px] leading-5 text-cream/42">
                  Unlocks after all {hints.length} hints. Try it yourself first.
                </p>
              </div>
            )}
          </div>
        ) : null}

        {approachNames.length ? (
          <div className="mt-5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-cream/42">
              Approaches below
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {approachNames.map((name) => (
                <span
                  key={name}
                  className="practice-glass-soft rounded-full px-2.5 py-1 text-[12px] font-medium text-cream/58"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
