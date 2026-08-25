"use client";

import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight, Loader2, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { ALL_PERSONAS, type InterviewerPersona } from "@/lib/avatars/personas";
import { useMayaVoice } from "@/lib/voice/use-maya-voice";
import { PRIMARY_BUTTON } from "../flow/onboarding-data";

const AvatarStage = dynamic(
  () => import("@/components/interview/voice/avatar-stage").then((m) => m.AvatarStage),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center">
        <span className="h-9 w-9 animate-pulse rounded-full bg-cream/[0.08]" />
      </div>
    )
  }
);

const headingWords = ["Who", "should", "teach", "you?"];

/**
 * Head-and-shoulders, not portrait.
 *
 * The Rocketbox models are stored in their bind pose — arms straight out — and
 * carry no idle animation to pose them out of it. `portrait` framing (0.56 of
 * body height) is wide enough to put those arms on screen; `default` (0.36)
 * crops to the face, which is the only part the rig actually animates anyway.
 */
const FRAMING = "default" as const;
const DEFAULT_TEACHER_ID = "sophia";

/** Only the centre stage plus its two neighbours are ever mounted. */
function neighbours(index: number) {
  const count = ALL_PERSONAS.length;
  return {
    left: (index - 1 + count) % count,
    right: (index + 1) % count
  };
}

/**
 * True once the viewport is wide enough to show the flanking avatars. They are
 * gated on this rather than merely hidden so phones never create the extra
 * WebGL contexts or download models they cannot display.
 */
function useWideViewport(): boolean {
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return wide;
}

