"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Mic, Volume2, VolumeX } from "lucide-react";
import { MayaStage } from "@/components/workspace/shared/maya/maya-stage";
import { useMayaVoice, voiceUrl } from "@/lib/voice/use-maya-voice";

/**
 * Maya on the Interviews page, speaking the way she does on Home and Practice.
 *
 * She was a silent avatar here while every other surface introduced itself,
 * which read as a different product. What she says comes from real state —
 * rounds left, completed rounds, the focus area — so it changes as the user
 * runs interviews rather than being a fixed greeting.
 */
export function InterviewsMaya({
  firstName,
  focus,
  remaining,
  completedSessions,
  hasActiveRound
}: {
  firstName: string;
  focus: string | null;
  remaining: number;
  completedSessions: number;
  hasActiveRound: boolean;
}) {
  const [muted, setMuted] = useState(false);
  const { state, speak, stop, awaitingGesture, setAwaitingGesture } = useMayaVoice();
  const speaking = state === "speaking";

  const script = useMemo(() => {
    const who = firstName ? `${firstName}, ` : "";

    if (hasActiveRound) {
      return `${who}you have a round already in progress. Pick it back up and finish it — a partial round tells us very little.`;
    }

    if (remaining === 0) {
      return `${who}you have used every round for today. Come back tomorrow, or spend the time reviewing the reports you already have.`;
    }

    if (completedSessions === 0) {
      return `${who}let's get a baseline. I will press on the evidence that is actually on your resume, not generic questions.${
        focus ? ` We will start around ${focus}.` : ""
      } Answer out loud, the way you would in a real round.`;
    }

    return `${who}you have ${completedSessions} scored ${completedSessions === 1 ? "round" : "rounds"} behind you and ${remaining} left today.${
      focus ? ` Your current focus is ${focus}.` : ""
    } Each round pushes a little harder on the gaps the last one exposed.`;
  }, [completedSessions, firstName, focus, hasActiveRound, remaining]);

  const say = useCallback(() => {
    if (muted) return;
    setAwaitingGesture(false);
    void speak(script);
  }, [muted, script, setAwaitingGesture, speak]);

  useEffect(() => {
    if (muted || awaitingGesture) return;
    const start = window.setTimeout(() => void speak(script), 80);
    return () => {
      window.clearTimeout(start);
      stop();
    };
  }, [awaitingGesture, muted, script, speak, stop]);

  // Autoplay is refused until the page has seen a real interaction.
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

  useEffect(() => {
    if (muted) return;
    const warm = new Audio(voiceUrl(script));
    warm.preload = "auto";
    warm.load();
  }, [muted, script]);

  return (
    <div className="relative flex min-h-[22rem] flex-col overflow-hidden rounded-2xl bg-[#1b1d20] lg:min-h-[28rem]">
      {/* Stops above the status row so the pill never sits across her. */}
      <div
        className="absolute inset-x-[-6%] bottom-[3.25rem] top-[3.5rem] z-0"
        style={{
          maskImage: "linear-gradient(180deg,#000 0%,#000 92%,transparent 100%)",
          WebkitMaskImage: "linear-gradient(180deg,#000 0%,#000 92%,transparent 100%)"
        }}
      >
        <MayaStage speaking={speaking} />
      </div>

      <div className="relative z-20 flex items-center justify-between gap-3 px-5 pt-5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-cream text-[#254294]">
            <Mic size={15} aria-hidden="true" />
          </span>
          <div>
            <p className="text-[14px] font-semibold leading-tight text-cream">Maya</p>
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-cream/45">
              Your interviewer
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMuted((value) => !value)}
          aria-label={muted ? "Unmute Maya" : "Mute Maya"}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-cream/55 transition hover:bg-cream/[0.1] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/40"
        >
          {muted ? <VolumeX size={15} aria-hidden="true" /> : <Volume2 size={15} aria-hidden="true" />}
        </button>
      </div>

      <div aria-hidden="true" className="min-h-0 flex-1" />

      <div className="relative z-20 flex items-center justify-between gap-2 px-5 pb-5">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] transition ${
            speaking ? "bg-[#8be6bd]/12 text-[#a9f0d0]" : "bg-cream/[0.07] text-cream/45"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${speaking ? "bg-[#8be6bd]" : "bg-cream/35"}`} />
          {speaking ? "Speaking" : muted ? "Muted" : awaitingGesture ? "Tap to start" : "Ready"}
        </span>

        <button
          type="button"
          onClick={say}
          disabled={muted}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-cream/55 transition hover:bg-cream/[0.08] hover:text-cream disabled:pointer-events-none disabled:opacity-40"
        >
          <Volume2 size={12} aria-hidden="true" />
          Hear Maya
        </button>
      </div>
    </div>
  );
}
