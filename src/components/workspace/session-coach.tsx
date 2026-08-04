"use client";

import { Loader2, Volume2, VolumeX } from "lucide-react";
import { MayaStage } from "@/components/workspace/maya-stage";
import { useMayaVoice } from "@/lib/use-maya-voice";
import type { CurriculumSession } from "@/lib/curriculum";

/**
 * Maya introducing a session out loud. Her audio runs through the shared voice
 * bus, so the avatar's mouth moves with the words rather than sitting still.
 */
export function SessionCoach({ session }: { session: CurriculumSession }) {
  const { state, speak, stop } = useMayaVoice();
  const speaking = state === "speaking";
  const line = `${session.title}. ${session.coachNote} ${session.objective}`;

  return (
    <div className="relative mx-auto h-44 w-full max-w-[13rem] overflow-hidden rounded-2xl bg-[#102764] lg:h-52 lg:max-w-none">
      <MayaStage speaking={speaking} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#102764] to-transparent" />

      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-cream">Maya</span>
        <button
          type="button"
          onClick={() => (speaking || state === "loading" ? stop() : void speak(line))}
          disabled={state === "unavailable"}
          className="pill inline-flex h-8 items-center gap-1.5 !rounded-lg px-2.5 text-[10px] font-semibold text-cream/75 transition hover:bg-white/[0.16] hover:text-cream disabled:cursor-not-allowed disabled:opacity-45"
        >
          {state === "loading" ? (
            <Loader2 size={12} className="animate-spin" />
          ) : speaking ? (
            <VolumeX size={12} />
          ) : (
            <Volume2 size={12} />
          )}
          {state === "unavailable" ? "No voice" : speaking ? "Stop" : "Hear Maya"}
        </button>
      </div>
    </div>
  );
}