export function TeacherStep({
  selected,
  onSelect,
  onContinue
}: {
  selected: string | null;
  onSelect: (teacherId: string) => void;
  onContinue: () => void;
}) {
  const [index, setIndex] = useState(() => {
    const found = ALL_PERSONAS.findIndex((persona) => persona.id === selected);
    if (found !== -1) return found;
    const defaultIndex = ALL_PERSONAS.findIndex((persona) => persona.id === DEFAULT_TEACHER_ID);
    return defaultIndex === -1 ? 0 : defaultIndex;
  });
  const [motion, setMotion] = useState<"previous" | "next" | null>(null);
  const { state, speak, stop, awaitingGesture } = useMayaVoice();
  const wide = useWideViewport();
  // Autoplay is refused until the page has seen a real gesture, so the first
  // greeting waits for one instead of being reported as a broken voice.
  const introducedRef = useRef(false);

  const focused = ALL_PERSONAS[index]!;
  const initialPersonaRef = useRef(focused);
  const { left, right } = neighbours(index);
  const speaking = state === "speaking" || state === "loading";
  const voiceBroken = state === "unavailable";

  // Centring a teacher is the selection. There is no separate commit step —
  // whoever is on the stage when Continue is pressed is the one who teaches.
  useEffect(() => {
    onSelect(focused.id);
  }, [focused.id, onSelect]);

  const greet = useCallback(
    (persona: InterviewerPersona) => {
      introducedRef.current = true;
      void speak(persona.greeting, persona.id);
    },
    [speak]
  );

  // Try the first introduction immediately. Browsers that recognise prior
  // media engagement or same-origin navigation will allow it; a brand-new
  // visitor falls back to the explicit sound control below when autoplay is
  // denied. Resetting the guard during effect cleanup lets React Strict Mode's
  // development-only remount retry after the first audio element is stopped.
  useEffect(() => {
    if (introducedRef.current) return;
    greet(initialPersonaRef.current);
    return () => {
      introducedRef.current = false;
    };
  }, [greet]);

  const go = useCallback(
    (nextIndex: number) => {
      const count = ALL_PERSONAS.length;
      const wrapped = (nextIndex + count) % count;
      const direction =
        (nextIndex - index + count) % count === 1 || (index === count - 1 && wrapped === 0)
          ? "next"
          : "previous";

      // Clear the animation for one frame so a run of clicks in the same
      // direction still gets its own handoff rather than snapping to the new
      // teacher. The canvas remains mounted throughout.
      setMotion(null);
      window.requestAnimationFrame(() => {
        setIndex(wrapped);
        setMotion(direction);
      });
      greet(ALL_PERSONAS[wrapped]!);
    },
    [greet, index]
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") go(index - 1);
      if (event.key === "ArrowRight") go(index + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  // Moving on mid-sentence would leave one teacher's voice coming out of the
  // next one's face.
  useEffect(() => stop, [stop]);

  return (
    <>
      <div className="text-center">
        <h1
          className="display-heading mx-auto flex max-w-4xl flex-wrap justify-center gap-x-3 gap-y-1 text-cream sm:gap-x-4"
          style={{ fontSize: "clamp(2rem, 4.4vw, 3.5rem)" }}
          aria-label="Who should teach you?"
        >
          {headingWords.map((word, wordIndex) => (
            <span
              key={`${word}-${wordIndex}`}
              aria-hidden="true"
              className="onboarding-word"
              style={{ "--word-delay": `${wordIndex * 85}ms` } as CSSProperties}
            >
              {word}
            </span>
          ))}
        </h1>
      </div>

      <div className="relative mx-auto mt-7 flex w-full max-w-6xl items-center justify-center gap-3 sm:gap-6">
        {wide ? (
          <Peek persona={ALL_PERSONAS[left]!} side="left" onClick={() => go(index - 1)} />
        ) : null}

        <div className="relative w-full max-w-[20rem] shrink-0 sm:max-w-[23rem]">
          <div
            className={[
              "teacher-carousel-scene relative h-[20.5rem] overflow-hidden rounded-[2rem] sm:h-[25rem]",
              motion ? `teacher-carousel-scene-${motion}` : ""
            ].join(" ")}
          >
            <div className="teacher-carousel-orbit" aria-hidden="true" />
            {/* No `key`: `url` is a dependency of the stage's own scene effect,
                so switching teacher rebuilds the scene in place rather than
                remounting the canvas and flashing an empty frame. */}
            <AvatarStage
              agentTrack={null}
              state={speaking ? "speaking" : "listening"}
              url={focused.model}
              rig={focused.rig}
              framing={FRAMING}
              showStatus={false}
              feather={false}
              introducing={state === "speaking"}
            />

            <button
              type="button"
              onClick={() => (speaking ? stop() : greet(focused))}
              aria-label={speaking ? `Stop ${focused.name}` : `Hear ${focused.name}`}
              className={[
                "absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.22)] backdrop-blur-xl transition duration-300 hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#F26E01]",
                awaitingGesture
                  ? "animate-pulse bg-[#F26E01] text-white hover:bg-[#ff7a0a]"
                  : "bg-black/30 text-cream/75 hover:bg-black/50 hover:text-cream"
              ].join(" ")}
            >
              {state === "loading" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : voiceBroken ? (
                <VolumeX size={16} />
              ) : (
                <Volume2 size={16} />
              )}
            </button>
          </div>

          <div key={focused.id} className="teacher-carousel-copy mt-5 text-center">
            <p className="text-[1.85rem] font-bold leading-none tracking-[-0.04em] text-cream sm:text-[2rem]">
              {focused.name}
            </p>
            <p className="mt-2 text-[12.5px] font-semibold uppercase tracking-[0.14em] text-[#F26E01]/85">
              {focused.tagline}
            </p>
            <p className="mx-auto mt-3 max-w-[26rem] text-[14.5px] leading-6 text-cream/72">
              {focused.bio}
            </p>
          </div>
        </div>

        {wide ? (
          <Peek persona={ALL_PERSONAS[right]!} side="right" onClick={() => go(index + 1)} />
        ) : null}

        <Arrow side="left" onClick={() => go(index - 1)} />
        <Arrow side="right" onClick={() => go(index + 1)} />
      </div>

      <div className="mx-auto mt-7 flex w-full max-w-5xl flex-col items-center gap-4">
        <p className="min-h-5 text-[12.5px] text-cream/50" role="status">
          {voiceBroken
            ? "Voice preview is unavailable right now — you can still choose."
            : awaitingGesture
              ? `Tap the orange sound button to hear ${focused.name}.`
              : !introducedRef.current
                ? "Preparing the introduction..."
                : `${focused.name} will guide you from here.`}
        </p>

        <button
          type="button"
          className={`${PRIMARY_BUTTON} teacher-carousel-continue relative overflow-hidden font-medium`}
          onClick={() => {
            stop();
            onContinue();
          }}
        >
          Continue with {focused.name}
        </button>
      </div>
    </>
  );
}

/**
 * A flanking teacher. It renders one low-resolution WebGL frame and then parks
 * its loop, preserving the three-person carousel without continuously
 * animating three full scenes.
 */
function Peek({
  persona,
  side,
  onClick
}: {
  persona: InterviewerPersona;
  side: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Show ${persona.name}`}
      onClick={onClick}
      className={[
        "teacher-carousel-peek group relative hidden h-[16.5rem] w-[12rem] shrink-0 overflow-hidden rounded-[1.8rem] transition duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] lg:block",
        side === "left" ? "origin-right" : "origin-left",
        "opacity-35 blur-[2.5px] hover:scale-[1.025] hover:opacity-65 hover:blur-[0.5px]"
      ].join(" ")}
    >
      <AvatarStage
        agentTrack={null}
        state="listening"
        url={persona.model}
        rig={persona.rig}
        framing={FRAMING}
        performanceProfile="preview"
        active={false}
        showStatus={false}
        feather={false}
      />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(14,15,17,0.94)] to-transparent px-3 pb-3 pt-10 text-[13px] font-semibold text-cream/85">
        {persona.name}
      </span>
    </button>
  );
}

function Arrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous teacher" : "Next teacher"}
      className={[
        "absolute top-[9.5rem] z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/[0.055] text-cream/70 shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-xl transition duration-300 hover:scale-110 hover:bg-white/[0.12] hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#F26E01] sm:top-[12rem]",
        side === "left" ? "left-0 sm:-left-2" : "right-0 sm:-right-2"
      ].join(" ")}
    >
      {side === "left" ? <ChevronLeft size={19} /> : <ChevronRight size={19} />}
    </button>
  );
}
